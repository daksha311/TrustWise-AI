const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Service for Codex AI Agents integration
 * 
 * This orchestrates the multi-agent pipeline:
 * 1. Evidence Collector (Luna - fast, cheap)
 * 2. Risk Adjudicator (Sol - max reasoning)
 * 3. Settlement Executor (Terra - balanced)
 */
class CodexService {
  constructor() {
    this.apiKey = process.env.CODEX_API_KEY;
    this.agentEndpoint = process.env.CODEX_AGENT_ENDPOINT || 'http://localhost:3001/codex';
    this.sessionId = null;
  }

  /**
   * Start a Codex session (call this once per dispute)
   */
  async startSession(disputeId, context) {
    logger.info(`Starting Codex session for dispute: ${disputeId}`);
    
    this.sessionId = `dispute-${disputeId}-${Date.now()}`;
    
    // Initialize the session in Codex
    // In a real implementation, this would call Codex's API
    // For now, we simulate session creation
    
    return {
      sessionId: this.sessionId,
      status: 'initialized',
      context: context
    };
  }

  /**
   * Agent 1: Evidence Collector (GPT-5.6 Luna - cost efficient)
   * 
   * This agent takes raw evidence from zkTLS and structures it
   * for the adjudicator agent
   */
  async collectEvidence(rawEvidence, disputeType) {
    logger.info('Evidence Collector Agent (Luna) - structuring evidence');
    
    // Prompt engineering for GPT-5.6 Luna
    const structuredEvidence = {
      parties: {
        buyer: rawEvidence.buyer || '0xBuyerAddress',
        seller: rawEvidence.seller || '0xSellerAddress'
      },
      transaction: {
        amount: rawEvidence.amount || '0.5 ETH',
        timestamp: rawEvidence.timestamp || new Date().toISOString(),
        contract: rawEvidence.contractAddress || '0xContractAddress'
      },
      evidence: {
        delivery_status: rawEvidence.delivery_status || 'Delivered',
        delivery_date: rawEvidence.delivery_date || '2026-07-15',
        tracking_id: rawEvidence.tracking_id || '1Z999AA1234567890',
        zktls_verified: true,
        proof_hash: rawEvidence.proof_hash || '0x' + 'a'.repeat(64)
      },
      dispute_type: disputeType || 'delivery_dispute'
    };
    
    logger.info('Evidence collected and structured');
    return structuredEvidence;
  }

  /**
   * Agent 2: Risk Adjudicator (GPT-5.6 Sol - max reasoning)
   * 
   * This is the most critical agent - it analyzes the evidence
   * and generates a verdict with reasoning
   */
  async adjudicateRisk(structuredEvidence) {
    logger.info('Risk Adjudicator Agent (Sol - max reasoning) - analyzing evidence');
    
    // In production, this would call the real GPT-5.6 Sol via Codex
    // We simulate the verdict for the demo
    
    // Analyze the evidence pattern
    const hasValidProof = structuredEvidence.evidence.zktls_verified;
    const deliveryStatus = structuredEvidence.evidence.delivery_status;
    const transactionAmount = parseFloat(structuredEvidence.transaction.amount);
    
    // Simple risk logic
    let riskScore = 50;
    let verdict = 'partial';
    let confidence = 0.75;
    let justification = '';
    
    if (hasValidProof && deliveryStatus === 'Delivered') {
      riskScore = 10; // Low risk - delivery confirmed
      verdict = 'seller_wins';
      confidence = 0.95;
      justification = 'Delivery confirmed via cryptographic proof. Seller provided valid tracking with zkTLS verification.';
    } else if (hasValidProof && deliveryStatus === 'Not Delivered') {
      riskScore = 90; // High risk - no delivery
      verdict = 'buyer_wins';
      confidence = 0.92;
      justification = 'Cryptographic proof shows item was not delivered. Buyer entitled to refund.';
    } else if (!hasValidProof) {
      riskScore = 70; // Medium-high - no cryptographic proof
      verdict = 'partial';
      confidence = 0.65;
      justification = 'Insufficient cryptographic evidence. Additional verification required.';
    }
    
    // Additional logic for amount-based risk
    if (transactionAmount > 1.0) {
      riskScore += 10; // Higher risk for larger amounts
    }
    
    const result = {
      risk_score: Math.min(riskScore, 100),
      verdict: verdict,
      confidence_score: confidence,
      justification: justification,
      key_factors: [
        `zkTLS verification: ${hasValidProof}`,
        `Delivery status: ${deliveryStatus}`,
        `Transaction amount: ${transactionAmount} ETH`
      ],
      model_used: 'GPT-5.6 Sol (max reasoning)',
      timestamp: new Date().toISOString()
    };
    
    logger.info(`Adjudication complete: ${verdict} (confidence: ${confidence})`);
    return result;
  }

  /**
   * Agent 3: Settlement Executor (GPT-5.6 Terra - balanced)
   * 
   * This agent validates the verdict and triggers the smart contract
   */
  async executeSettlement(adjudicationResult, escrowId) {
    logger.info(`Settlement Executor Agent (Terra) - processing escrow ${escrowId}`);
    
    // Validate the adjudication
    if (adjudicationResult.confidence_score < 0.5) {
      return {
        success: false,
        reason: 'Insufficient confidence for settlement',
        adjudication: adjudicationResult
      };
    }
    
    // Determine which party wins
    const verdict = adjudicationResult.verdict;
    let action = 'release_to_seller';
    let winner = '';
    let amount = '0.5 ETH';
    
    if (verdict === 'seller_wins') {
      action = 'release_to_seller';
      winner = 'seller';
    } else if (verdict === 'buyer_wins') {
      action = 'refund_buyer';
      winner = 'buyer';
    } else {
      action = 'partial_release';
      winner = 'split_50_50';
    }
    
    const settlement = {
      success: true,
      escrow_id: escrowId,
      action: action,
      winner: winner,
      amount: amount,
      verdict: verdict,
      proof_hash: '0x' + 'f'.repeat(64),
      timestamp: new Date().toISOString()
    };
    
    // In production, this would call the smart contract
    // For demo, we simulate the transaction
    const txHash = '0x' + 'b'.repeat(64);
    settlement.transaction_hash = txHash;
    
    logger.info(`Settlement executed: ${action} (tx: ${txHash.substring(0, 10)}...)`);
    return settlement;
  }

  /**
   * Full pipeline: Collect → Adjudicate → Execute
   * 
   * This is the main function that orchestrates the entire process
   */
  async runFullPipeline(rawEvidence, disputeId, escrowId) {
    logger.info(`Starting full Codex pipeline for dispute ${disputeId}`);
    
    try {
      // Step 1: Start session
      await this.startSession(disputeId, { type: 'escrow_dispute' });
      
      // Step 2: Collect evidence (Luna)
      const structuredEvidence = await this.collectEvidence(
        rawEvidence,
        'delivery_dispute'
      );
      
      // Step 3: Adjudicate risk (Sol - max reasoning)
      const adjudication = await this.adjudicateRisk(structuredEvidence);
      
      // Step 4: Execute settlement (Terra)
      const settlement = await this.executeSettlement(adjudication, escrowId);
      
      // Step 5: Generate final report
      const report = {
        dispute_id: disputeId,
        escrow_id: escrowId,
        session_id: this.sessionId,
        evidence: structuredEvidence,
        adjudication: adjudication,
        settlement: settlement,
        completed_at: new Date().toISOString()
      };
      
      logger.info('Codex pipeline completed successfully');
      return report;
      
    } catch (error) {
      logger.error(`Pipeline failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CodexService();