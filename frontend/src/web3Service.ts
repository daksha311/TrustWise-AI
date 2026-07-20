declare global {
  interface Window {
    ethereum?: any;
  }
}

import { ethers } from "ethers";
import EscrowABI from "./contracts/Escrow.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x66b4932b5430b41622d1eef2736dd17f5a98e8c2";

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

export async function getEscrowContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed!");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia Test Network",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const abi = EscrowABI.abi || EscrowABI;

  return new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
}