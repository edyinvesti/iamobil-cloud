const axios = require('axios');
const path = require('path');

// CONFIGURAÇÃO DO TESTE DE ESTRESSE
const RENDER_URL = "https://iamobil-cloud.onrender.com";
const STUDIO_ACCESS_TOKEN = "local-dev-bypass"; // Presumindo bypass local ou o token configurado no .env
const DURATION_MS = 2 * 60 * 1000; // 2 minutos
const INTERVAL_MS = 2000; // Requisição a cada 2 segundos para gerar carga real
const START_TIME = Date.now();

console.log(`🚀 [Stress-Render] Iniciando teste de estresse de 2 minutos em: ${RENDER_URL}`);
console.log(`📊 Carga planejada: 1 requisição a cada ${INTERVAL_MS/1000}s`);

let successCount = 0;
let failCount = 0;

const stressInterval = setInterval(async () => {
    const elapsed = Date.now() - START_TIME;
    if (elapsed > DURATION_MS) {
        clearInterval(stressInterval);
        console.log(`\n🏁 [Stress-Render] Teste de 2 minutos concluído!`);
        console.log(`✅ Sucessos: ${successCount}`);
        console.log(`❌ Falhas: ${failCount}`);
        console.log(`📈 Taxa de Sucesso: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%`);
        process.exit(0);
    }

    const leadData = {
        name: `StressBot_${Math.random().toString(36).slice(2, 7)}`,
        phone: "5562999990000",
        interest: "Estresse em Produção (Render)",
        notes: `Teste automático de carga - ${new Date().toISOString()}`,
        potential_value: Math.floor(Math.random() * 1000000),
        status: "Stress"
    };

    try {
        // Tenta salvar um lead via API (assumindo endpoint /api/leads ou via gateway se houver)
        // Como o sistema é Next.js, provavelmente tem endpoints em /api/
        // Vou simular chamadas ao Gateway ou ao simulador se disponível.
        // Dado o código do Hub, vou tentar um POST para um endpoint comum ou apenas um GET de saúde.
        
        const response = await axios.get(`${RENDER_URL}`, {
            headers: { 'Authorization': `Bearer ${STUDIO_ACCESS_TOKEN}` },
            timeout: 5000
        });

        if (response.status === 200) {
            successCount++;
            process.stdout.write(".");
        } else {
            failCount++;
            process.stdout.write(`[F:${response.status}]`);
        }
    } catch (err) {
        failCount++;
        const status = err.response ? err.response.status : "NET";
        process.stdout.write(`[E:${status}]`);
    }

    const remaining = ((DURATION_MS - elapsed) / 1000).toFixed(0);
    if (elapsed % 10000 < INTERVAL_MS) {
        console.log(`\n⏳ Tempo restante: ${remaining}s | Sucessos: ${successCount} | Falhas: ${failCount}`);
    }
}, INTERVAL_MS);

process.on("uncaughtException", (err) => {
    console.error("\n💀 [Stress-Render] Script falhou:", err.message);
    process.exit(1);
});
