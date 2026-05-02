const axios = require('axios');

const RENDER_URL = 'https://iamobil-cloud.onrender.com';
const DURATION_MS = 30000; // 30 segundos
const INTERVAL_MS = 3000;  // 1 evento a cada 3 segundos

console.log(`🚀 Iniciando Teste de Stress Rápido (30s) em: ${RENDER_URL}`);
console.log('---------------------------------------------------------');

let totalRequests = 0;
let successCount = 0;
let errorCount = 0;

const startTime = Date.now();

const runTest = setInterval(async () => {
    if (Date.now() - startTime > DURATION_MS) {
        clearInterval(runTest);
        console.log('\n=========================================================');
        console.log(`🏁 Teste Concluído!`);
        console.log(`Total de Requisições: ${totalRequests}`);
        console.log(`Sucessos: ${successCount} ✅`);
        console.log(`Falhas: ${errorCount} ❌`);
        console.log(`Taxa de Sucesso: ${((successCount / totalRequests) * 100).toFixed(2)}%`);
        console.log('=========================================================\n');
        return;
    }

    totalRequests++;
    try {
        const response = await axios.get(RENDER_URL, { timeout: 10000 });
        successCount++;
        console.log(`[${new Date().toLocaleTimeString()}] Requisição #${totalRequests}: Sucesso (Status ${response.status})`);
    } catch (err) {
        errorCount++;
        const status = err.response ? err.response.status : 'TIMEOUT/NETWORK';
        console.log(`[${new Date().toLocaleTimeString()}] Requisição #${totalRequests}: FALHA (Status ${status})`);
        if (status === 502) {
            console.log('⚠️ [Render] Erro 502: O servidor ainda pode estar em build ou reiniciando.');
        }
    }
}, INTERVAL_MS);
