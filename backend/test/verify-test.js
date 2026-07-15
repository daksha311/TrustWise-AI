// Quick test script to verify your backend works
// Run with: npm test

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testVerification() {
  console.log('🧪 Testing TrustWise Backend...\n');
  
  // Test 1: Health check
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: zkTLS proof verification
  try {
    const testProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };
    
    const verifyResponse = await axios.post(`${BASE_URL}/api/verify/zkproof`, {
      proof: testProof,
      disputeId: 'TEST-001',
      buyer: '0xBuyer123',
      seller: '0xSeller456',
      amount: '0.5 ETH'
    });
    
    console.log('✅ zkTLS verification passed:', verifyResponse.data);
  } catch (error) {
    console.log('❌ zkTLS verification failed:', error.response?.data || error.message);
  }
  
  // Test 3: Full dispute resolution
  try {
    const testProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };
    
    const resolveResponse = await axios.post(`${BASE_URL}/api/dispute/resolve`, {
      proof: testProof,
      disputeId: 'TEST-002',
      escrowId: 'ESCROW-001',
      buyer: '0xBuyer123',
      seller: '0xSeller456',
      amount: '0.5 ETH'
    });
    
    console.log('✅ Dispute resolution passed:');
    console.log('   Verdict:', resolveResponse.data.verdict_summary.verdict);
    console.log('   Confidence:', resolveResponse.data.verdict_summary.confidence);
    console.log('   Justification:', resolveResponse.data.verdict_summary.justification);
  } catch (error) {
    console.log('❌ Dispute resolution failed:', error.response?.data || error.message);
  }
}

testVerification();