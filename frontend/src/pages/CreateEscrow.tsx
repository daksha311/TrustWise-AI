import React from 'react';

interface CreateEscrowProps {
  sellerAddress: string;
  setSellerAddress: (val: string) => void;
  depositAmount: string;
  setDepositAmount: (val: string) => void;
  handleCreateEscrow: (e: React.FormEvent) => void;
  isLoading: boolean;
  statusMessage: string;
}

export default function CreateEscrow({ sellerAddress, setSellerAddress, depositAmount, setDepositAmount, handleCreateEscrow, isLoading, statusMessage }: CreateEscrowProps) {
  return (
    <div style={{ border: '1px solid #222222', padding: '24px', borderRadius: '8px' }}>
      <h3 style={{ color: '#00ff00', fontSize: '1.1rem', marginTop: 0, marginBottom: '20px' }}>[01] ESCROW INITIALIZER VECTORS</h3>
      <form onSubmit={handleCreateEscrow} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', color: '#888888', fontSize: '0.85rem', marginBottom: '6px' }}>Counterparty Seller Wallet Address</label>
          <input
            type="text"
            value={sellerAddress}
            onChange={(e) => setSellerAddress(e.target.value)}
            placeholder="0xAbC... (40 hex chars — not the ETH amount)"
            style={{ width: '100%', padding: '12px 16px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#000000', color: '#fff', boxSizing: 'border-box', fontSize: '0.95rem', fontFamily: 'monospace' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', color: '#888888', fontSize: '0.85rem', marginBottom: '6px' }}>Lock Allocation Amount (Sepolia ETH)</label>
          <input type="text" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.005" style={{ width: '100%', padding: '12px 16px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#000000', color: '#fff', boxSizing: 'border-box', fontSize: '0.95rem' }} />
        </div>
        <button type="submit" disabled={isLoading} style={{ backgroundColor: 'transparent', color: '#00ff00', border: '1px solid #00ff00', padding: '14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textTransform: 'uppercase' }}>
          {isLoading ? "PROCESSING LEDGER..." : "EXECUTE ESCROW & LOCK ASSETS"}
        </button>
      </form>

      {statusMessage && (
        <div style={{ marginTop: '20px', padding: '14px', borderRadius: '4px', backgroundColor: '#000000', border: '1px solid #333333', fontSize: '0.9rem', color: '#cbd5e1', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}