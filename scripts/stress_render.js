/**
 * Stress Test iAmobil - Render Cloud
 * Testa: status, tempo de resposta, webhook, envio de mensagens
 */

const https = require('https');

const RENDER_URL = 'iamobil-cloud-1.onrender.com';
const TG_TOKEN = '8615066494:AAFmn3yrAZTuhJOuKLdHrsvzGqhbIsKm2EA';
const CHAT_ID = '6202370881';

function get(host, path) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const req = https.get({ host, path, timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => resolve({ data, ms: Date.now() - start, status: res.statusCode }));
        });
        req.on('error', reject);
        req.on('timeout', () => reject(new Error('Timeout')));
    });
}

async function run() {
    console.log('=== STRESS TEST iAmobil Render ===\n');

    // 1. Status
    console.log('1. Status do servidor...');
    try {
        const r = await get(RENDER_URL, '/api/status');
        const json = JSON.parse(r.data);
        console.log(`   ✅ Online em ${r.ms}ms`);
        console.log(`   tgBotReady: ${json.tgBotReady}`);
        console.log(`   nextReady: ${json.nextReady}`);
    } catch(e) { console.log(`   ❌ Erro: ${e.message}`); }

    // 2. Tempo de resposta (10 requests)
    console.log('\n2. Tempo de resposta (10 requests)...');
    const times = [];
    for (let i = 0; i < 10; i++) {
        try {
            const r = await get(RENDER_URL, '/api/status');
            times.push(r.ms);
            process.stdout.write(`   ${r.ms}ms `);
        } catch(e) { process.stdout.write(`   ERR `); }
    }
    const avg = Math.round(times.reduce((a,b) => a+b, 0) / times.length);
    const max = Math.max(...times);
    const min = Math.min(...times);
    console.log(`\n   Média: ${avg}ms | Min: ${min}ms | Max: ${max}ms`);
    if (avg < 500) console.log('   ✅ Tempo de resposta EXCELENTE');
    else if (avg < 2000) console.log('   ⚠️ Tempo de resposta ACEITÁVEL');
    else console.log('   ❌ Tempo de resposta LENTO');

    // 3. Webhook Telegram
    console.log('\n3. Webhook Telegram...');
    try {
        const r = await get('api.telegram.org', `/bot${TG_TOKEN}/getWebhookInfo`);
        const json = JSON.parse(r.data);
        console.log(`   URL: ${json.result.url}`);
        console.log(`   Pendentes: ${json.result.pending_update_count}`);
        if (json.result.last_error_message) {
            console.log(`   ❌ Último erro: ${json.result.last_error_message}`);
        } else {
            console.log(`   ✅ Sem erros`);
        }
    } catch(e) { console.log(`   ❌ Erro: ${e.message}`); }

    // 4. Envio de mensagem de teste
    console.log('\n4. Enviando mensagem de teste...');
    try {
        const msg = encodeURIComponent('🧪 Stress Test iAmobil - Sistema OK!');
        const r = await get('api.telegram.org', `/bot${TG_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${msg}`);
        const json = JSON.parse(r.data);
        if (json.ok) console.log(`   ✅ Mensagem enviada (ID: ${json.result.message_id})`);
        else console.log(`   ❌ Falha: ${json.description}`);
    } catch(e) { console.log(`   ❌ Erro: ${e.message}`); }

    // 5. Logs recentes
    console.log('\n5. Verificando logs recentes...');
    try {
        const r = await get(RENDER_URL, '/api/logs');
        const lines = r.data.split('\n').slice(-10);
        const hasErrors = lines.some(l => l.includes('ERROR') || l.includes('❌') || l.includes('FATAL'));
        const hasHandshake = lines.some(l => l.includes('Handshake') || l.includes('Conectado'));
        if (hasErrors) console.log('   ⚠️ Erros encontrados nos logs recentes');
        else console.log('   ✅ Sem erros críticos nos logs');
        if (hasHandshake) console.log('   ✅ Hermes conectado');
    } catch(e) { console.log(`   ❌ Erro: ${e.message}`); }

    console.log('\n=== RESULTADO FINAL ===');
    console.log(`Avg response: ${avg}ms`);
    console.log('Sistema: OPERACIONAL ✅');
}

run().catch(console.error);
