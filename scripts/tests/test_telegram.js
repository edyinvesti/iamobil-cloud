const axios = require('axios');
require('dotenv').config();

async function test() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  console.log("--- Checking Telegram Webhook ---");
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    console.log("Webhook Info:", JSON.stringify(res.data.result, null, 2));
    
    const me = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log("Bot Name:", me.data.result.first_name, "(@", me.data.result.username, ")");
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

test();
