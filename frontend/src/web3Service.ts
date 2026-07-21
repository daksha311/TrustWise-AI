declare global {
  interface Window {
    ethereum?: any;
  }
}

import { ethers } from "ethers";
import EscrowABI from "./contracts/Escrow.json";

const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS || "0x66b4932b5430b41622d1eef2736dd17f5a98e8c2";

const SEPOLIA_CHAIN_ID = "0xaa36a7";
const SEPOLIA_RPC = import.meta.env.VITE_SEPOLIA_RPC || "https://rpc.sepolia.org";

/** Status values mirror Escrow.sol Status enum */
export const EscrowStatus = {
  Pending: 0,
  Disputed: 1,
  Released: 2,
  Refunded: 3,
} as const;

export interface DashboardMetrics {
  totalEscrows: number;
  activeVaults: number;
  disputedAssets: number;
  contractAddress: string;
}

export interface LedgerEvent {
  id: string;
  type: string;
  status: string;
  buyer: string;
  seller: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

async function ensureSepolia() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia Test Network",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [SEPOLIA_RPC],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

function getAbi() {
  return (EscrowABI as any).abi || EscrowABI;
}

export async function getEscrowContract() {
  await ensureSepolia();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, getAbi(), signer);
}

/** Read-only contract (MetaMask provider if available, else public Sepolia RPC) */
export async function getReadOnlyEscrowContract() {
  let provider: ethers.Provider;

  if (window.ethereum) {
    try {
      await ensureSepolia();
      provider = new ethers.BrowserProvider(window.ethereum);
    } catch {
      provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    }
  } else {
    provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  }

  return new ethers.Contract(CONTRACT_ADDRESS, getAbi(), provider);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const contract = await getReadOnlyEscrowContract();
  const address = await contract.getAddress();
  const counter = await contract.escrowCounter();
  const total = Number(counter);

  let activeVaults = 0;
  let disputedAssets = 0;

  // Status: Pending=0, Disputed=1, Released=2, Refunded=3
  for (let i = 0; i < total; i++) {
    try {
      const details = await contract.getEscrowDetails(i);
      const status = Number(details.status);
      if (status === EscrowStatus.Pending) activeVaults++;
      else if (status === EscrowStatus.Disputed) disputedAssets++;
    } catch {
      // Skip unreadable slots
    }
  }

  return {
    totalEscrows: total,
    activeVaults,
    disputedAssets,
    contractAddress: address,
  };
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function resolvePartyDetails(
  contract: ethers.Contract,
  escrowId: bigint | number,
  fallbackAmount?: bigint
): Promise<{ buyer: string; seller: string; amount: string }> {
  try {
    const details = await contract.getEscrowDetails(escrowId);
    const amt = details.amount > 0n ? details.amount : fallbackAmount ?? 0n;
    return {
      buyer: details.buyer,
      seller: details.seller,
      amount: ethers.formatEther(amt),
    };
  } catch {
    return {
      buyer: "—",
      seller: "—",
      amount: fallbackAmount != null ? ethers.formatEther(fallbackAmount) : "0",
    };
  }
}

function statusFromEnum(status: number): string {
  switch (status) {
    case EscrowStatus.Disputed:
      return "DISPUTED";
    case EscrowStatus.Released:
      return "RELEASED";
    case EscrowStatus.Refunded:
      return "REFUNDED";
    default:
      return "ACTIVE";
  }
}

async function queryFilterChunked(
  contract: ethers.Contract,
  filter: ethers.ContractEventName | ethers.DeferredTopicFilter,
  fromBlock: number,
  toBlock: number,
  chunkSize = 9_999
): Promise<(ethers.EventLog | ethers.Log)[]> {
  const results: (ethers.EventLog | ethers.Log)[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    const chunk = await contract.queryFilter(filter, start, end);
    results.push(...chunk);
  }
  return results;
}

/**
 * One ledger row per escrow, with live on-chain status (not hardcoded PENDING).
 */
export async function fetchLedgerEvents(): Promise<LedgerEvent[]> {
  const contract = await getReadOnlyEscrowContract();
  const provider = contract.runner?.provider as ethers.Provider;
  if (!provider) throw new Error("No provider available for event queries");

  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 100_000);

  const [created, disputed, released, refunded] = await Promise.all([
    queryFilterChunked(contract, contract.filters.EscrowCreated(), fromBlock, currentBlock),
    queryFilterChunked(contract, contract.filters.EscrowDisputed(), fromBlock, currentBlock),
    queryFilterChunked(contract, contract.filters.EscrowReleased(), fromBlock, currentBlock),
    queryFilterChunked(contract, contract.filters.EscrowRefunded(), fromBlock, currentBlock),
  ]);

  // Prefer the latest lifecycle event tx hash when present
  const latestTx = new Map<string, { txHash: string; blockNumber: number; type: string }>();

  const noteLatest = (
    escrowId: string,
    type: string,
    txHash: string,
    blockNumber: number
  ) => {
    const prev = latestTx.get(escrowId);
    if (!prev || blockNumber >= prev.blockNumber) {
      latestTx.set(escrowId, { txHash, blockNumber, type });
    }
  };

  for (const ev of created) {
    const log = ev as ethers.EventLog;
    if (!log.args) continue;
    noteLatest(
      log.args.escrowId.toString(),
      "EscrowCreated",
      log.transactionHash,
      log.blockNumber
    );
  }
  for (const ev of disputed) {
    const log = ev as ethers.EventLog;
    if (!log.args) continue;
    noteLatest(
      log.args.escrowId.toString(),
      "EscrowDisputed",
      log.transactionHash,
      log.blockNumber
    );
  }
  for (const ev of released) {
    const log = ev as ethers.EventLog;
    if (!log.args) continue;
    noteLatest(
      log.args.escrowId.toString(),
      "EscrowReleased",
      log.transactionHash,
      log.blockNumber
    );
  }
  for (const ev of refunded) {
    const log = ev as ethers.EventLog;
    if (!log.args) continue;
    noteLatest(
      log.args.escrowId.toString(),
      "EscrowRefunded",
      log.transactionHash,
      log.blockNumber
    );
  }

  const rows: LedgerEvent[] = [];

  for (const ev of created) {
    const log = ev as ethers.EventLog;
    if (!log.args) continue;
    const id = log.args.escrowId.toString();
    const latest = latestTx.get(id);

    let status = "ACTIVE";
    try {
      const details = await contract.getEscrowDetails(log.args.escrowId);
      status = statusFromEnum(Number(details.status));
    } catch {
      // keep ACTIVE fallback
    }

    rows.push({
      id,
      type: latest?.type ?? "EscrowCreated",
      status,
      buyer: log.args.buyer,
      seller: log.args.seller,
      amount: `${ethers.formatEther(log.args.amount)} ETH`,
      txHash: latest?.txHash ?? log.transactionHash,
      blockNumber: latest?.blockNumber ?? log.blockNumber,
    });
  }

  rows.sort((a, b) => Number(b.id) - Number(a.id));
  return rows;
}

