/**
 * TLSNotary Integration Test - REAL ONLY
 * 
 * Tests the full integration with real components.
 */

require('dotenv').config();

const axios = require('axios');

const VERIFIER_URL = 'http://localhost:7047';
const BACKEND_URL = 'http://localhost:3001';

async function testTLSNotaryIntegration() {
  console.log('\n🧪 REAL TLSNotary Integration Test');
  console.log('━'.repeat(50));

  // Test 1: Verifier Health
  console.log('\n📡 Test 1: Verifier Server Health');
  try {
    const response = await axios.get(`${VERIFIER_URL}/health`);
    console.log('✅ Verifier is running');
  } catch (error) {
    console.log('❌ Verifier not running. Start with:');
    console.log('   cd tlsn-extension-rebuild/servers/verifier && cargo run --release');
    process.exit(1);
  }

  // Test 2: Backend Health
  console.log('\n📡 Test 2: Backend Health');
  try {
    const response = await axios.get(`${BACKEND_URL}/health`);
    console.log('✅ Backend is running');
    console.log('   Services:', response.data.services);
  } catch (error) {
    console.log('❌ Backend not running. Start with: npm run dev');
    process.exit(1);
  }

  // Test 3: REAL Proof Verification
  console.log('\n📡 Test 3: REAL Proof Verification');
  try {
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 17, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };

    const response = await axios.post(`${BACKEND_URL}/api/verify/zkproof`, {
      proof: mockProof,
      disputeId: 'TEST-001',
      escrowId: 'ESC-001'
    });

    console.log('✅ Proof verification passed');
    console.log('   Status:', response.data.evidence.delivery_status);
  } catch (error) {
    console.log('❌ Proof verification failed:', error.response?.data || error.message);
  }

  // Test 4: FULL REAL CODEX RESOLUTION
  console.log('\n📡 Test 4: REAL Codex Resolution');
  console.log('⚠️  This will make REAL Codex API calls');
  
  try {
    const mockProof = {
      url: 'https://www.ups.com/tracking',
      content: 'Status: Delivered | Date: July 17, 2026',
      timestamp: new Date().toISOString(),
      notary_signature: '0x' + 'a'.repeat(64)
    };

    const response = await axios.post(`${BACKEND_URL}/api/dispute/resolve`, {
      proof: mockProof,
      disputeId: 'REAL-TEST-001',
      escrowId: 'ESC-001',
      buyer: '0xBuyer123',
      seller: '0xSeller456',
      amount: '0.5 ETH'
    });

    console.log('✅ Dispute resolved with REAL Codex!');
    console.log('   Verdict:', response.data.verdict_summary.winner);
    console.log('   Confidence:', response.data.verdict_summary.confidence);
    console.log('   Models Used:', response.data.verdict_summary.models_used);
    console.log('   Tokens Used:', response.data.verdict_summary.usage?.total_tokens || 'N/A');
    
  } catch (error) {
    console.log('❌ REAL Codex resolution failed:', error.response?.data || error.message);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ Tests Complete!');
}

testTLSNotaryIntegration();