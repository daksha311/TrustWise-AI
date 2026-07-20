/**
 * Codex Service - 3-Agent Pipeline
 * 
 * Orchestrates the three agents:
 * 1. Evidence Collector (Luna)
 * 2. Risk Adjudicator (Sol)
 * 3. Settlement Executor (Terra)
 */

const evidenceCollector = require('../agents/evidenceCollector');
const riskAdjudicator = require('../agents/riskAdjudicator');
const settlementExecutor = require('../agents/settlementExecutor');
const logger = require('../utils/logger');

class CodexService {
  constructor() {
    this.sessionId = null;
    this.pipelineId = null;
  }

  /**
   * Start a Codex session
   */
  async startSession(disputeId, context) {
    logger.info(`Starting Codex session for dispute: ${disputeId}`);
    
    this.sessionId = `codex-${disputeId}-${Date.now()}`;
    this.pipelineId = `pipeline-${disputeId}`;
    
    return {
      sessionId: this.sessionId,
      pipelineId: this.pipelineId,
      status: 'initialized',
      context: context
    };
  }

  /**
   * Run the full 3-agent pipeline
   */
  async runFullPipeline(rawEvidence, disputeId, escrowId) {
    logger.info(`Starting Codex pipeline for dispute ${disputeId}`);

    const startTime = Date.now();

    try {
      // Step 1: Start session
      const session = await this.startSession(disputeId, {
        type: 'escrow_dispute',
        escrowId: escrowId
      });

      // Step 2: Agent 1 - Evidence Collector (Luna)
      logger.info('Agent 1: Evidence Collector (Luna - Light effort)');
      const structuredEvidence = await evidenceCollector.collect(
        rawEvidence,
        {
          disputeId: disputeId,
          escrowId: escrowId,
          buyer: rawEvidence.buyer || '0xBuyerAddress',
          seller: rawEvidence.seller || '0xSellerAddress',
          amount: rawEvidence.amount || '0 ETH'
        }
      );

      // Step 3: Agent 2 - Risk Adjudicator (Sol - Max reasoning)
      logger.info('Agent 2: Risk Adjudicator (Sol - Extra High effort)');
      const adjudication = await riskAdjudicator.adjudicate(structuredEvidence);

      // Step 4: Agent 3 - Settlement Executor (Terra)
      logger.info('Agent 3: Settlement Executor (Terra - High effort)');
      const settlement = await settlementExecutor.execute(adjudication, escrowId);

      // Step 5: Generate final report
      const report = {
        dispute_id: disputeId,
        escrow_id: escrowId,
        session_id: this.sessionId,
        pipeline_id: this.pipelineId,
        execution_time_ms: Date.now() - startTime,
        agents_used: {
          evidence_collector: evidenceCollector.model,
          risk_adjudicator: riskAdjudicator.model,
          settlement_executor: settlementExecutor.model
        },
        evidence: structuredEvidence,
        adjudication: adjudication,
        settlement: settlement,
        completed_at: new Date().toISOString()
      };

      logger.info(`Codex pipeline completed in ${report.execution_time_ms}ms`);
      return report;

    } catch (error) {
      logger.error(`Pipeline failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Individual agent calls (for testing)
   */
  async collectEvidenceOnly(rawEvidence, disputeContext) {
    return await evidenceCollector.collect(rawEvidence, disputeContext);
  }

  async adjudicateOnly(structuredEvidence) {
    return await riskAdjudicator.adjudicate(structuredEvidence);
  }

  async executeOnly(adjudication, escrowId) {
    return await settlementExecutor.execute(adjudication, escrowId);
  }
}

module.exports = new CodexService();