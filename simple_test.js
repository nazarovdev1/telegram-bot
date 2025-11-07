// Bot health check
const axios = require('axios')

async function testBot() {
  console.log('🧪 Bot Health Check...')
  
  try {
    const response = await axios.get('http://localhost:3000/health')
    console.log('✅ Bot Health:', response.data)
    
    if (response.data.status === 'OK') {
      console.log('🎉 Bot is running perfectly!')
      console.log('📱 Botni Telegram da sinab ko\'ring')
    }
  } catch (error) {
    console.log('❌ Bot not responding:', error.message)
  }
}

testBot()
