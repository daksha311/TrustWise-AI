// End-to-End Test Script
// Run with: npm run test:e2e

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';

async function e2eTest() {
  console.log('🧪 TrustWise AI - End-to-End Test\n');
  console.log('━'.repeat(50));

  // Test 1: Health Check
  console.log('\n📡 Test 1: Backend Health Check');
  try {
    const health = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend healthy:', health.data.status);
  } catch (error) {
    console.log('❌ Backend not running:', error.message);
    process.exit(1);
  }

  // Test 2: Contract Status
  console.log('\n📡 Test 2: Contract Status');
  try {
    const contract = await axios.get(`${BACKEND_URL}/api/contract/status`);
    console.log('✅ Contract status:', contract.data);
  } catch (error) {
    console.log('❌ Contract check failed:', error.message);
  }

  // Test 3: Full Dispute Resolution
  console.log('\n📡 Test 3: Dispute Resolution');
  try {
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026 | Tracking: 1Z999AA1234567890',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };

    const response = await axios.post(`${BACKEND_URL}/api/dispute/resolve`, {
      proof: mockProof,
      disputeId: 'E2E-TEST-001',
      escrowId: 'ESC-001',
      buyer: '0xBuyer123456789',
      seller: '0xSeller123456789',
      amount: '0.5 ETH'
    });

    console.log('✅ Dispute resolved!');
    console.log('   Verdict:', response.data.verdict_summary.verdict);
    console.log('   Confidence:', response.data.verdict_summary.confidence);
    console.log('   Justification:', response.data.verdict_summary.justification);
    console.log('   Settlement:', response.data.settlement?.action || 'pending');
  } catch (error) {
    console.log('❌ Dispute resolution failed:', error.response?.data?.error || error.message);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ E2E Test Complete!');
}

e2eTest();