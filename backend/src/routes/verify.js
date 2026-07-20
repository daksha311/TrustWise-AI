/**
 * TrustWise AI - Verification Router
 * Path: POST /dispute/resolve
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Core Service Dependencies
const codex = require('../services/codex-real');
const tlsnotary = require('../services/tlsnotary');
const { validateDisputeRequest } = require('../validators/disputeValidator');
const { buildArbitrationContext } = require('../utils/arbitrationContextBuilder');
const trackingFetcher = require('../services/trackingFetcher');
const { success: sendSuccess, error: sendError } = require('../utils/response');

router.post('/dispute/resolve', async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] 📥 Inbound arbitration request received via /dispute/resolve`);

  // 1. Input Layer Validation
  const validation = validateDisputeRequest(req.body);
  if (!validation.valid) {
    const errObj = validation.error || { code: 'INVALID_REQUEST', message: 'Invalid request.' };
    logger.warn(`[${requestId}] ⚠️ Validation Failure: ${errObj.code} - ${errObj.message}`);
    return sendError(res, errObj, 400);
  }

  const { data } = validation;

  try {
    // 2. Deterministic Verification Flow using tlsnotary module
    logger.info(`[${requestId}] 🔐 Executing tlsnotary proof verification for Escrow: ${data.escrowId}`);
    let verificationResult;

    try {

      // -------------------------------
      // Auto-generate proof if frontend sends only trackingNumber
      // -------------------------------
      if (!data.proof && data.trackingNumber) {

        logger.info(
          `[${requestId}] 📦 No proof supplied. Generating zkTLS proof from tracking number: ${data.trackingNumber}`
        );

        const generatedProof = await trackingFetcher.generateProof(data.trackingNumber);

        // Check for an explicit error property (support both string and object forms)
        if (generatedProof && generatedProof.error) {
          const err = typeof generatedProof.error === 'string' ? { code: generatedProof.error, message: generatedProof.message || '' } : generatedProof.error;
          logger.warn(`[${requestId}] 🔍 Tracking fetcher returned error: ${JSON.stringify(err)}`);

          // Map known tracking errors to HTTP status codes
          let status = 503;
          if (err.code === 'INVALID_TRACKING_NUMBER') status = 400;
          else if (err.code === 'TRACKING_PAGE_UNAVAILABLE' || err.code === 'TRACKING_NOT_FOUND') status = 404;
          else if (err.code === 'CARRIER_UNAVAILABLE') status = 503;

          return sendError(res, { code: err.code || 'TRACKING_FETCH_FAILED', message: err.message || 'Tracking fetch failed' }, status);
        }

        data.proof = generatedProof;
      }

      verificationResult =
          await tlsnotary.verifyProof(data.proof);

    } catch (verifierError)  {
      logger.error(`[${requestId}] ❌ Cryptographic Verifier Service Exception: ${verifierError.message}`);
      return sendError(res, { code: 'TLS_VERIFICATION_FAILED', message: 'Cryptographic verifier engine unavailable or failed to run.' }, 503);
    }
    
    // Evaluate verification level directly using your standard system architecture
    if (!verificationResult || verificationResult.verification_level === 'FAILED' || verificationResult.verification_level === 'INVALID') {
      logger.warn(`[${requestId}] ❌ Proof validation rejected (Level: ${verificationResult?.verification_level}) for Escrow: ${data.escrowId}`);

      const proofErr = verificationResult && verificationResult.error ? verificationResult.error : null;
      // MALFORMED_PROOF likely indicates bad client input → 400
      if (proofErr && (proofErr.code === 'MALFORMED_PROOF' || proofErr.code === 'INVALID_PROOF_URL')) {
        return sendError(res, { code: proofErr.code || 'INVALID_REQUEST', message: proofErr.message || 'Malformed proof' }, 400);
      }

      return sendError(res, { code: 'TLS_VERIFICATION_FAILED', message: 'Invalid proof: Cryptographic signature verification or threshold checking failed.' }, 422);
    }

    // 3. Assemble context
    const arbitrationContext = buildArbitrationContext({
      disputeId: data.disputeId,
      escrowId: data.escrowId,
      buyer: data.buyer,
      seller: data.seller,
      buyerClaim: data.buyerClaim,
      sellerClaim: data.sellerClaim,
      amount: data.amount,
      verificationResult: verificationResult
    });

    // 4. Invoke existing codex-real 4-argument method
    logger.info(`[${requestId}] ⚖️ Routing context configurations to single arbitration engine via GitHub Models.`);
    
    const arbitrationResult = await codex.arbitrateDispute(
      arbitrationContext.verifiedEvidence,
      arbitrationContext.buyerClaim,
      arbitrationContext.sellerClaim,
      arbitrationContext.escrowContext
    );

    // 5. Flatten outbound payload to cleanly retain original legacy schema
    return sendSuccess(res, {
      dispute_id: data.disputeId,
      escrow_id: data.escrowId,
      action: arbitrationResult.action,
      confidence: arbitrationResult.confidence,
      explanation: arbitrationResult.explanation,
      reasoning: arbitrationResult.reasoning,
      risk_score: arbitrationResult.risk_score,
      key_evidence: arbitrationResult.key_evidence,
      timestamp: arbitrationResult.timestamp || new Date().toISOString(),
      usage: arbitrationResult.usage || {}
    }, 200);

  } catch (error) {
    logger.error(`[${requestId}] 💥 Exception intercepted in arbitration route: ${error.message}`);
    
    // Parse individual AI service faults back to precise status codes
    const errorString = error.message || '';
    
    if (errorString.includes('Quota Exceeded') || errorString.includes('429')) {
      return sendError(res, { code: 'AI_SERVICE_UNAVAILABLE', message: 'AI provider quota exceeded. Please try again later.' }, 429);
    }

    if (errorString.includes('timeout') || errorString.includes('TIMEOUT') || errorString.includes('timeout')) {
      return sendError(res, { code: 'AI_SERVICE_UNAVAILABLE', message: 'AI service timeout: The provider failed to respond within limits.' }, 503);
    }

    if (errorString.includes('Authentication') || errorString.includes('API key') || errorString.includes('Token')) {
      return sendError(res, { code: 'INTERNAL_ERROR', message: 'Unexpected AI configuration error: Upstream identity rejected.' }, 500);
    }

    // Baseline internal fall-through fallback
    return sendError(res, { code: 'INTERNAL_ERROR', message: 'An internal server error occurred handling your dispute pipeline.' }, 500);
  }
});

module.exports = router;