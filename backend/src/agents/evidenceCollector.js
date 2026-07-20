/**
 * Agent 1: Evidence Collector (GPT-5.6 Luna - Fast & Cost-Efficient)
 * 
 * Takes raw zkTLS proof data and structures it for the adjudicator agent
 * Uses Luna tier for high-volume, low-cost processing
 */

const logger = require('../utils/logger');

class EvidenceCollectorAgent {
  constructor() {
    this.name = 'EvidenceCollector';
    this.model = 'GPT-5.6 Luna';
    this.effort = 'Light';
  }

  /**
   * Collect and structure evidence from zkTLS proof
   */
  async collect(rawProof, disputeContext) {
    logger.info(`[${this.name}] Collecting evidence from zkTLS proof...`);

    try {
      // Step 1: Validate the proof has required fields
      this.validateProof(rawProof);

      // Step 2: Extract relevant data from proof
      const extractedData = this.extractData(rawProof);

      // Step 3: Structure evidence for the adjudicator
      const structuredEvidence = {
        proof_metadata: {
          url: rawProof.url || 'unknown',
          timestamp: rawProof.timestamp || new Date().toISOString(),
          proof_hash: rawProof.proof_hash || rawProof.notary_signature?.substring(0, 20) || 'unknown'
        },
        verified_data: extractedData,
        dispute_context: {
          dispute_id: disputeContext.disputeId || 'unknown',
          escrow_id: disputeContext.escrowId || 'unknown',
          buyer: disputeContext.buyer || '0x...',
          seller: disputeContext.seller || '0x...',
          amount: disputeContext.amount || '0 ETH'
        },
        confidence_indicators: this.calculateConfidence(rawProof)
      };

      logger.info(`[${this.name}] Evidence collected successfully`);
      return structuredEvidence;

    } catch (error) {
      logger.error(`[${this.name}] Collection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate the proof structure
   */
  validateProof(proof) {
    if (!proof) {
      throw new Error('Proof data is required');
    }

    if (!proof.url && !proof.content) {
      throw new Error('Proof must contain url or content');
    }

    // Check for required fields based on proof type
    if (proof.content) {
      // Content-based proof (mock or real)
      return;
    }

    if (proof.notary_signature) {
      // TLSNotary real proof - has notary signature
      return;
    }

    // Allow any proof format - validation is handled by the verifier
    logger.debug(`[${this.name}] Proof validation passed (format: ${Object.keys(proof).join(', ')})`);
  }

  /**
   * Extract data from the proof
   */
  extractData(proof) {
    const data = {
      delivery_status: 'unknown',
      delivery_date: null,
      tracking_id: null,
      source: proof.url || 'unknown'
    };

    // If proof has content, try to parse it
    if (proof.content) {
      const content = proof.content.toLowerCase();

      // Look for delivery status patterns
      if (content.includes('delivered')) {
        data.delivery_status = 'Delivered';
      } else if (content.includes('in transit')) {
        data.delivery_status = 'In Transit';
      } else if (content.includes('pending')) {
        data.delivery_status = 'Pending';
      } else if (content.includes('not delivered') || content.includes('exception')) {
        data.delivery_status = 'Not Delivered';
      }

      // Extract date patterns
      const dateMatch = proof.content.match(/\d{4}-\d{2}-\d{2}/) || 
                       proof.content.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (dateMatch) {
        data.delivery_date = dateMatch[0];
      }

      // Extract tracking number patterns
      const trackingMatch = proof.content.match(/[A-Z0-9]{10,20}/);
      if (trackingMatch) {
        data.tracking_id = trackingMatch[0];
      }

      // If proof has URL, parse domain
      if (proof.url) {
        try {
          const url = new URL(proof.url);
          data.source = url.hostname.replace('www.', '');
        } catch {
          // URL parsing failed, keep original
        }
      }
    }

    // If proof has a notary signature, it's a real TLSNotary proof
    if (proof.notary_signature) {
      data.zktls_verified = true;
      data.proof_type = 'tlsnotary_real';
    } else {
      data.zktls_verified = false;
      data.proof_type = 'mock_or_unknown';
    }

    return data;
  }

  /**
   * Calculate confidence indicators based on proof quality
   */
  calculateConfidence(proof) {
    const indicators = {
      has_url: !!proof.url,
      has_signature: !!proof.notary_signature,
      has_timestamp: !!proof.timestamp,
      has_content: !!proof.content,
      quality_score: 0
    };

    let score = 0;
    if (indicators.has_url) score += 20;
    if (indicators.has_signature) score += 30; // Real TLSNotary proof
    if (indicators.has_timestamp) score += 20;
    if (indicators.has_content) {
      // Check content quality
      const contentLength = proof.content?.length || 0;
      if (contentLength > 100) score += 30;
      else if (contentLength > 20) score += 15;
      else score += 5;
    }

    indicators.quality_score = Math.min(score, 100);

    // Add explanation
    indicators.explanation = this.getQualityExplanation(score);

    return indicators;
  }

  getQualityExplanation(score) {
    if (score >= 80) return 'High quality zkTLS proof with complete data';
    if (score >= 50) return 'Medium quality proof - some data may be missing';
    return 'Low quality proof - consider requesting additional verification';
  }
}

module.exports = new EvidenceCollectorAgent();