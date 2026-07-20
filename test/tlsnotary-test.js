/**
 * TLSNotary Verifier Connection Test
 * Run with: node test/tlsnotary-test.js
 */

const axios = require('axios');

const VERIFIER_URL = 'http://localhost:7047';
const BACKEND_URL = 'http://localhost:3001';

async function testTLSNotaryIntegration() {
  console.log('🧪 TLSNotary Integration Test\n');
  console.log('━'.repeat(50));

  // Test 1: Verifier Health
  console.log('\n📡 Test 1: Verifier Server Health');
  try {
    const response = await axios.get(`${VERIFIER_URL}/health`);
    console.log('✅ Verifier is running:', response.data);
  } catch (error) {
    console.log('❌ Verifier not running:', error.message);
    console.log('   Start with: cargo run --release --bin tlsn-verifier-server');
    process.exit(1);
  }

  // Test 2: Backend Health
  console.log('\n📡 Test 2: Backend Health');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend is running:', response.data.status);
    console.log('   Services:', response.data.services);
  } catch (error) {
    console.log('❌ Backend not running:', error.message);
    console.log('   Start with: npm run dev in backend directory');
    process.exit(1);
  }

  // Test 3: Mock Proof Verification
  console.log('\n📡 Test 3: Mock Proof Verification');
  try {
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };

    const response = await axios.post(`${BACKEND_URL}/api/verify/zkproof`, {
      proof: mockProof,
      disputeId: 'TEST-001',
      escrowId: 'ESC-001',
      buyer: '0xBuyer123',
      seller: '0xSeller456',
      amount: '0.5 ETH'
    });

    console.log('✅ Proof verification passed');
    console.log('   Verifier:', response.data.verifier);
    console.log('   Status:', response.data.evidence.delivery_status);
  } catch (error) {
    console.log('❌ Proof verification failed:', error.response?.data || error.message);
  }

  // Test 4: Full Dispute Resolution
  console.log('\n📡 Test 4: Full Dispute Resolution');
  try {
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 15, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };

    const response = await axios.post(`${BACKEND_URL}/api/dispute/resolve`, {
      proof: mockProof,
      disputeId: 'TEST-002',
      escrowId: 'ESC-001',
      buyer: '0xBuyer123',
      seller: '0xSeller456',
      amount: '0.5 ETH'
    });

    console.log('✅ Dispute resolved!');
    console.log('   Verifier:', response.data.verifier);
    console.log('   Verdict:', response.data.verdict_summary.winner);
    console.log('   Confidence:', response.data.verdict_summary.confidence);
    console.log('   Justification:', response.data.verdict_summary.justification?.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Dispute resolution failed:', error.response?.data || error.message);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ TLSNotary Integration Test Complete!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Open Chrome and go to https://www.ups.com/tracking');
  console.log('   2. Click the TLSNotary extension icon');
  console.log('   3. Generate a real proof');
  console.log('   4. Use the "Generate zkTLS Proof" button in the frontend');
}

testTLSNotaryIntegration();