// Simple test to check if bot is working
const axios = require('axios')

async function testBot() {
  console.log('🧪 Bot Test Starting...')
  
  // Test 1: Health check
  try {
    const health = await axios.get('http://localhost:3000/health')
    console.log('✅ Health check:', health.data)
  } catch (error) {
    console.log('❌ Health check failed:', error.message)
  }
  
  // Test 2: Bot status
  try {
    const status = await axios.get('http://localhost:3000/status')
    console.log('✅ Status check:', status.data)
  } catch (error) {
    console.log('❌ Status check failed:', error.message)
  }
  
  // Test 3: Bot main page
  try {
    const main = await axios.get('http://localhost:3000/')
    console.log('✅ Main page:', main.data.substring(0, 100) + '...')
  } catch (error) {
    console.log('❌ Main page failed:', error.message)
  }
  
  console.log('🎯 Test complete!')
}

testBot()
