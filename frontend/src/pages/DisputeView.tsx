import React from 'react';

interface DisputeViewProps {
  targetEscrowId: string;
  setTargetEscrowId: (val: string) => void;
  aiVerdict: string;
  setAiVerdict: (val: string) => void;
  handleReleaseFunds: () => void;
  isLoading: boolean;
  statusMessage: string;
}

export default function DisputeView({ targetEscrowId, setTargetEscrowId, aiVerdict, setAiVerdict, handleReleaseFunds, isLoading, statusMessage }: DisputeViewProps) {
  return (
    <div style={{ border: '1px solid #222222', padding: '24px', borderRadius: '8px' }}>
      <h3 style={{ color: '#f43f5e', fontSize: '1.1rem', marginTop: 0, marginBottom: '20px' }}>[02] ARBITRATION RESOLUTION PANEL</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', color: '#888888', fontSize: '0.85rem', marginBottom: '6px' }}>Target Agreement Escrow ID Index</label>
          <input type="text" value={targetEscrowId} onChange={(e) => setTargetEscrowId(e.target.value)} placeholder="0" style={{ width: '100%', padding: '12px 16px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#000000', color: '#fff', boxSizing: 'border-box', fontSize: '0.95rem' }} />
        </div>
        <div>
          <label style={{ display: 'block', color: '#888888', fontSize: '0.85rem', marginBottom: '6px' }}>AI Agent Verdict Metadata Payload</label>
          <input type="text" value={aiVerdict} onChange={(e) => setAiVerdict(e.target.value)} placeholder="Compliance metrics verified." style={{ width: '100%', padding: '12px 16px', borderRadius: '4px', border: '1px solid #333333', backgroundColor: '#000000', color: '#fff', boxSizing: 'border-box', fontSize: '0.95rem' }} />
        </div>
        <button type="button" onClick={handleReleaseFunds} disabled={isLoading} style={{ backgroundColor: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', padding: '14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textTransform: 'uppercase' }}>
          {isLoading ? "PROCESSING LEDGER..." : "RELEASE ASSET POOL"}
        </button>
      </div>

      {statusMessage && (
        <div style={{ marginTop: '20px', padding: '14px', borderRadius: '4px', backgroundColor: '#000000', border: '1px solid #333333', fontSize: '0.9rem', color: '#cbd5e1', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}