const https = require('https');

const token = '8615066494:AAFmn3yrAZTuhJOuKLdHrsvzGqhbIsKm2EA';
const url = 'https://iamobil-cloud-1.onrender.com/api/tg-webhook';

const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${url}`;

https.get(setWebhookUrl, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('RESPOSTA DO TELEGRAM:', d);
  });
}).on('error', (e) => {
  console.error('ERRO:', e.message);
});
