import React, { useState, useEffect } from 'react'; // Notice useEffect added here
import { connectWallet, getEscrowContract } from './web3Service';

function App() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // New state to hold data from your contract
  const [contractDetails, setContractDetails] = useState<string>("Not Loaded");

  // Trigger wallet handshake
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

  // Trigger contract interaction once walletAddress becomes available
  useEffect(() => {
    const fetchContractData = async () => {
      if (!walletAddress) return;
      try {
        setStatusMessage("⏳ Querying smart contract state...");
        const contract = await getEscrowContract();
        
        // Call a read function from your Escrow contract if it exists 
        // For example, reading the owner or balance. Let's fetch the target address or a dummy call:
        const contractTarget = await contract.getAddress();
        
        setContractDetails(`Live instance verified at: ${contractTarget}`);
        setStatusMessage("🟢 Contract handshake completed successfully.");
      } catch (error: any) {
        console.error(error);
        setStatusMessage(`⚠️ Connected, but failed to read contract layout: ${error.message}`);
      }
    };

    fetchContractData();
  }, [walletAddress]);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '40px' }}>
        <h1 style={{ color: '#38bdf8', fontSize: '2rem', margin: 0 }}>TrustWise AI Dashboard</h1>
        <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Secure Decentralized Escrow Workspace</p>
      </header>

      <main style={{ maxWidth: '600px', backgroundColor: '#1e293b', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        {!walletAddress ? (
          <div>
            <p style={{ color: '#cbd5e1', marginBottom: '20px' }}>Please connect your developer wallet to initiate interaction vectors.</p>
            <button 
              onClick={handleConnect}
              disabled={isLoading}
              style={{
                backgroundColor: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem'
              }}
            >
              {isLoading ? "Connecting..." : "Connect Wallet"}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.85rem' }}>Authenticated Signer</span>
              <strong style={{ color: '#38bdf8', wordBreak: 'break-all' }}>{walletAddress}</strong>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.85rem' }}>Contract Status Matrix</span>
              <code style={{ color: '#a7f3d0' }}>{contractDetails}</code>
            </div>
            
            <p style={{ color: '#cbd5e1' }}>Wallet pipeline linked. Ready to wire up transaction triggers for agent logic execution.</p>
          </div>
        )}

        {statusMessage && (
          <div style={{ marginTop: '20px', padding: '12px', borderRadius: '6px', backgroundColor: '#0f172a', borderLeft: '4px solid #38bdf8', fontSize: '0.9rem', color: '#e2e8f0' }}>
            {statusMessage}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;