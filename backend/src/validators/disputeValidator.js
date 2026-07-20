/**
 * TrustWise AI - Dispute Request Validator
 */

const logger = require('../utils/logger');

/**
 * Validates and normalizes incoming dispute payloads.
 * Supports both raw string claims and pre-structured object claims, rejecting blank text.
 * @param {Object} body - The request body from the client.
 * @returns {Object} { valid: boolean, data?: Object, error?: string }
 */
function validateDisputeRequest(body) {
  try {
    if (!body || typeof body !== 'object') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request payload: Body must be an object.' } };
    }

    const requiredFields = [
      'disputeId',
      'escrowId',
      'buyer',
      'seller',
      'buyerClaim',
      'sellerClaim',
      'amount'
    ];
    if (!body.proof && !body.trackingNumber) {
      return {
        valid: false,
        error: { code: 'MISSING_FIELD', message: "Either 'proof' or 'trackingNumber' is required." }
      };
    }

    // Check for missing fields
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return { valid: false, error: { code: 'MISSING_FIELD', message: `Missing required field: '${field}'` } };
      }
    }

    // Basic string & structural validation
    if (body.proof && typeof body.proof !== 'object') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'proof' must be an object." } };
    }
    if (typeof body.disputeId !== 'string' || body.disputeId.trim() === '') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'disputeId' must be a non-empty string." } };
    }
    if (typeof body.escrowId !== 'string' || body.escrowId.trim() === '') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'escrowId' must be a non-empty string." } };
    }

    // Flexible parsing for buyer claim
    let normalizedBuyerClaim = { claim: '' };
    if (typeof body.buyerClaim === 'string') {
      normalizedBuyerClaim.claim = body.buyerClaim.trim();
    } else if (body.buyerClaim && typeof body.buyerClaim === 'object' && typeof body.buyerClaim.claim === 'string') {
      normalizedBuyerClaim.claim = body.buyerClaim.claim.trim();
    } else {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'buyerClaim' must be a string or an object containing a 'claim' string." } };
    }

    // Reject empty or whitespace-only buyer claims
    if (normalizedBuyerClaim.claim === '') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'buyerClaim' cannot be empty or blank text." } };
    }

    // Flexible parsing for seller claim
    let normalizedSellerClaim = { claim: '' };
    if (typeof body.sellerClaim === 'string') {
      normalizedSellerClaim.claim = body.sellerClaim.trim();
    } else if (body.sellerClaim && typeof body.sellerClaim === 'object' && typeof body.sellerClaim.claim === 'string') {
      normalizedSellerClaim.claim = body.sellerClaim.claim.trim();
    } else {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'sellerClaim' must be a string or an object containing a 'claim' string." } };
    }

    // Reject empty or whitespace-only seller claims
    if (normalizedSellerClaim.claim === '') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'sellerClaim' cannot be empty or blank text." } };
    }

    const amountType = typeof body.amount;
    if (amountType !== 'string' && amountType !== 'number') {
      return { valid: false, error: { code: 'INVALID_REQUEST', message: "Field 'amount' must be a string or a numeric value." } };
    }

    const normalizedData = {
      proof: body.proof,
      trackingNumber: body.trackingNumber,
      disputeId: body.disputeId.trim(),
      escrowId: body.escrowId.trim(),
      buyer: typeof body.buyer === 'string' ? body.buyer.trim() : body.buyer,
      seller: typeof body.seller === 'string' ? body.seller.trim() : body.seller,
      buyerClaim: normalizedBuyerClaim,
      sellerClaim: normalizedSellerClaim,
      amount: amountType === 'string'
          ? body.amount.trim()
          : String(body.amount)
  };

    return { valid: true, data: normalizedData };

  } catch (err) {
    logger.error(`❌ Unexpected error in disputeValidator: ${err.message}`);
    return { valid: false, error: { code: 'INTERNAL_ERROR', message: 'Internal validation failure processing parameters.' } };
  }
}

module.exports = {
  validateDisputeRequest
};