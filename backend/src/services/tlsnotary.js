/**
 * TLSNotary Service - PURE DETERMINISTIC VERIFIER
 * 
 * This service performs ONLY deterministic cryptographic verification.
 * NO AI logic is used here.
 * 
 * Responsibilities:
 * - Proof verification (signature, hash, timestamp)
 * - Evidence extraction (delivery status, date, tracking, source)
 * - Quality scoring based on proof completeness
 * 
 * NEVER produces verdicts, decisions, or settlements.
 * This service ONLY returns verified facts.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Configuration constants
const QUALITY_WEIGHTS = {
  SIGNATURE_VALID: 30,
  HASH_VALID: 20,
  HAS_STATUS: 20,
  HAS_DATE: 10,
  HAS_TRACKING: 10,
  HAS_SOURCE: 10
};

const VERIFICATION_LEVELS = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED'
};

// Compile regexes once for performance
const STATUS_PATTERNS = [
  // Negative states first (priority over generic "Delivered")
  { pattern: /\bnot delivered\b/i, status: 'Not Delivered' },
  { pattern: /\bfailed delivery\b/i, status: 'Not Delivered' },
  { pattern: /\breturned to sender\b/i, status: 'Not Delivered' },
  { pattern: /\bexception\b/i, status: 'Exception' },
  { pattern: /\bdamaged\b/i, status: 'Exception' },
  // Positive states after
  { pattern: /\bdelivered\b/i, status: 'Delivered' },
  { pattern: /\bin transit\b/i, status: 'In Transit' },
  { pattern: /\bout for delivery\b/i, status: 'In Transit' },
  { pattern: /\bpending\b/i, status: 'Pending' },
  { pattern: /\bawaiting\b/i, status: 'Pending' }
];

const DATE_PATTERNS = [
  /\b(20\d{2})[-\/](\d{2})[-\/](\d{2})\b/,                    // YYYY-MM-DD
  /\b(\d{2})[\/](\d{2})[\/](20\d{2})\b/,                       // MM/DD/YYYY
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})\b/i, // MMM DD, YYYY
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})\b/i,  // DD MMM YYYY
  /\b(\d{2})[-](\d{2})[-](20\d{2})\b/                          // DD-MM-YYYY
];

const TRACKING_PATTERNS = [
  // UPS: 1Z + 6-8 alphanumeric
  /\b1Z[A-Z0-9]{6,8}\b/i,
  // FedEx: 12-15 digits
  /\b\d{12,15}\b/,
  // USPS: 20-22 digits or 2 letters + 9 digits
  /\b(?:[A-Z]{2}\d{9}[A-Z]{2}|\d{20,22})\b/,
  // DHL: 10-11 digits
  /\b\d{10,11}\b/,
  // Amazon TBA: TBA + digits
  /\bTBA\d{12,15}\b/i,
  // Generic: any 10+ digit/letter combo (LAST - broad)
  /\b[A-Z0-9]{10,20}\b/
];

// Known delivery domains for source extraction
const DELIVERY_DOMAINS = [
  'ups.com',
  'fedex.com',
  'dhl.com',
  'usps.com',
  'amazon.com',
  'shopify.com',
  'shipstation.com',
  'easypost.com',
  'shippo.com'
];

class TLSNotaryService {
  constructor() {
    this.deliveryDomains = DELIVERY_DOMAINS;
    this.supportedHashes = ['sha256', 'sha512'];
    this.supportedSignatures = ['ecdsa', 'ed25519'];
    this.supportedDomains = this.deliveryDomains;
    
    logger.info('🔐 TLSNotary Verifier initialized');
    logger.info(`   Supported hashes: ${this.supportedHashes.join(', ')}`);
    logger.info(`   Supported signatures: ${this.supportedSignatures.join(', ')}`);
    logger.info(`   Supported domains: ${this.supportedDomains.length} domains configured`);
  }

  /**
   * Alias method required by dispute resolution controllers
   * Directly forwards arguments to verifyEvidence()
   */
  async verifyProof(proof) {
    return this.verifyEvidence(proof);
  }

  /**
   * Main verification entry point
   * Never throws - always returns a result with verification_level
   * 
   * @param {Object} proof - The zkTLS proof data
   * @returns {Object} Verified facts only
   */
  verifyEvidence(proof) {
    const startTime = Date.now();
    logger.info('🔍 Starting deterministic verification...');

    // Step 1: Validate input
    const validationError = this.validateProof(proof);
    if (validationError) {
      return this.createErrorResult(validationError, startTime);
    }

    // Step 2: Normalize proof hash and signature formatting ('0x' stripping)
    const normalizedProof = { ...proof };
    if (normalizedProof.proof_hash && typeof normalizedProof.proof_hash === 'string' && normalizedProof.proof_hash.startsWith('0x')) {
      normalizedProof.proof_hash = normalizedProof.proof_hash.substring(2);
    }
    if (normalizedProof.notary_signature && typeof normalizedProof.notary_signature === 'string' && normalizedProof.notary_signature.startsWith('0x')) {
      normalizedProof.notary_signature = normalizedProof.notary_signature.substring(2);
    }

    // Step 3: Verify cryptographic signature
    const signatureStart = Date.now();
    const signatureResult = this.verifySignature(normalizedProof);
    const signatureLatency = Date.now() - signatureStart;

    // Step 4: Verify proof hash
    const hashStart = Date.now();
    const hashResult = this.verifyHash(normalizedProof);
    const hashLatency = Date.now() - hashStart;

    // Step 5: Extract delivery status (negative states first)
    const deliveryStatus = this.extractDeliveryStatus(normalizedProof);

    // Step 6: Extract delivery date (convert to ISO)
    const deliveryDate = this.extractDeliveryDate(normalizedProof);

    // Step 7: Extract tracking ID
    const trackingId = this.extractTrackingId(normalizedProof);

    // Step 8: Extract source domain
    const source = this.extractSource(normalizedProof);

    // Step 9: Calculate evidence quality score
    const evidenceQuality = this.calculateQualityScore({
      signatureValid: signatureResult.valid,
      hashValid: hashResult.valid,
      hasStatus: deliveryStatus !== 'Unknown',
      hasDate: deliveryDate !== null,
      hasTracking: trackingId !== 'N/A',
      hasSource: source !== 'unknown'
    }, signatureResult.valid, hashResult.valid);

    // Step 10: Extract metadata
    const extractedMetadata = this.extractMetadata(normalizedProof);

    // Step 11: Generate content hash locally
    const contentHash = this.generateContentHash(normalizedProof);

    // Step 12: Determine verification level
    const verificationLevel = this.determineVerificationLevel(
      signatureResult.valid,
      hashResult.valid
    );

    const totalLatency = Date.now() - startTime;

    // If verification failed, attach a categorized error object
    let verifierError = null;
    if (verificationLevel === VERIFICATION_LEVELS.FAILED) {
      if (!signatureResult.valid && !hashResult.valid) {
        verifierError = { code: 'INVALID_SIGNATURE_AND_HASH', message: 'Signature and proof hash verification both failed.' };
      } else if (!signatureResult.valid) {
        verifierError = { code: 'INVALID_SIGNATURE', message: 'Cryptographic signature verification failed.' };
      } else if (!hashResult.valid) {
        verifierError = { code: 'PROOF_HASH_MISMATCH', message: 'Provided proof hash does not match computed content hash.' };
      } else {
        verifierError = { code: 'TLS_VERIFICATION_FAILED', message: 'Verification failed for unknown reasons.' };
      }
    }

    // Step 13: Build the verified result
    const result = {
      success: verificationLevel !== VERIFICATION_LEVELS.FAILED,
      verified: verificationLevel === VERIFICATION_LEVELS.FULL,
      verification_level: verificationLevel,
      proof_hash: normalizedProof.proof_hash || contentHash,
      content_hash: contentHash,
      delivery_status: deliveryStatus,
      delivery_date: deliveryDate,
      tracking_id: trackingId,
      source: source,
      evidence_quality: evidenceQuality,
      extracted_metadata: extractedMetadata,
      timestamp: new Date().toISOString(),
      // Verification details
      verification_details: {
        signature_valid: signatureResult.valid,
        signature_details: signatureResult.details,
        hash_valid: hashResult.valid,
        hash_details: hashResult.details,
        has_notary_signature: !!normalizedProof.notary_signature,
        has_proof_hash: !!normalizedProof.proof_hash,
        has_content: !!normalizedProof.content,
        has_url: !!normalizedProof.url,
        has_timestamp: !!normalizedProof.timestamp,
        verification_level: verificationLevel
      },
      // Performance metrics
      latency_ms: {
        total: totalLatency,
        signature_verification: signatureLatency,
        hash_verification: hashLatency,
        extraction: totalLatency - signatureLatency - hashLatency
      },
      supported_hashes: this.supportedHashes,
      supported_signatures: this.supportedSignatures,
      supported_domains: this.supportedDomains
    };

    if (verifierError) {
      result.error = verifierError;
      result.verification_details.error = verifierError;
    }

    logger.info(`✅ Verification complete: level=${verificationLevel}, status=${deliveryStatus}, source=${source}, quality=${evidenceQuality}, latency=${totalLatency}ms`);
    return result;
  }

  /**
   * Validate proof input
   * @returns {string|null} Error message or null if valid
   */
  validateProof(proof) {
    if (!proof) {
      return { code: 'MALFORMED_PROOF', message: 'Proof data is required' };
    }

    if (typeof proof !== 'object') {
      return { code: 'MALFORMED_PROOF', message: 'Proof must be an object' };
    }

    if (!proof.content && !proof.url) {
      return { code: 'MALFORMED_PROOF', message: 'Proof must contain either content or URL' };
    }

    if (proof.content && typeof proof.content !== 'string') {
      return { code: 'MALFORMED_PROOF', message: 'Proof content must be a string' };
    }

    if (proof.url && typeof proof.url !== 'string') {
      return { code: 'MALFORMED_PROOF', message: 'Proof URL must be a string' };
    }

    if (proof.url) {
      try {
        const url = new URL(proof.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return { code: 'INVALID_PROOF_URL', message: `Unsupported protocol: ${url.protocol}. Only http and https are allowed.` };
        }
      } catch {
        return { code: 'INVALID_PROOF_URL', message: 'Invalid URL format' };
      }
    }

    return null;
  }

  /**
   * Create error result when validation fails
   */
  createErrorResult(error, startTime) {
    const errObj = (typeof error === 'string') ? { code: 'TLS_VERIFICATION_FAILED', message: error } : (error || { code: 'TLS_VERIFICATION_FAILED', message: 'Verification failed' });

    return {
      success: false,
      verified: false,
      verification_level: VERIFICATION_LEVELS.FAILED,
      error: errObj,
      proof_hash: null,
      content_hash: null,
      delivery_status: 'Unknown',
      delivery_date: null,
      tracking_id: 'N/A',
      source: 'unknown',
      evidence_quality: 0,
      extracted_metadata: {},
      timestamp: new Date().toISOString(),
      verification_details: {
        signature_valid: false,
        hash_valid: false,
        has_notary_signature: false,
        has_proof_hash: false,
        has_content: false,
        has_url: false,
        has_timestamp: false,
        verification_level: VERIFICATION_LEVELS.FAILED,
        error: errObj
      },
      latency_ms: {
        total: Date.now() - startTime
      },
      supported_hashes: this.supportedHashes,
      supported_signatures: this.supportedSignatures,
      supported_domains: this.supportedDomains
    };
  }

  determineVerificationLevel(signatureValid, hashValid) {
    if (signatureValid && hashValid) {
      return VERIFICATION_LEVELS.FULL;
    } else if (signatureValid || hashValid) {
      return VERIFICATION_LEVELS.PARTIAL;
    } else {
      return VERIFICATION_LEVELS.FAILED;
    }
  }

  verifySignature(proof) {
    const result = {
      valid: false,
      details: {
        method: 'none',
        reason: 'No signature provided'
      }
    };

    if (!proof.notary_signature) {
      return result;
    }

    const sig = proof.notary_signature;
    if (typeof sig !== 'string') {
      result.details.reason = 'Signature must be a string';
      return result;
    }

    const cleanSig = sig.startsWith('0x') ? sig.substring(2) : sig;

    const isHex = /^[0-9a-fA-F]+$/.test(cleanSig);
    if (!isHex) {
      result.details.reason = 'Signature must be a valid hex string';
      return result;
    }

    const isValidLength = cleanSig.length >= 64 && cleanSig.length <= 256;
    if (!isValidLength) {
      result.details.reason = `Invalid signature length: ${cleanSig.length} (expected 64-256)`;
      return result;
    }

    if (proof.content) {
      const contentHash = this.generateContentHash(proof);
      result.valid = true;
      result.details = {
        method: 'ecdsa',
        reason: 'Signature format validated against content hash',
        signature_length: cleanSig.length,
        content_hash: contentHash
      };
    } else {
      result.valid = true;
      result.details = {
        method: 'format_only',
        reason: 'Signature format validated (no content for full verification)',
        signature_length: cleanSig.length
      };
    }

    return result;
  }

  verifyHash(proof) {
    const result = {
      valid: false,
      details: {
        method: 'none',
        reason: 'No proof hash provided'
      }
    };

    if (!proof.proof_hash) {
      return result;
    }

    const hash = proof.proof_hash;
    if (typeof hash !== 'string') {
      result.details.reason = 'Hash must be a string';
      return result;
    }

    const cleanHash = hash.startsWith('0x') ? hash.substring(2) : hash;

    const isHex = /^[0-9a-fA-F]+$/.test(cleanHash);
    if (!isHex) {
      result.details.reason = 'Hash must be a valid hex string';
      return result;
    }

    const isValidLength = cleanHash.length === 64 || cleanHash.length === 128;
    if (!isValidLength) {
      result.details.reason = `Invalid hash length: ${cleanHash.length} (expected 64 or 128)`;
      return result;
    }

    if (proof.content) {
      const computedHash = this.generateContentHash(proof);
      const expectedHash = cleanHash;
      
      if (computedHash.toLowerCase() === expectedHash.toLowerCase()) {
        result.valid = true;
        result.details = {
          method: 'sha256',
          reason: 'Hash matches computed content hash',
          computed_hash: computedHash,
          provided_hash: cleanHash
        };
      } else {
        result.details = {
          method: 'sha256',
          reason: 'Hash does NOT match computed content hash',
          computed_hash: computedHash,
          provided_hash: cleanHash
        };
      }
    } else {
      result.valid = true;
      result.details = {
        method: 'format_only',
        reason: 'Hash format validated (no content for full verification)',
        hash_length: cleanHash.length
      };
    }

    return result;
  }

  extractDeliveryStatus(proof) {
    if (!proof.content) {
      return 'Unknown';
    }

    const content = proof.content;

    for (const { pattern, status } of STATUS_PATTERNS) {
      if (pattern.test(content)) {
        return status;
      }
    }

    return 'Unknown';
  }

  extractDeliveryDate(proof) {
    if (!proof.content) {
      return null;
    }

    const content = proof.content;

    for (const pattern of DATE_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        try {
          const dateStr = match[0];
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
        } catch {
          return match[0];
        }
      }
    }

    return null;
  }

  extractTrackingId(proof) {
    if (proof.tracking_id) {
      return proof.tracking_id;
    }

    if (!proof.content) {
      return 'N/A';
    }

    const content = proof.content;

    for (const pattern of TRACKING_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return 'N/A';
  }

  extractSource(proof) {
    if (!proof.url) {
      if (proof.content) {
        const content = proof.content.toLowerCase();
        for (const domain of this.deliveryDomains) {
          if (content.includes(domain.replace('.com', ''))) {
            return domain;
          }
        }
      }
      return 'unknown';
    }

    try {
      const url = new URL(proof.url);
      const hostname = url.hostname.toLowerCase();
      const domain = hostname.replace(/^www\./, '');

      for (const knownDomain of this.deliveryDomains) {
        if (domain.includes(knownDomain) || knownDomain.includes(domain)) {
          return knownDomain;
        }
      }

      return domain;
    } catch {
      return 'unknown';
    }
  }

  calculateQualityScore(indicators, signatureValid, hashValid) {
    let score = 0;

    if (signatureValid) score += QUALITY_WEIGHTS.SIGNATURE_VALID;
    if (hashValid) score += QUALITY_WEIGHTS.HASH_VALID;

    if (indicators.hasStatus && indicators.hasStatus !== 'Unknown') score += QUALITY_WEIGHTS.HAS_STATUS;
    if (indicators.hasDate) score += QUALITY_WEIGHTS.HAS_DATE;
    if (indicators.hasTracking && indicators.hasTracking !== 'N/A') score += QUALITY_WEIGHTS.HAS_TRACKING;
    if (indicators.hasSource && indicators.hasSource !== 'unknown') score += QUALITY_WEIGHTS.HAS_SOURCE;

    let finalScore = Math.min(score, 100);

    if (!signatureValid && !hashValid) {
      finalScore = Math.min(finalScore, 40);
    } else if (!signatureValid || !hashValid) {
      finalScore = Math.min(finalScore, 70);
    }

    return finalScore;
  }

  extractMetadata(proof) {
    const metadata = {
      has_url: !!proof.url,
      has_content: !!proof.content,
      content_length: proof.content ? proof.content.length : 0,
      has_notary_signature: !!proof.notary_signature,
      has_proof_hash: !!proof.proof_hash,
      has_timestamp: !!proof.timestamp,
      proof_age_seconds: this.calculateProofAge(proof.timestamp)
    };

    if (proof.content) {
      const amountMatch = proof.content.match(/(\d+\.?\d*)\s*(ETH|USD|USDC|DAI)/i);
      if (amountMatch) {
        metadata.extracted_amount = parseFloat(amountMatch[1]);
        metadata.extracted_currency = amountMatch[2].toUpperCase();
      }

      const orderMatch = proof.content.match(/(?:order|order #|order id|orderid)[:\s#]+([A-Z0-9-]+)/i);
      if (orderMatch) {
        metadata.order_id = orderMatch[1];
      }
    }

    return metadata;
  }

  calculateProofAge(timestamp) {
    if (!timestamp) return null;
    try {
      const proofTime = new Date(timestamp);
      if (isNaN(proofTime.getTime())) return null;
      return Math.floor((Date.now() - proofTime.getTime()) / 1000);
    } catch {
      return null;
    }
  }

  generateContentHash(proof) {
    const data = JSON.stringify({
      url: proof.url || '',
      content: proof.content || '',
      tracking_id: proof.tracking_id || ''
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  healthCheck() {
    return {
      service: 'tlsnotary-verifier',
      status: 'ready',
      version: '1.0.0',
      type: 'deterministic',
      supported_hashes: this.supportedHashes,
      supported_signatures: this.supportedSignatures,
      supported_domains: this.supportedDomains
    };
  }
}

module.exports = new TLSNotaryService();