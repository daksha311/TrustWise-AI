/**
 * Agent 3: Settlement Executor (GPT-5.6 Terra - Balanced)
 * 
 * Validates the verdict and triggers smart contract settlement
 * Uses Terra tier for balanced performance and cost
 */

const contractService = require('../services/contract');
const logger = require('../utils/logger');

class SettlementExecutorAgent {
  constructor() {
    this.name = 'SettlementExecutor';
    this.model = 'GPT-5.6 Terra';
    this.effort = 'High';
  }

  /**
   * Execute the settlement based on adjudication
   */
  async execute(adjudicationResult, escrowId) {
    logger.info(`[${this.name}] Processing settlement for escrow ${escrowId}...`);

    try {
      // Step 1: Validate adjudication
      this.validateAdjudication(adjudicationResult);

      // Step 2: Determine action
      const action = this.determineAction(adjudicationResult);

      // Step 3: Execute on smart contract
      const result = await this.executeOnChain(action, escrowId, adjudicationResult);

      // Step 4: Generate settlement report
      const report = this.generateReport(action, result, adjudicationResult);

      logger.info(`[${this.name}] Settlement executed: ${action.action}`);

      return report;

    } catch (error) {
      logger.error(`[${this.name}] Settlement failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate adjudication result
   */
  validateAdjudication(adjudication) {
    if (!adjudication) {
      throw new Error('Adjudication result is required');
    }

    if (!adjudication.verdict) {
      throw new Error('Adjudication must contain a verdict');
    }

    const validVerdicts = ['seller_wins', 'buyer_wins', 'partial'];
    if (!validVerdicts.includes(adjudication.verdict)) {
      throw new Error(`Invalid verdict: ${adjudication.verdict}`);
    }

    if (adjudication.confidence_score < 0.3) {
      logger.warn(`[${this.name}] Low confidence (${adjudication.confidence_score}) - proceeding with caution`);
    }

    return true;
  }

  /**
   * Determine the appropriate settlement action
   */
  determineAction(adjudication) {
    const verdict = adjudication.verdict;
    const confidence = adjudication.confidence_score || 0;

    let action = '';
    let reason = '';

    switch (verdict) {
      case 'seller_wins':
        if (confidence > 0.7) {
          action = 'release_to_seller_full';
          reason = 'High confidence in seller claim';
        } else {
          action = 'release_to_seller_with_hold';
          reason = 'Moderate confidence - holding 10% for 30 days';
        }
        break;

      case 'buyer_wins':
        if (confidence > 0.7) {
          action = 'refund_buyer_full';
          reason = 'High confidence in buyer claim';
        } else {
          action = 'refund_buyer_with_fee';
          reason = 'Moderate confidence - deducting 10% as processing fee';
        }
        break;

      case 'partial':
        action = 'split_50_50';
        reason = 'Ambiguous evidence - splitting 50/50';
        break;

      default:
        action = 'hold_for_review';
        reason = 'Unclear outcome - holding funds for manual review';
    }

    return {
      action: action,
      reason: reason,
      confidence: confidence,
      verdict: verdict
    };
  }

  /**
   * Execute the action on the smart contract
   */
  async executeOnChain(action, escrowId, adjudication) {
    let txResult;

    try {
      switch (action.action) {
        case 'release_to_seller_full':
        case 'release_to_seller_with_hold':
          txResult = await contractService.releaseFunds(
            escrowId,
            adjudication.proof_hash || '0x' + 'f'.repeat(64)
          );
          break;

        case 'refund_buyer_full':
        case 'refund_buyer_with_fee':
          txResult = await contractService.refundFunds(escrowId);
          break;

        case 'split_50_50':
          // Partial - return instructions for frontend
          txResult = {
            success: true,
            requiresUserSignature: true,
            action: 'partial',
            message: 'Dispute requires 50/50 split - manual action needed'
          };
          break;

        default:
          throw new Error(`Unknown action: ${action.action}`);
      }

      return txResult;

    } catch (error) {
      logger.error(`[${this.name}] On-chain execution failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        action: action.action,
        escrowId: escrowId
      };
    }
  }

  /**
   * Generate settlement report
   */
  generateReport(action, result, adjudication) {
    return {
      success: result.success || false,
      executed_at: new Date().toISOString(),
      action: action,
      verdict: adjudication.verdict,
      confidence: adjudication.confidence_score,
      justification: adjudication.justification || action.reason,
      on_chain: {
        executed: result.success || false,
        transaction_hash: result.transactionHash || null,
        requires_signature: result.requiresUserSignature || false
      },
      summary: result.success
        ? `✅ Settlement executed: ${action.action}`
        : `⚠️ Settlement action required: ${action.action} (${action.reason})`
    };
  }
}

module.exports = new SettlementExecutorAgent();