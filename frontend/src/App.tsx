import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { connectWallet, getEscrowContract } from './web3Service';
import { ethers } from 'ethers';

// Import newly structured views
import Dashboard from './pages/Dashboard';
import CreateEscrow from './pages/CreateEscrow';
import DisputeView from './pages/DisputeView';
import History from './pages/History';

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [contractDetails, setContractDetails] = useState<string>("Initializing Connection...");

  const [sellerAddress, setSellerAddress] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [targetEscrowId, setTargetEscrowId] = useState<string>("");
  const [aiVerdict, setAiVerdict] = useState<string>("Compliance metrics verified.");

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

  useEffect(() => {
    const fetchContractData = async () => {
      if (!walletAddress) return;
      try {
        setStatusMessage("⏳ Querying smart contract state...");
        const contract = await getEscrowContract();
        const contractTarget = await contract.getAddress();
        
        let totalEscrows = "0";
        try {
          const counter = await contract.escrowCounter();
          totalEscrows = counter.toString();
        } catch (e) {
          console.log("Counter read exception, defaulting layout map.");
        }
        
        setContractDetails(`Live at: ${contractTarget.substring(0, 6)}... | Total: ${totalEscrows}`);
        setStatusMessage("🟢 Contract handshake completed successfully.");
      } catch (error: any) {
        setContractDetails("Error Interfacing Registry");
        setStatusMessage(`⚠️ Registry sync block: ${error.message}`);
      }
    };
    fetchContractData();
  }, [walletAddress]);

  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerAddress || !depositAmount) {
      setStatusMessage("❌ Please supply a target seller address and valid ETH metric.");
      return;
    }
    try {
      setIsLoading(true);
      setStatusMessage("⏳ Broadcasting transaction execution matrix to Sepolia...");
      const contract = await getEscrowContract();
      const tx = await contract.createEscrow(sellerAddress, { value: ethers.parseEther(depositAmount) });
      setStatusMessage("🚀 Transaction broadcasted! Awaiting block confirmation...");
      const receipt = await tx.wait();
      setStatusMessage(`💥 Escrow Vault Initialized! Hash: ${receipt.hash}`);
    } catch (error: any) {
      setStatusMessage(`❌ Transaction failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReleaseFunds = async () => {
    if (!targetEscrowId) {
      setStatusMessage("❌ Explicit Target Escrow ID index required for settlement.");
      return;
    }
    try {
      setIsLoading(true);
      setStatusMessage(`⏳ Dispatching release request for ID Vector: ${targetEscrowId}...`);
      const contract = await getEscrowContract();
      const tx = await contract.releaseFunds(Number(targetEscrowId), aiVerdict);
      setStatusMessage("🚀 Release authorization broadcasted! Confirming...");
      await tx.wait();
      setStatusMessage(`✅ Escrow ID ${targetEscrowId} successfully settled.`);
    } catch (error: any) {
      setStatusMessage(`❌ Release protocol failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <div style={{ padding: '60px 20px', fontFamily: '"Fira Code", monospace, sans-serif', backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <header style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: '#00ff00', fontSize: '2.5rem', fontWeight: 800, margin: '0 0 10px 0', letterSpacing: '1px', textShadow: '0 0 10px rgba(0,255,0,0.4)' }}>TRUSTWISE.AI</h1>
          <p style={{ color: '#666666', fontSize: '1rem', margin: 0 }}>Decentralized Escrow Architecture & Autonomous Arbitration Matrix</p>
        </header>

        {/* Dynamic Route Navigation Controls Menu */}
        {walletAddress && (
          <nav style={{ display: 'flex', gap: '16px', marginBottom: '40px', paddingBottom: '15px', justifyContent: 'center', wrap: 'wrap' }}>
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

        <main style={{ width: '100%', maxWidth: '700px', background: 'rgba(0, 0, 0, 0.9)', border: '2px solid #00ff00', padding: '40px', borderRadius: '12px', boxShadow: '0 0 30px rgba(0, 255, 0, 0.2)' }}>
          {!walletAddress ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <p style={{ color: '#888888', fontSize: '1rem', marginBottom: '28px' }}>Secure Gateway Locked. Initialize link to proceed.</p>
              <button onClick={handleConnect} disabled={isLoading} style={{ background: 'transparent', color: '#00ff00', border: '2px solid #00ff00', padding: '14px 36px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {isLoading ? "LINKING..." : "CONNECT WALLET VECTOR"}
              </button>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard walletAddress={walletAddress} contractDetails={contractDetails} statusMessage={statusMessage} />} />
              <Route path="/create" element={<CreateEscrow sellerAddress={sellerAddress} setSellerAddress={setSellerAddress} depositAmount={depositAmount} setDepositAmount={setDepositAmount} handleCreateEscrow={handleCreateEscrow} isLoading={isLoading} statusMessage={statusMessage} />} />
              <Route path="/dispute" element={<DisputeView targetEscrowId={targetEscrowId} setTargetEscrowId={setTargetEscrowId} aiVerdict={aiVerdict} setAiVerdict={setAiVerdict} handleReleaseFunds={handleReleaseFunds} isLoading={isLoading} statusMessage={statusMessage} />} />
              <Route path="/history" element={<History />} />
            </Routes>
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}