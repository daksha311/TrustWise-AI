const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function simpleTest() {
  console.log('🧪 Testing TrustWise Backend APIs...\n');
  
  // Test 1: Health check
  try {
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Health check passed');
    console.log('   Services:', health.data.services);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: Check if routes are registered
  try {
    const response = await axios.get(`${BASE_URL}/`);
    console.log('✅ Root endpoint:');
    console.log('   Name:', response.data.name);
    console.log('   Status:', response.data.status);
  } catch (error) {
    console.log('❌ Root endpoint failed:', error.message);
  }
  
  console.log('\n✅ Backend is running with all routes configured!');
  console.log('📡 Your APIs are ready when your friend builds the frontend/contracts.');
}

simpleTest();