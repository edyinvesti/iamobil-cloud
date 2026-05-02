/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require("axios");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configurações do Vigilante
const CHECK_INTERVAL = 1000 * 60 * 60; // 1 hora
const LOG_FILE = path.join(process.cwd(), "logs", "sentinel_health.log");
const TG_TOKEN = "8615066494:AAFmn3yrAZTuhJOuKLdHrsvzGqhbIsKm2EA";
const CEO_CHAT_ID = "6202370881";

async function runSentinel() {
    const timestamp = new Date().toLocaleString();
    console.log(`\n🛡️ [IA-Sentinel] Iniciando verificação de rotina: ${timestamp}`);
    
    // Executa o Playwright
    exec("npx playwright test tests/e2e/ia_sentinel.spec.ts", (error, stdout, stderr) => {
        let status = "✅ OK";
        let detail = stdout;

        if (error) {
            status = "❌ FALHA CRÍTICA";
            detail = stderr || stdout;
            sendAlert(`🚨 *ALERTA IAmobil:* O vigilante detectou uma instabilidade no ecossistema.\n\n🕒 *Horário:* ${timestamp}\n❌ *Status:* Falha no Playwright\n\n🔍 *Erro:* \n\`${detail.slice(0, 200)}...\``);
        }

        const logEntry = `[${timestamp}] Status: ${status}\n`;
        fs.appendFileSync(LOG_FILE, logEntry);
        console.log(`🛡️ [IA-Sentinel] Verificação concluída. Resultado: ${status}`);
    });
}

function sendAlert(message) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    axios.post(url, {
        chat_id: CEO_CHAT_ID,
        text: message,
        parse_mode: "Markdown"
    }).then(() => {
        console.log("📢 [SENTINEL-ALERT]: Alerta enviado com sucesso ao CEO!");
    }).catch(err => {
        console.error("❌ [SENTINEL-ALERT]: Erro ao enviar alerta Telegram:", err.message);
    });
}

// Inicia o Loop 24h
console.log("🚀 iAmobil Sentinel Ativado!");
console.log(`监控 (Monitoramento) iniciado. Intervalo: ${CHECK_INTERVAL/1000/60} minutos.`);
runSentinel();
setInterval(runSentinel, CHECK_INTERVAL);
