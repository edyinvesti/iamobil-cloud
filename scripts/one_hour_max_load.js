const dataEngine = require("../server/data_engine");
const adapter = require("../server/hermes-gateway-adapter");
const fs = require("fs");
const path = require("path");

// CONFIGURAÇÃO DO TESTE DE ESTRESSE MÁXIMO (1 HORA)
const TOTAL_DURATION_MS = 60 * 60 * 1000; // 1 HORA
const INTERVAL_MS = 2000; // A cada 2 segundos injeta um evento (EXTREMO)
const START_TIME = Date.now();

console.log(`\n🔥 [MAX-LOAD-STRESS] Iniciando Motor de Stress Extremo...`);
console.log(`⏳ Duração: 1 Hora`);
console.log(`🚨 INTERVALO AGRESSIVO: 2 segundos por evento`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

const CHAOS_EVENTS = [
    {
        name: "Storm-Leads (Volume)",
        weight: 0.5,
        action: async () => {
            const count = Math.floor(Math.random() * 10) + 2;
            for (let i = 0; i < count; i++) {
                await dataEngine.saveLead({
                    name: `STRESS_${Math.random().toString(36).slice(2, 7)}`,
                    phone: "5562999990000",
                    interest: "MAX LOAD TEST",
                    notes: "Burst injection",
                    potential_value: Math.floor(Math.random() * 1000000),
                    status: "Stress"
                });
            }
        }
    },
    {
        name: "API-Congestion (IA Rate Limit)",
        weight: 0.2,
        action: async () => {
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(adapter.completeOneTurn([{ role: "user", content: "Resuma este catálogo" }], "hermes", []));
            }
            await Promise.allSettled(promises);
        }
    },
    {
        name: "Portal-Flooding (Concurrency)",
        weight: 0.15,
        action: async () => {
            const multiposter = require("../server/multiposter_engine");
            await Promise.all([
                multiposter.saveXMLFeed(),
                multiposter.generateSocialPayloads()
            ]);
        }
    },
    {
        name: "DB-Hammer (Heavy Scans)",
        weight: 0.15,
        action: async () => {
            // Emula consultas pesadas no SQLite
            await dataEngine.getAllLeads();
            await dataEngine.getLeadSummary();
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

let successCount = 0;
let errorCount = 0;

async function run() {
    while (Date.now() - START_TIME < TOTAL_DURATION_MS) {
        const event = getRandomEvent();
        try {
            await event.action();
            successCount++;
            process.stdout.write("🔥");
        } catch (err) {
            errorCount++;
            process.stdout.write("💀");
        }

        if (successCount % 10 === 0) {
            const elapsed = Date.now() - START_TIME;
            const remaining = ((TOTAL_DURATION_MS - elapsed) / 1000 / 60).toFixed(1);
            process.stdout.write(` [RESTANTE: ${remaining} min]\n`);
        }

        // Aguarda o intervalo fixo antes do próximo evento
        await new Promise(r => setTimeout(r, INTERVAL_MS));
    }

    console.log(`\n🏆 [MAX-LOAD-STRESS] TESTE CONCLUÍDO COM SUCESSO!`);
    console.log(`📊 Estatísticas Finais:`);
    console.log(`✅ Eventos com Sucesso: ${successCount}`);
    console.log(`❌ Falhas Registradas: ${errorCount}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    process.exit(0);
}

run().catch(err => {
    console.error("\n💀 [CRITICAL FAIL] O motor de estresse quebrou:", err.message);
    process.exit(1);
});
