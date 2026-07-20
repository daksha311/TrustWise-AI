/**
 * REAL Codex Agent Test - NO MOCK
 * 
 * This test makes a REAL API call to the single GPT arbitration agent via GitHub Models.
 * If the API fails, the test fails - no hardcoded responses.
 */

require('dotenv').config();

const readline = require('readline');
const realCodex = require('../src/services/codex-real');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function testRealCodex() {
  console.log('\n🧪 REAL Codex Single Agent Test (GitHub Models)');
  console.log('━'.repeat(50));
  
  // Check GitHub Token instead of outdated CODEX_API_KEY
  const apiKey = process.env.GITHUB_TOKEN;
  const hasValidKey = apiKey && apiKey !== 'your-github-token-here' && apiKey !== '';
  
  console.log(`\n📡 GitHub Token: ${hasValidKey ? '✅ Found' : '❌ Missing'}`);
  
  if (!hasValidKey) {
    console.log('\n❌ ERROR: No valid GitHub Personal Access Token found.');
    console.log('   Please add GITHUB_TOKEN=ghp_... to your .env file.');
    console.log('   Test cannot continue without a valid token.');
    rl.close();
    process.exit(1);
  }

  console.log('\n⚠️  This test will make exactly ONE real API call via GitHub Models.');
  console.log(`   Model Targeted: ${process.env.GITHUB_MODEL || 'openai/gpt-5 (default)'}`);
  console.log('━'.repeat(50));

  const shouldProceed = await askConfirmation('\n🚀 Proceed with REAL API call? (y/N): ');
  if (!shouldProceed) {
    console.log('\n❌ Test cancelled.');
    rl.close();
    return;
  }

  console.log('\n📡 Starting single-agent arbitration test...\n');

  // Realistic sample input objects required by the arbitration service
  const verifiedEvidence = {
    delivery_status: 'delivered',
    tracking_id: '1Z999AA1234567890',
    delivery_date: '2026-07-17T14:30:00Z',
    proof_hash: '0x3a7f8e9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
    zktls_verified: true,
    source: 'ups.com',
    confidence_indicators: {
      quality_score: 95
    }
  };

  const buyerClaim = {
    claim: 'The package was marked as delivered but I never received anything at my doorstep. Requesting a full refund.'
  };

  const sellerClaim = {
    claim: 'I shipped the item via UPS tracking id 1Z999AA1234567890. The cryptographic zkTLS evidence shows it was safely delivered to the buyer\'s registered address.',
    tracking: '1Z999AA1234567890'
  };

  const escrowContext = {
    escrow_id: 'ESC-ROW-99827',
    amount: '0.45 ETH'
  };

  const startTime = Date.now();

  try {
    // Calling the single arbitration method exactly once
    const result = await realCodex.arbitrateDispute(
      verifiedEvidence,
      buyerClaim,
      sellerClaim,
      escrowContext
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '━'.repeat(50));
    console.log('✅ REAL Arbitration Execution Complete!');
    console.log('━'.repeat(50));
    
    // Explicit performance metrics
    console.log(`⏱️  Execution Time: ${elapsed}s`);
    console.log(`🤖 Model Used:     ${result.model_used}`);
    
    // Core payload output verification
    console.log('\n⚖️  Arbitration Output:');
    console.log(`   🔹 Action:       ${result.action}`);
    console.log(`   🔹 Confidence:   ${result.confidence}%`);
    console.log(`   🔹 Risk Score:   ${result.risk_score}/100`);
    console.log(`   🔹 Explanation:  ${result.explanation}`);
    console.log('   🔹 Reasoning:');
    console.log(`        ${result.reasoning}`);
    console.log('   🔹 Key Evidence Considered:');
    if (Array.isArray(result.key_evidence)) {
      result.key_evidence.forEach((evidence, index) => {
        console.log(`        ${index + 1}. ${evidence}`);
      });
    } else {
      console.log(`        - ${result.key_evidence}`);
    }
    
    // Token metric telemetry
    console.log('\n📊 Token Usage:');
    console.log(`   ▪️ Prompt Tokens:     ${result.usage?.prompt_tokens || 0}`);
    console.log(`   ▪️ Completion Tokens: ${result.usage?.completion_tokens || 0}`);
    console.log(`   ▪️ Total Tokens:      ${result.usage?.tokens_used || 0}`);
    console.log('━'.repeat(50));

  } catch (error) {
    console.log('\n❌ REAL Arbitration test failed:', error.message);
    if (error.response) {
      console.log('   API Response Context:', error.response.data);
    }
    process.exit(1);
  }

  rl.close();
}

testRealCodex();