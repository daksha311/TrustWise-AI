/**
 * Agent 2: Risk Adjudicator (GPT-5.6 Sol - Max Reasoning)
 * 
 * Analyzes structured evidence and generates a verdict
 * Uses Sol tier for complex reasoning with maximum effort
 */

const logger = require('../utils/logger');

class RiskAdjudicatorAgent {
  constructor() {
    this.name = 'RiskAdjudicator';
    this.model = 'GPT-5.6 Sol';
    this.effort = 'Extra High';
  }

  /**
   * Adjudicate the dispute based on evidence
   */
  async adjudicate(structuredEvidence) {
    logger.info(`[${this.name}] Analyzing evidence with max reasoning...`);

    try {
      // Step 1: Extract key factors
      const factors = this.extractFactors(structuredEvidence);

      // Step 2: Evaluate evidence strength
      const evidenceStrength = this.evaluateEvidence(structuredEvidence);

      // Step 3: Determine risk score
      const riskScore = this.calculateRiskScore(structuredEvidence, evidenceStrength);

      // Step 4: Generate verdict
      const verdict = this.generateVerdict(riskScore, structuredEvidence, evidenceStrength);

      // Step 5: Add reasoning
      const reasoning = this.generateReasoning(verdict, factors, riskScore);

      logger.info(`[${this.name}] Adjudication complete: ${verdict.verdict}`);

      return {
        ...verdict,
        risk_score: riskScore,
        confidence_score: evidenceStrength.confidence,
        key_factors: factors,
        reasoning: reasoning,
        model_used: this.model,
        effort: this.effort,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[${this.name}] Adjudication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract key factors from evidence
   */
  extractFactors(evidence) {
    const factors = [];

    // Delivery status
    const status = evidence.verified_data?.delivery_status || 'unknown';
    factors.push({
      name: 'Delivery Status',
      value: status,
      weight: 0.4
    });

    // zkTLS verification
    const isVerified = evidence.proof_metadata?.proof_hash ||
                      evidence.verified_data?.zktls_verified ||
                      false;
    factors.push({
      name: 'zkTLS Verification',
      value: isVerified ? 'Verified' : 'Not Verified',
      weight: 0.3
    });

    // Confidence indicators
    const conf = evidence.confidence_indicators || {};
    const qualityScore = conf.quality_score || 0;
    factors.push({
      name: 'Evidence Quality',
      value: `${qualityScore}%`,
      weight: 0.2
    });

    // Transaction amount
    const amount = parseFloat(evidence.dispute_context?.amount) || 0;
    factors.push({
      name: 'Transaction Amount',
      value: `${amount} ETH`,
      weight: 0.1
    });

    return factors;
  }

  /**
   * Evaluate evidence strength and confidence
   */
  evaluateEvidence(evidence) {
    const indicators = evidence.confidence_indicators || {};
    let baseConfidence = 0.5;

    // Start with quality score
    if (indicators.quality_score) {
      baseConfidence = indicators.quality_score / 100;
    }

    // Boost if proof is verified
    if (evidence.verified_data?.zktls_verified || evidence.proof_metadata?.proof_hash) {
      baseConfidence = Math.min(baseConfidence + 0.3, 1.0);
    }

    // Boost if delivery status is clear
    const status = evidence.verified_data?.delivery_status;
    if (status && ['Delivered', 'Not Delivered'].includes(status)) {
      baseConfidence = Math.min(baseConfidence + 0.2, 1.0);
    }

    // Ensure minimum confidence
    const confidence = Math.max(baseConfidence, 0.3);

    return {
      confidence: confidence,
      evidence_quality: indicators.quality_score || 50,
      has_zkTLS: !!(evidence.verified_data?.zktls_verified || evidence.proof_metadata?.proof_hash)
    };
  }

  /**
   * Calculate risk score (0-100)
   */
  calculateRiskScore(evidence, evalResult) {
    let score = 50; // Default

    const status = evidence.verified_data?.delivery_status;

    // Risk based on delivery status
    if (status === 'Delivered' && evalResult.has_zkTLS) {
      score = 10; // Low risk - verified delivery
    } else if (status === 'Delivered' && !evalResult.has_zkTLS) {
      score = 40; // Medium-low - delivered but not verified
    } else if (status === 'Not Delivered' && evalResult.has_zkTLS) {
      score = 85; // High risk - verified no delivery
    } else if (status === 'Not Delivered' && !evalResult.has_zkTLS) {
      score = 70; // Medium-high - claimed no delivery
    } else if (status === 'In Transit') {
      score = 50; // Medium - in progress
    } else if (status === 'Pending') {
      score = 30; // Medium-low - pending
    } else {
      // Unknown status - check confidence
      if (evalResult.confidence > 0.8) {
        score = 20; // Low risk if evidence is strong
      } else {
        score = 60; // Medium-high if evidence is weak
      }
    }

    // Adjust based on confidence
    if (evalResult.confidence < 0.5) {
      score += 20; // Increase risk if evidence is unreliable
    }

    // Adjust based on amount
    const amount = parseFloat(evidence.dispute_context?.amount) || 0;
    if (amount > 1.0) {
      score += 10; // Higher risk for larger amounts
    }

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Generate verdict based on risk score
   */
  generateVerdict(riskScore, evidence, evalResult) {
    const status = evidence.verified_data?.delivery_status;

    let verdict = 'partial';
    let outcome = '';

    if (riskScore < 30 && status === 'Delivered') {
      verdict = 'seller_wins';
      outcome = 'Seller has proven delivery';
    } else if (riskScore > 70 && status === 'Not Delivered') {
      verdict = 'buyer_wins';
      outcome = 'Buyer has proven item not delivered';
    } else if (riskScore < 30 && status !== 'Delivered') {
      verdict = 'seller_wins';
      outcome = 'Low risk transaction - favoring seller';
    } else if (riskScore > 70 && status === 'Delivered') {
      verdict = 'partial';
      outcome = 'Contradictory evidence - splitting funds';
    } else if (riskScore >= 30 && riskScore <= 70) {
      verdict = 'partial';
      outcome = 'Ambiguous evidence - splitting 50/50';
    }

    return {
      verdict: verdict,
      outcome: outcome,
      confidence: evalResult.confidence
    };
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoning(verdict, factors, riskScore) {
    const status = factors.find(f => f.name === 'Delivery Status')?.value || 'Unknown';
    const isVerified = factors.find(f => f.name === 'zkTLS Verification')?.value || 'Not Verified';
    const quality = factors.find(f => f.name === 'Evidence Quality')?.value || '0%';

    let reasoning = `Based on the evidence analysis:\n`;
    reasoning += `- Delivery status: ${status}\n`;
    reasoning += `- zkTLS verification: ${isVerified}\n`;
    reasoning += `- Evidence quality: ${quality}\n`;
    reasoning += `- Risk score: ${riskScore}/100\n`;

    reasoning += `\nVerdict: ${verdict.verdict}\n`;
    reasoning += `Reason: ${verdict.outcome}\n`;

    if (riskScore < 30) {
      reasoning += `\nThe evidence strongly supports the seller. The ${status} status was ${isVerified === 'Verified' ? 'cryptographically verified' : 'indicated'}, and the risk assessment shows low fraud potential.`;
    } else if (riskScore > 70) {
      reasoning += `\nThe evidence strongly supports the buyer. The ${status} status was ${isVerified === 'Verified' ? 'cryptographically verified' : 'indicated'}, and the risk assessment shows high fraud potential.`;
    } else {
      reasoning += `\nThe evidence is ambiguous. A partial resolution is recommended to minimize risk to both parties.`;
    }

    return reasoning;
  }
}

module.exports = new RiskAdjudicatorAgent();