export type LedgerEventCallback = (event: LedgerEvent) => void;

function extractLogMeta(payload: any): { txHash: string; blockNumber: number } {
  const log = payload?.log ?? payload;
  return {
    txHash: log?.transactionHash ?? "",
    blockNumber: Number(log?.blockNumber ?? 0),
  };
}

/**
 * Subscribe to live Escrow events. Returns an unsubscribe function.
 */
export async function subscribeToLedgerEvents(
  onEvent: LedgerEventCallback
): Promise<() => void> {
  const contract = await getReadOnlyEscrowContract();
  const provider = contract.runner?.provider as ethers.Provider;
  const amountCache = new Map<string, { buyer: string; seller: string; amount: bigint }>();

  // Seed cache from recent EscrowCreated logs so live settle events keep original amounts
  if (provider) {
    try {
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100_000);
      const created = await queryFilterChunked(
        contract,
        contract.filters.EscrowCreated(),
        fromBlock,
        currentBlock
      );
      for (const ev of created) {
        const log = ev as ethers.EventLog;
        if (!log.args) continue;
        amountCache.set(log.args.escrowId.toString(), {
          buyer: log.args.buyer,
          seller: log.args.seller,
          amount: log.args.amount,
        });
      }
    } catch {
      // Non-fatal — live rows may show 0 amount after settlement
    }
  }

  const handleCreated = (...args: any[]) => {
    const [escrowId, buyer, seller, amount, payload] = args;
    amountCache.set(escrowId.toString(), { buyer, seller, amount });
    const { txHash, blockNumber } = extractLogMeta(payload);
    onEvent({
      id: escrowId.toString(),
      type: "EscrowCreated",
      status: "ACTIVE",
      buyer,
      seller,
      amount: `${ethers.formatEther(amount)} ETH`,
      txHash,
      blockNumber,
    });
  };

  const resolveCached = async (escrowId: bigint) => {
    const cached = amountCache.get(escrowId.toString());
    if (cached) {
      return {
        buyer: cached.buyer,
        seller: cached.seller,
        amount: ethers.formatEther(cached.amount),
      };
    }
    return resolvePartyDetails(contract, escrowId);
  };

  const handleDisputed = async (...args: any[]) => {
    const [escrowId, , payload] = args;
    const { txHash, blockNumber } = extractLogMeta(payload);
    const parties = await resolveCached(escrowId);
    onEvent({
      id: escrowId.toString(),
      type: "EscrowDisputed",
      status: "DISPUTED",
      buyer: parties.buyer,
      seller: parties.seller,
      amount: `${parties.amount} ETH`,
      txHash,
      blockNumber,
    });
  };

  const handleReleased = async (...args: any[]) => {
    const [escrowId, , payload] = args;
    const { txHash, blockNumber } = extractLogMeta(payload);
    const parties = await resolveCached(escrowId);
    onEvent({
      id: escrowId.toString(),
      type: "EscrowReleased",
      status: "RELEASED",
      buyer: parties.buyer,
      seller: parties.seller,
      amount: `${parties.amount} ETH`,
      txHash,
      blockNumber,
    });
  };

  const handleRefunded = async (...args: any[]) => {
    const [escrowId, , payload] = args;
    const { txHash, blockNumber } = extractLogMeta(payload);
    const parties = await resolveCached(escrowId);
    onEvent({
      id: escrowId.toString(),
      type: "EscrowRefunded",
      status: "REFUNDED",
      buyer: parties.buyer,
      seller: parties.seller,
      amount: `${parties.amount} ETH`,
      txHash,
      blockNumber,
    });
  };

  contract.on("EscrowCreated", handleCreated);
  contract.on("EscrowDisputed", handleDisputed);
  contract.on("EscrowReleased", handleReleased);
  contract.on("EscrowRefunded", handleRefunded);

  return () => {
    contract.off("EscrowCreated", handleCreated);
    contract.off("EscrowDisputed", handleDisputed);
    contract.off("EscrowReleased", handleReleased);
    contract.off("EscrowRefunded", handleRefunded);
  };
}

export { shortAddr, CONTRACT_ADDRESS };
