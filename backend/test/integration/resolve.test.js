const request = require('supertest');
const app = require('../../src/index');
const crypto = require('crypto');

function buildProofPayload() {
  const data = { url: 'https://demo', content: 'Status: Delivered | Date: 2026-07-15 | Tracking: PROOF123 | Carrier: demo', tracking_id: 'PROOF123' };
  const proof_hash = crypto.createHash('sha256').update(JSON.stringify({ url: data.url, content: data.content, tracking_id: data.tracking_id })).digest('hex');
  const sig = crypto.createHash('sha256').update(proof_hash + ':partA').digest('hex') + crypto.createHash('sha256').update(proof_hash + ':partB').digest('hex');
  return {
    proof: {
      url: data.url,
      content: data.content,
      tracking_id: data.tracking_id,
      notary_signature: sig,
      proof_hash: proof_hash,
      timestamp: new Date().toISOString()
    },
    disputeId: 'TEST_PROOF',
    escrowId: 'TEST_ESCROW',
    buyer: 'buyer@example.com',
    seller: 'seller@example.com',
    buyerClaim: 'I received it',
    sellerClaim: 'I shipped it',
    amount: '10'
  };
}

describe('/api/dispute/resolve integration', () => {
  jest.setTimeout(20000);

  test('Valid request with trackingNumber returns 200 and success', async () => {
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send({ trackingNumber: '1Z12345E0205271688', disputeId: 'INT1', escrowId: 'EINT1', buyer: 'b@e.com', seller: 's@e.com', buyerClaim: 'x', sellerClaim: 'y', amount: '10' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('action');
  });

  test('Missing required fields returns 400 with standardized error', async () => {
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send({ escrowId: 'E' })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  test('Invalid tracking number returns 400 with INVALID_TRACKING_NUMBER', async () => {
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send({ trackingNumber: 'UNKNOWN123', disputeId: 'IV1', escrowId: 'EIV', buyer: 'b@e.com', seller: 's@e.com', buyerClaim: 'x', sellerClaim: 'y', amount: '10' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TRACKING_NUMBER');
  });

  test('Malformed request returns 400 validation error', async () => {
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send({ trackingNumber: '1Z12345E0205271688', disputeId: 'BAD1', escrowId: 'EBAD', buyer: 'b@e.com', seller: 's@e.com', buyerClaim: '', sellerClaim: 'y', amount: {} });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBeDefined();
  });

  test('Backward compatibility: proof-based request works', async () => {
    const payload = buildProofPayload();
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send(payload)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('TLS verifier failure returns 422 TLS_VERIFICATION_FAILED', async () => {
    const payload = buildProofPayload();
    // tamper hash/signature
    payload.proof.proof_hash = 'deadbeef';
    payload.proof.notary_signature = 'zzzz';

    const res = await request(app)
      .post('/api/dispute/resolve')
      .send(payload);

    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TLS_VERIFICATION_FAILED');
  });

  test('AI service failure returns 503 AI_SERVICE_UNAVAILABLE', async () => {
    const res = await request(app)
      .post('/api/dispute/resolve')
      .send({ trackingNumber: '1Z12345E0205271688', disputeId: 'AI_FAIL', escrowId: 'FORCE_AI_FAIL', buyer: 'b@e.com', seller: 's@e.com', buyerClaim: 'x', sellerClaim: 'y', amount: '10' });

    expect(res.statusCode).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
  });

  test('Response format consistency: success and error shapes', async () => {
    const ok = await request(app)
      .post('/api/dispute/resolve')
      .send({ trackingNumber: '1Z12345E0205271688', disputeId: 'CF1', escrowId: 'CF1', buyer: 'b@e.com', seller: 's@e.com', buyerClaim: 'x', sellerClaim: 'y', amount: '10' });

    expect(ok.body).toHaveProperty('success');

    const bad = await request(app)
      .post('/api/dispute/resolve')
      .send({});

    expect(bad.body).toHaveProperty('success', false);
    expect(bad.body).toHaveProperty('error');
    expect(typeof bad.body.error.code).toBe('string');
    expect(typeof bad.body.error.message).toBe('string');
  });
});
