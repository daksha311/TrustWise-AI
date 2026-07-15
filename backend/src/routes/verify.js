const express = require('express');
const router = express.Router();
const tlsnotary = require('../services/tlsnotary');
const codex = require('../services/codex');
const contract = require('../services/contract');
const logger = require('../utils/logger');

/**
 * POST /api/verify/zkproof
 * 
 * Verifies a zkTLS proof and extracts the evidence data
 */
router.post('/zkproof', async (req, res) => {
  try {
    const { proof, disputeId, escrowId } = req.body;
    
    if (!proof) {
      return res.status(400).json({
        success: false,
        error: 'Missing proof data'
      });
    }
    
    logger.info(`Verifying zkTLS proof for dispute: ${disputeId}`);
    
    // Verify the cryptographic proof
    const verificationResult = await tlsnotary.verifyEvidence(proof);
    
    if (!verificationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'Proof verification failed',
        details: verificationResult
      });
    }
    
    // Extract the verified data
    const evidenceData = {
      delivery_status: verificationResult.data.status,
      delivery_date: verificationResult.data.date,
      proof_hash: verificationResult.proof_hash,
      zktls_verified: true,
      buyer: req.body.buyer || '0xBuyerAddress',
      seller: req.body.seller || '0xSellerAddress',
      amount: req.body.amount || '0.5 ETH',
      contractAddress: req.body.contractAddress || process.env.CONTRACT_ADDRESS
    };
    
    res.json({
      success: true,
      verified: true,
      evidence: evidenceData,
      verification_details: verificationResult
    });
    
  } catch (error) {
    logger.error(`Error in /zkproof: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/dispute/resolve
 * 
 * Full dispute resolution pipeline
 */
router.post('/resolve', async (req, res) => {
  try {
    const { proof, disputeId, escrowId, buyer, seller, amount } = req.body;
    
    if (!proof || !disputeId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: proof, disputeId'
      });
    }
    
    logger.info(`Starting dispute resolution for: ${disputeId}`);
    
    // Step 1: Verify evidence
    const verificationResult = await tlsnotary.verifyEvidence(proof);
    
    if (!verificationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'Evidence verification failed',
        details: verificationResult
      });
    }
    
    // Step 2: Prepare evidence for Codex
    const rawEvidence = {
      delivery_status: verificationResult.data.status,
      delivery_date: verificationResult.data.date,
      proof_hash: verificationResult.proof_hash,
      buyer: buyer || '0xBuyerAddress',
      seller: seller || '0xSellerAddress',
      amount: amount || '0.5 ETH',
      contractAddress: req.body.contractAddress || process.env.CONTRACT_ADDRESS
    };
    
    // Step 3: Run Codex pipeline
    const report = await codex.runFullPipeline(
      rawEvidence,
      disputeId,
      escrowId || 'ESCROW-001'
    );
    
    // Step 4: Execute settlement via smart contract
    let settlementResult = null;
    if (report.adjudication.verdict === 'seller_wins') {
      settlementResult = await contract.releaseFunds(escrowId, report.adjudication.proof_hash);
    } else if (report.adjudication.verdict === 'buyer_wins') {
      settlementResult = await contract.refundFunds(escrowId);
    } else {
      // Partial - send to frontend for manual resolution
      settlementResult = {
        success: true,
        requiresUserSignature: true,
        action: 'partial',
        message: 'Dispute requires manual review'
      };
    }
    
    res.json({
      success: true,
      dispute_resolved: true,
      report: report,
      settlement: settlementResult,
      verdict_summary: {
        winner: report.adjudication.verdict,
        confidence: report.adjudication.confidence_score,
        justification: report.adjudication.justification,
        risk_score: report.adjudication.risk_score
      }
    });
    
  } catch (error) {
    logger.error(`Error in /resolve: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/contract/status
 * 
 * Get contract status and escrow details
 */
router.get('/contract/status', async (req, res) => {
  try {
    const health = await contract.healthCheck();
    res.json({
      success: true,
      contract: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/contract/escrow/:id
 * 
 * Get escrow details
 */
router.get('/contract/escrow/:id', async (req, res) => {
  try {
    const escrow = await contract.getEscrow(req.params.id);
    res.json({
      success: true,
      escrow: escrow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      tlsnotary: 'ready',
      codex: 'ready',
      contract: process.env.CONTRACT_ADDRESS ? 'connected' : 'not configured'
    }
  });
});

module.exports = router;