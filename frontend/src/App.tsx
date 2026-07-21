import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { connectWallet, getEscrowContract, fetchDashboardMetrics } from './web3Service';
import { ethers } from 'ethers';

// Import views
import Dashboard from './pages/Dashboard';
import CreateEscrow from './pages/CreateEscrow';
import DisputeView from './pages/DisputeView';
import History from './pages/History';

// Binary Matrix Rain Canvas Component
function BinaryRainBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const binaryUnits = "01";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const rainDrops = Array.from({ length: columns }).fill(1) as number[];

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff00';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < rainDrops.length; i++) {
        const text = binaryUnits.charAt(Math.floor(Math.random() * binaryUnits.length));
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: 0, 
        backgroundColor: '#000000', 
        pointerEvents: 'none' 
      }} 
    />
  );
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [contractDetails, setContractDetails] = useState<string>("Initializing Connection...");
  const [totalEscrows, setTotalEscrows] = useState<number>(0);
  const [activeVaults, setActiveVaults] = useState<number>(0);
  const [disputedAssets, setDisputedAssets] = useState<number>(0);

  const [sellerAddress, setSellerAddress] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");

  const fetchContractData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      setStatusMessage("⏳ Querying smart contract state...");
      const metrics = await fetchDashboardMetrics();
      setTotalEscrows(metrics.totalEscrows);
      setActiveVaults(metrics.activeVaults);
      setDisputedAssets(metrics.disputedAssets);
      setContractDetails(
        `Live at: ${metrics.contractAddress.substring(0, 6)}...${metrics.contractAddress.slice(-4)} | Total: ${metrics.totalEscrows}`
      );
      setStatusMessage("🟢 Contract handshake completed successfully.");
    } catch (error: any) {
      setContractDetails("Error Interfacing Registry");
      setStatusMessage(`⚠️ Registry sync block: ${error.message}`);
    }
  }, [walletAddress]);

  // 2. Fetch contract parameters when walletAddress updates
  useEffect(() => {
    fetchContractData();
  }, [walletAddress, fetchContractData]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      const address = await connectWallet();
      setWalletAddress(address);
      setStatusMessage("🟢 Wallet safely authenticated.");
    } catch (error: any) {
      setStatusMessage(`❌ Connection error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerAddress || !depositAmount) {
      setStatusMessage("❌ Please supply a target seller address and valid ETH metric.");
      return;
    }

    const trimmedSeller = sellerAddress.trim();
    // Accept any 0x + 40 hex; ignore EIP-55 casing (ethers.isAddress rejects bad checksums)
    let seller: string;
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedSeller)) {
        throw new Error("bad format");
      }
      seller = ethers.getAddress(trimmedSeller.toLowerCase());
    } catch {
      setStatusMessage(
        "❌ Seller must be a wallet address: 0x followed by exactly 40 hex characters."
      );
      return;
    }
    if (seller.toLowerCase() === walletAddress.toLowerCase()) {
      setStatusMessage("❌ Seller cannot be your own wallet address.");
      return;
    }

    let valueWei: bigint;
    try {
      valueWei = ethers.parseEther(depositAmount);
      if (valueWei <= 0n) throw new Error("zero");
    } catch {
      setStatusMessage("❌ Deposit amount must be a positive ETH value, e.g. 0.005");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage("⏳ Broadcasting transaction execution matrix to Sepolia...");
      const contract = await getEscrowContract();

      const tx = await contract.createEscrow(seller, {
        value: valueWei,
        gasLimit: 300000,
      });

      setStatusMessage("🚀 Transaction broadcasted! Awaiting block confirmation...");
      const receipt = await tx.wait();
      setStatusMessage(`💥 Escrow Vault Initialized! Hash: ${receipt.hash}`);
      fetchContractData();
    } catch (error: any) {
      const raw = error?.reason || error?.shortMessage || error?.message || "Unknown error";
      const hint = String(raw).includes("ResolverNotFound")
        ? " — seller field is not a valid 0x address (ethers tried ENS lookup)."
        : "";
      setStatusMessage(`❌ Transaction failed: ${raw}${hint}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <div style={{ padding: '60px 20px', fontFamily: '"Fira Code", monospace, sans-serif', backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        
        <BinaryRainBackground />

        <header style={{ textAlign: 'center', marginBottom: '30px', zIndex: 3 }}>
          <h1 style={{ color: '#00ff00', fontSize: '2.5rem', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '1px', textShadow: '0 0 10px rgba(0,255,0,0.4)' }}>TRUSTWISE.AI</h1>
          <p style={{ color: '#666666', fontSize: '1rem', margin: 0 }}>Decentralized Escrow Architecture & Autonomous Arbitration Matrix</p>
        </header>

        {walletAddress && (
          <nav style={{ display: 'flex', gap: '16px', marginBottom: '40px', paddingBottom: '15px', justifyContent: 'center', flexWrap: 'wrap', zIndex: 3 }}>
            {[
              { path: "/", label: "DASHBOARD" },
              { path: "/create", label: "INITIALIZE ESCROW" },
              { path: "/dispute", label: "ARBITRATION PANEL" },
              { path: "/history", label: "LEDGER LOGS" }
            ].map((link) => (
              <Link 
                key={link.path}
                to={link.path} 
                style={{ 
                  color: '#00ff00', 
                  textDecoration: 'none', 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  letterSpacing: '1px',
                  padding: '10px 20px',
                  border: '1px solid #00ff00',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(0, 255, 0, 0.03)',
                  boxShadow: 'inset 0 0 8px rgba(0, 255, 0, 0.1)',
                  transition: 'all 0.2s ease-in-out',
                  display: 'inline-block'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 0, 0.15)';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 0, 0.3), inset 0 0 8px rgba(0, 255, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 0, 0.03)';
                  e.currentTarget.style.boxShadow = 'inset 0 0 8px rgba(0, 255, 0, 0.1)';
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <main style={{ width: '100%', maxWidth: '700px', background: 'rgba(0, 0, 0, 0.9)', border: '2px solid #00ff00', padding: '40px', borderRadius: '12px', boxShadow: '0 0 30px rgba(0, 255, 0, 0.2)', zIndex: 3 }}>
          {!walletAddress ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: '#888888', fontSize: '1rem', marginBottom: '28px' }}>Secure Gateway Locked. Initialize link to proceed.</p>
              <button onClick={handleConnect} disabled={isLoading} style={{ background: 'transparent', color: '#00ff00', border: '2px solid #00ff00', padding: '14px 36px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {isLoading ? "LINKING..." : "CONNECT WALLET VECTOR"}
              </button>
            </div>
          ) : (
            <Routes>
              <Route 
                path="/" 
                element={
                  <Dashboard 
                    walletAddress={walletAddress} 
                    contractDetails={contractDetails} 
                    statusMessage={statusMessage}
                    totalEscrows={totalEscrows}
                    activeVaults={activeVaults}
                    disputedAssets={disputedAssets}
                  />
                } 
              />
              <Route 
                path="/create" 
                element={
                  <CreateEscrow 
                    sellerAddress={sellerAddress} 
                    setSellerAddress={setSellerAddress} 
                    depositAmount={depositAmount} 
                    setDepositAmount={setDepositAmount} 
                    handleCreateEscrow={handleCreateEscrow} 
                    isLoading={isLoading} 
                    statusMessage={statusMessage} 
                  />
                } 
              />
              <Route 
                path="/dispute" 
                element={
                  <DisputeView 
                    onTransactionComplete={fetchContractData} 
                  />
                } 
              />
              <Route 
                path="/history" 
                element={<History />} 
              />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}