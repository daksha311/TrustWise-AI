import React, { useState } from 'react';
import { resolveDisputeAPI } from '../utils/api';
import type { DisputePayload, AIVerdictResponse } from '../utils/api';
import { getEscrowContract } from '../web3Service';

interface DisputeViewProps {
  onTransactionComplete?: () => void;
}

export default function DisputeView({ onTransactionComplete }: DisputeViewProps) {
  const [formData, setFormData] = useState<DisputePayload>({
    // Demo UPS tracking number accepted by backend TrackingFetcher
    trackingNumber: "1Z12345E0205271688",
    disputeId: "DSP-001",
    escrowId: "0",
    buyer: "",
    seller: "",
    buyerClaim: "Package not delivered on promised date.",
    sellerClaim: "Item shipped on time via courier.",
    amount: "0.005",
  });

  const [aiResult, setAiResult] = useState<AIVerdictResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExecutingTx, setIsExecutingTx] = useState<boolean>(false);

  const canSettleOnChain =
    aiResult?.action === "release" || aiResult?.action === "refund";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleResolveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setStatusMessage("⏳ Dispatching evidence matrix to AI Arbiter backend...");
    setAiResult(null);

    try {
      const result = await resolveDisputeAPI(formData);
      setAiResult(result);
      setStatusMessage(
        `🟢 AI Arbitration complete — verdict: ${result.decision}`
      );
    } catch (error: any) {
      setStatusMessage(`❌ AI Resolution Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteContract = async () => {
    if (!aiResult || !canSettleOnChain) return;

    const methodName = aiResult.action === "release" ? "releaseFunds" : "refundFunds";
    setIsExecutingTx(true);
    setStatusMessage(`⏳ Dispatching ${methodName}() via MetaMask on Sepolia...`);

    try {
      const contract = await getEscrowContract();
      const escrowId = Number(formData.escrowId);
      const verdictText = aiResult.reasoning || aiResult.decision;

      const tx =
        aiResult.action === "release"
          ? await contract.releaseFunds(escrowId, verdictText)
          : await contract.refundFunds(escrowId, verdictText);

      setStatusMessage("🚀 Settlement broadcasted to Sepolia — awaiting block confirmation...");
      const receipt = await tx.wait();

      setStatusMessage(
        `💥 Settlement finalized (${aiResult.action === "release" ? "RELEASE" : "REFUND"}). Tx: ${receipt.hash}`
      );

      if (onTransactionComplete) {
        onTransactionComplete();
      }
    } catch (error: any) {
      const msg = error?.reason || error?.shortMessage || error?.message || "Unknown error";
      setStatusMessage(`❌ Smart Contract Execution Error: ${msg}`);
    } finally {
      setIsExecutingTx(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ border: '1px solid #222222', padding: '24px', borderRadius: '8px', background: '#000000' }}>
        <h3 style={{ color: '#00ff00', fontSize: '1.1rem', marginTop: 0, marginBottom: '20px' }}>
          [02] ARBITRATION RESOLUTION FORM
        </h3>

        <form onSubmit={handleResolveDispute} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Escrow ID Index</label>
            <input name="escrowId" value={formData.escrowId} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Dispute ID</label>
            <input name="disputeId" value={formData.disputeId} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Tracking Number</label>
            <input name="trackingNumber" value={formData.trackingNumber} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Locked Amount (ETH)</label>
            <input name="amount" value={formData.amount} onChange={handleChange} style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Buyer Address</label>
            <input name="buyer" value={formData.buyer} onChange={handleChange} placeholder="0x..." style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Seller Address</label>
            <input name="seller" value={formData.seller} onChange={handleChange} placeholder="0x..." style={inputStyle} required />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Buyer Claim Statement</label>
            <textarea name="buyerClaim" value={formData.buyerClaim} onChange={handleChange} rows={2} style={inputStyle} required />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', color: '#888888', fontSize: '0.8rem', marginBottom: '4px' }}>Seller Claim Statement</label>
            <textarea name="sellerClaim" value={formData.sellerClaim} onChange={handleChange} rows={2} style={inputStyle} required />
          </div>

          <button
            type="submit"
            disabled={isAnalyzing}
            style={{
              gridColumn: 'span 2',
              backgroundColor: 'transparent',
              color: '#00ff00',
              border: '1px solid #00ff00',
              padding: '14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              textTransform: 'uppercase'
            }}
          >
            {isAnalyzing ? "ANALYZING EVIDENCE MATRIX..." : "RESOLVE DISPUTE WITH AI"}
          </button>
        </form>
      </div>

      {aiResult && (
        <div style={{ border: '2px solid #00ff00', padding: '24px', borderRadius: '8px', background: 'rgba(0, 255, 0, 0.02)', boxShadow: '0 0 15px rgba(0, 255, 0, 0.15)' }}>
          <h3 style={{ color: '#00ff00', fontSize: '1.2rem', marginTop: 0, marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span>🤖 AI ARBITRATION RESULT</span>
            <span style={{ fontSize: '0.85rem', color: '#888888' }}>RISK SCORE: <strong style={{ color: '#38bdf8' }}>{aiResult.riskScore}</strong></span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={{ border: '1px solid #222222', padding: '12px', borderRadius: '4px' }}>
              <span style={{ color: '#888888', fontSize: '0.75rem', display: 'block' }}>DECISION</span>
              <strong style={{ color: '#00ff00', fontSize: '1.1rem' }}>{aiResult.decision}</strong>
            </div>
            <div style={{ border: '1px solid #222222', padding: '12px', borderRadius: '4px' }}>
              <span style={{ color: '#888888', fontSize: '0.75rem', display: 'block' }}>CONFIDENCE</span>
              <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>{aiResult.confidence}</strong>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <span style={{ color: '#888888', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>EVIDENCE</span>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#00ff00', fontSize: '0.9rem', listStyleType: 'square' }}>
              {aiResult.evidence?.length ? (
                aiResult.evidence.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                ))
              ) : (
                <li style={{ color: '#666666' }}>No key evidence returned</li>
              )}
            </ul>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ color: '#888888', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>REASONING</span>
            <p style={{ color: '#cccccc', fontSize: '0.9rem', margin: 0, borderLeft: '3px solid #00ff00', paddingLeft: '12px', lineHeight: '1.5' }}>
              {aiResult.reasoning}
            </p>
          </div>

          {canSettleOnChain ? (
            <button
              type="button"
              onClick={handleExecuteContract}
              disabled={isExecutingTx}
              style={{
                width: '100%',
                backgroundColor: aiResult.action === 'release' ? 'rgba(0, 255, 0, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: aiResult.action === 'release' ? '#00ff00' : '#f43f5e',
                border: `1px solid ${aiResult.action === 'release' ? '#00ff00' : '#f43f5e'}`,
                padding: '14px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              {isExecutingTx
                ? "AWAITING SEPOLIA CONFIRMATION..."
                : `EXECUTE ${aiResult.action === 'release' ? 'RELEASE' : 'REFUND'} VIA METAMASK`}
            </button>
          ) : (
            <p style={{ color: '#fbbf24', fontSize: '0.9rem', margin: 0 }}>
              Verdict does not map to an on-chain settlement method ({aiResult.rawAction}). No MetaMask transaction will be sent.
            </p>
          )}
        </div>
      )}

      {statusMessage && (
        <div style={{ padding: '14px', borderRadius: '4px', backgroundColor: '#000000', border: '1px solid #333333', fontSize: '0.9rem', color: '#cbd5e1', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '4px',
  border: '1px solid #333333',
  backgroundColor: '#000000',
  color: '#fff',
  boxSizing: 'border-box',
  fontSize: '0.9rem',
  fontFamily: 'monospace'
};
