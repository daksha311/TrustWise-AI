/**
 * TrustWise AI - Arbitration Context Builder
 */

/**
 * Maps tlsnotary outputs and normalized claims into the correct shapes expected by codex-real.js
 */
function buildArbitrationContext({
  disputeId,
  escrowId,
  buyer,
  seller,
  buyerClaim,   // Normalized object { claim: "..." }
  sellerClaim,  // Normalized object { claim: "..." }
  amount,
  verificationResult
}) {
  
  // Compute zktls_verified safely based on successful levels (non-FAILED variants like FULL or PARTIAL)
  const isLevelValid = verificationResult?.verification_level && verificationResult.verification_level !== 'FAILED';
  const zktlsVerified = !!(isLevelValid && verificationResult.verification_level !== 'INVALID');

  // Extract quality metrics cleanly fallback-checking actual known signatures
  const resolvedQuality = 
    verificationResult?.quality_score !== undefined ? verificationResult.quality_score :
    (verificationResult?.evidence_quality !== undefined ? verificationResult.evidence_quality : 50);

  // Build verifiedEvidence mapping directly to codex-real.js structure constraints
  const verifiedEvidence = {
    delivery_status: verificationResult?.delivery_status || 'unknown',
    tracking_id: verificationResult?.tracking_id || 'N/A',
    delivery_date: verificationResult?.delivery_date || null,
    proof_hash: verificationResult?.proof_hash || 'N/A',
    zktls_verified: zktlsVerified,
    source: verificationResult?.source || 'unknown',
    confidence_indicators: {
      quality_score: resolvedQuality
    }
  };

  const targetBuyerClaim = {
    claim: buyerClaim.claim,
    buyer_identity: buyer
  };

  const targetSellerClaim = {
    claim: sellerClaim.claim,
    seller_identity: seller,
    tracking: verificationResult?.tracking_id || 'N/A'
  };

  const escrowContext = {
    escrow_id: escrowId,
    dispute_id: disputeId,
    amount: amount
  };

  return {
    verifiedEvidence,
    buyerClaim: targetBuyerClaim,
    sellerClaim: targetSellerClaim,
    escrowContext
  };
}

module.exports = {
  buildArbitrationContext
};