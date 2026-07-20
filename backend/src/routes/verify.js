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

router.post('/dispute/resolve', async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  logger.info(`[${requestId}] 📥 Inbound arbitration request received via /dispute/resolve`);

  // 1. Input Layer Validation
  const validation = validateDisputeRequest(req.body);
  if (!validation.valid) {
    logger.warn(`[${requestId}] ⚠️ Validation Failure: ${validation.error}`);
    return res.status(400).json({ success: false, error: validation.error });
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

        const generatedProof =
          await trackingFetcher.generateProof(data.trackingNumber);

        // Fixed: Check for an explicit error property rather than checking !generatedProof.success
        if (generatedProof && generatedProof.error) {
          return res.status(422).json({
            success: false,
            error: generatedProof.error,
            message: generatedProof.message || 'Tracking page unavailable or failed to process.'
          });
        }

        data.proof = generatedProof;
      }

      verificationResult =
          await tlsnotary.verifyProof(data.proof);

    } catch (verifierError)  {
      logger.error(`[${requestId}] ❌ Cryptographic Verifier Service Exception: ${verifierError.message}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Internal verifier engine failure: Unable to compute or decode zkTLS proof components.' 
      });
    }
    
    // Evaluate verification level directly using your standard system architecture
    if (!verificationResult || verificationResult.verification_level === 'FAILED' || verificationResult.verification_level === 'INVALID') {
      logger.warn(`[${requestId}] ❌ Proof validation rejected (Level: ${verificationResult?.verification_level}) for Escrow: ${data.escrowId}`);
      return res.status(422).json({
        success: false,
        error: 'Invalid proof: Cryptographic signature verification or threshold checking failed.'
      });
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
    return res.status(200).json({
      success: true,
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
    });

  } catch (error) {
    logger.error(`[${requestId}] 💥 Exception intercepted in arbitration route: ${error.message}`);
    
    // Parse individual AI service faults back to precise status codes
    const errorString = error.message || '';
    
    if (errorString.includes('Quota Exceeded') || errorString.includes('429')) {
      return res.status(429).json({ success: false, error: 'AI provider quota exceeded. Please try again later.' });
    }
    
    if (errorString.includes('timeout') || errorString.includes('TIMEOUT')) {
      return res.status(503).json({ success: false, error: 'AI service timeout: The provider failed to respond within limits.' });
    }
    
    if (errorString.includes('Authentication') || errorString.includes('API key') || errorString.includes('Token')) {
      return res.status(500).json({ success: false, error: 'Unexpected AI configuration error: Upstream identity rejected.' });
    }

    // Baseline internal fall-through fallback
    return res.status(500).json({
      success: false,
      error: 'An internal server error occurred handling your dispute pipeline.',
      details: error.message
    });
  }
});

module.exports = router;