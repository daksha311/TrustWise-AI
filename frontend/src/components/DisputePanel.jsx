import React, { useState, useEffect } from 'react';
import { resolveDispute } from '../api/trustwise';
import useTLSNotary from '../hooks/useTLSNotary';

const DisputePanel = ({ escrowId, buyer, seller, amount }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('idle'); // idle | proof_generating | proof_verifying | ai_analyzing | settlement_executing | complete

  const {
    isInstalled,
    isReady,
    error: tlsError,
    proof,
    generateProof,
    verifyProof,
    checkInstallation
  } = useTLSNotary();

  // Check TLSNotary status on mount
  useEffect(() => {
    checkInstallation();
  }, []);

  const handleGenerateProof = async () => {
    setError(null);
    setStep('proof_generating');

    try {
      // Open UPS tracking page (or any URL)
      const url = 'https://www.ups.com/tracking';
      const proofData = await generateProof(url);
      
      if (!proofData) {
        throw new Error('Failed to generate proof');
      }

      setStep('proof_verifying');
      // Start the dispute resolution with the real proof
      await handleResolveDispute(proofData);

    } catch (err) {
      setError(err.message);
      setStep('idle');
    }
  };

  const handleResolveDispute = async (proofData) => {
    setIsLoading(true);
    setError(null);
    setVerdict(null);

    try {
      setStep('ai_analyzing');
      
      const result = await resolveDispute(
        proofData || {
          url: 'https://www.ups.com/tracking',
          content: 'Status: Delivered | Date: July 15, 2026',
          timestamp: new Date().toISOString(),
          notary_signature: '0x' + 'a'.repeat(64)
        },
        `DISP-${Date.now()}`,
        escrowId,
        buyer,
        seller,
        amount
      );

      setStep('settlement_executing');
      setVerdict(result.verdict_summary);

      if (result.report?.settlement?.success) {
        setStep('complete');
      } else {
        setStep('complete');
      }

    } catch (err) {
      setError(err.message);
      setStep('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockResolve = async () => {
    // Use mock proof when TLSNotary isn't available
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };
    await handleResolveDispute(mockProof);
  };

  // Step indicator
  const StepIndicator = () => {
    const steps = [
      { id: 'idle', label: 'Ready' },
      { id: 'proof_generating', label: '📸 Generating Proof' },
      { id: 'proof_verifying', label: '🔍 Verifying' },
      { id: 'ai_analyzing', label: '🤖 AI Analyzing' },
      { id: 'settlement_executing', label: '💰 Executing' },
      { id: 'complete', label: '✅ Complete' }
    ];

    const currentIndex = steps.findIndex(s => s.id === step);
    const completedIndex = steps.findIndex(s => s.id === 'complete');

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                idx <= currentIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 mx-1 ${
                  idx < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map(s => (
            <span key={s.id} className="text-xs text-gray-500">
              {s.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        ⚖️ Dispute Resolution
      </h2>

      <StepIndicator />

      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded">
          <p><strong>Escrow ID:</strong> {escrowId || 'N/A'}</p>
          <p><strong>Buyer:</strong> {buyer || '0x...'}</p>
          <p><strong>Seller:</strong> {seller || '0x...'}</p>
          <p><strong>Amount:</strong> {amount || '0.5 ETH'}</p>
        </div>

        {/* TLSNotary Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${
            isInstalled ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span>
            {isInstalled ? '✅ TLSNotary ready' : '⚠️ TLSNotary not detected (using mock)'}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleGenerateProof}
            disabled={isLoading || step === 'proof_generating'}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {isLoading ? 'Processing...' : '🔒 Generate zkTLS Proof'}
          </button>

          <button
            onClick={handleMockResolve}
            disabled={isLoading}
            className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition"
          >
            {isLoading ? 'Processing...' : '🧪 Use Mock Proof'}
          </button>
        </div>

        {tlsError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded">
            ⚠️ {tlsError}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded">
            ❌ {error}
          </div>
        )}

        {verdict && (
          <div className="bg-green-100 border border-green-400 text-green-700 p-4 rounded">
            <h3 className="font-bold text-lg">🏆 Verdict</h3>
            <p><strong>Winner:</strong> {verdict.winner}</p>
            <p><strong>Confidence:</strong> {(verdict.confidence * 100).toFixed(1)}%</p>
            <p><strong>Risk Score:</strong> {verdict.risk_score}/100</p>
            {verdict.model_used && (
              <p><strong>Model:</strong> {verdict.model_used}</p>
            )}
            <p className="mt-2 text-sm">
              <strong>Justification:</strong> {verdict.justification}
            </p>
            {verdict.settlement?.success && (
              <p className="mt-2 text-green-700">
                ✅ Settlement executed!
                {verdict.settlement.transaction_hash && (
                  <span className="block text-xs break-all">
                    Tx: {verdict.settlement.transaction_hash}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Progress Log */}
        {isLoading && (
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-600 animate-pulse">
              {step === 'proof_generating' && '📸 Generating cryptographic proof...'}
              {step === 'proof_verifying' && '🔍 Verifying proof authenticity...'}
              {step === 'ai_analyzing' && '🤖 AI agents analyzing evidence...'}
              {step === 'settlement_executing' && '💰 Executing smart contract settlement...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DisputePanel;