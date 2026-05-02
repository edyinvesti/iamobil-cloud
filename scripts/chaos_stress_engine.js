const dataEngine = require("../server/data_engine");
const adapter = require("../server/hermes-gateway-adapter");
const fs = require("fs");
const path = require("path");

// CONFIGURAÇÃO DO TESTE DE ESTRESSE
const TOTAL_DURATION_MS = 5 * 60 * 60 * 1000; // 5 HORAS
const INTERVAL_MS = 30000; // A cada 30 segundos injeta um evento
const START_TIME = Date.now();

console.log(`🛡️ [Chaos-IA] Iniciando Motor de Stress & Caos...`);
console.log(`⏳ Duração Planejada: 5 horas`);
console.log(`🚨 O sistema será levado ao limite para testar auto-regeneração.`);

const CHAOS_EVENTS = [
    {
        name: "Storm-Leads (Volume)",
        weight: 0.6, // Mais comum
        action: async () => {
            const count = Math.floor(Math.random() * 20) + 5;
            console.log(`⛈️ [Chaos] Injetando tempestade de ${count} leads simultâneos...`);
            for (let i = 0; i < count; i++) {
                await dataEngine.saveLead({
                    name: `Lead_Stress_${Math.random().toString(36).slice(2, 7)}`,
                    phone: "5562999990000",
                    interest: "Stress Test Volume",
                    notes: "Injeção automática do Chaos Engine",
                    potential_value: Math.floor(Math.random() * 5000000),
                    status: "Stress"
                });
            }
        }
    },
    {
        name: "API-Congestion (Rate Limit)",
        weight: 0.2,
        action: async () => {
            console.log(`🛑 [Chaos] Simulando saturação de chamadas de IA (Rate Limit Stress)...`);
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(adapter.completeOneTurn([{ role: "user", content: "Resuma o catálogo imobiliário rural" }], "hermes", []));
            }
            await Promise.allSettled(promises);
        }
    },
    {
        name: "Portal-Flooding (Concurrency)",
        weight: 0.1,
        action: async () => {
            console.log(`🌐 [Chaos] Disparando múltipla sincronização de portais...`);
            // Simula chamadas paralelas ao multiposter
            const multiposter = require("../server/multiposter_engine");
            await Promise.all([
                multiposter.saveXMLFeed(),
                multiposter.generateSocialPayloads()
            ]);
        }
    },
    {
        name: "Disk-Pressure (Log Bloating)",
        weight: 0.1,
        action: async () => {
            console.log(`💾 [Chaos] Simulando pressão de logs e arquivos temporários...`);
            const tempFile = path.join(process.cwd(), "data", `stress_log_${Date.now()}.txt`);
            const garbage = "STRESS_DATA_".repeat(10000);
            fs.writeFileSync(tempFile, garbage, "utf8");
            // Nota: IA-Sentinel deve detectar arquivos órfãos ou limpar depois
        }
    }
];

function getRandomEvent() {
    const totalWeight = CHAOS_EVENTS.reduce((sum, e) => sum + e.weight, 0);
    let r = Math.random() * totalWeight;
    for (const event of CHAOS_EVENTS) {
        if (r < event.weight) return event;
        r -= event.weight;
    }
    return CHAOS_EVENTS[0];
}

const stressLoop = setInterval(async () => {
    const elapsed = Date.now() - START_TIME;
    if (elapsed > TOTAL_DURATION_MS) {
        console.log("🏁 [Chaos-IA] Teste de estresse de 5 horas concluído!");
        clearInterval(stressLoop);
        process.exit(0);
    }

    const event = getRandomEvent();
    console.log(`\n🔥 [Event Triggered: ${event.name}]`);
    try {
        await event.action();
        console.log(`✅ [Event Success: ${event.name}]`);
    } catch (err) {
        console.error(`❌ [Event Failure: ${event.name}] Error: ${err.message}`);
    }

    const remaining = ((TOTAL_DURATION_MS - elapsed) / 1000 / 3600).toFixed(2);
    console.log(`⏳ Tempo Restante: ${remaining} horas`);
}, INTERVAL_MS);

// Proteção contra crash do motor
process.on("uncaughtException", (err) => {
    console.error("💀 [Chaos-IA] Motor de Caos travou:", err.message);
    process.exit(1); // PM2 vai reiniciar se estiver configurado
});
