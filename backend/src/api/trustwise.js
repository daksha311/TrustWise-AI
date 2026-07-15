// TrustWise AI - Frontend API Client
// Connects your React frontend to the backend API

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Verify zkTLS proof
 */
export const verifyProof = async (proof, disputeId, escrowId, buyer, seller, amount) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/verify/zkproof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof,
        disputeId,
        escrowId,
        buyer,
        seller,
        amount
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify proof');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Proof verification failed:', error);
    throw error;
  }
};

/**
 * Resolve a dispute
 */
export const resolveDispute = async (proof, disputeId, escrowId, buyer, seller, amount) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/dispute/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proof,
        disputeId,
        escrowId,
        buyer,
        seller,
        amount
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resolve dispute');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Dispute resolution failed:', error);
    throw error;
  }
};

/**
 * Get contract status
 */
export const getContractStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/contract/status`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get contract status:', error);
    throw error;
  }
};

/**
 * Get escrow details
 */
export const getEscrow = async (escrowId) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/contract/escrow/${escrowId}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get escrow:', error);
    throw error;
  }
};

/**
 * Health check
 */
export const healthCheck = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Backend health check failed:', error);
    throw error;
  }
};