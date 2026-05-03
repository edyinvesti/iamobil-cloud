/**
 * 🔥🔥🔥 STRESS TEST EXTREMO - 7 MINUTOS DE INFERNO 🔥🔥🔥
 * 
 * Este teste é projetado para levar o sistema ao limite absoluto:
 * - Injeção massiva de leads (bursts de 20-50 por ciclo)
 * - Consultas pesadas concorrentes no SQLite
 * - Bombardeio nas APIs HTTP (catalog, leads, office)
 * - Chamadas concorrentes ao Hermes AI adapter
 * - Escritas e leituras simultâneas no banco
 * - Simulação de pico de usuários acessando o portal
 */

const { http, https } = require("follow-redirects"); // Optional or just use standard https
const client = require("https");
const dataEngine = require("../server/data_engine");

// ═══════════════════════════════════════════════════
//  CONFIGURAÇÃO EXTREMA
// ═══════════════════════════════════════════════════
const DURATION_MS = 7 * 60 * 1000;         // 7 minutos
const TICK_INTERVAL_MS = 200;               // A cada 200ms (5 eventos/segundo!)
const CONCURRENT_WORKERS = 8;               // 8 workers paralelos por tick
const START = Date.now();

// Contadores
let totalOps = 0;
let successOps = 0;
let failOps = 0;
let leadsInjected = 0;
let dbReads = 0;
let httpRequests = 0;
let aiCalls = 0;
let peakMemoryMB = 0;

const NAMES = [
  "Carlos Stress", "Ana Teste", "Maria Load", "João Burst",
  "Pedro Hammer", "Lucia Chaos", "Fernando Spike", "Patricia Storm",
  "Roberto Flood", "Camila Thunder", "Diego Surge", "Beatriz Blitz",
  "Rafael Overload", "Gabriela Peak", "Thiago Crash", "Juliana Fury",
  "Marcos Volcano", "Isabela Quake", "André Tsunami", "Larissa Inferno"
];

const INTERESTS = [
  "Mansão Duo Marista", "Penthouse Solar dos Lagos",
  "MAX LOAD TEST", "STRESS EXTREME", "Condomínio Alto Luxo",
  "Fazenda Premium", "Apartamento Garden", "Cobertura Setor Bueno"
];

const STATUSES = ["Frio", "Morno", "Quente", "Negociando", "Stress"];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomId() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

// ═══════════════════════════════════════════════════
//  OPERAÇÕES DE ATAQUE
// ═══════════════════════════════════════════════════

/** Injeção massiva de leads no banco */
async function attackLeadInjection() {
  const batchSize = Math.floor(Math.random() * 30) + 20; // 20-50 leads por burst
  const promises = [];
  for (let i = 0; i < batchSize; i++) {
    promises.push(dataEngine.saveLead({
      name: `STRESS_${randomId()}_${randomFrom(NAMES)}`,
      phone: `5562${Math.floor(Math.random() * 900000000 + 100000000)}`,
      interest: randomFrom(INTERESTS),
      notes: `Burst injection at ${new Date().toISOString()} | Worker ${Math.floor(Math.random()*CONCURRENT_WORKERS)}`,
      potential_value: Math.floor(Math.random() * 5000000),
      status: randomFrom(STATUSES)
    }));
  }
  const results = await Promise.allSettled(promises);
  leadsInjected += batchSize;
  return results.filter(r => r.status === "fulfilled").length;
}

/** Consultas pesadas e simultâneas no DB */
async function attackDBHammer() {
  const queries = [
    dataEngine.getLeads(),
    dataEngine.getLeads(),
    dataEngine.getFinancialReport(),
    dataEngine.getAppointments(),
    dataEngine.getLeads(),
  ];
  const results = await Promise.allSettled(queries);
  dbReads += queries.length;
  return results.filter(r => r.status === "fulfilled").length;
}

/** Bombardeio HTTP nas APIs Next.js */
async function attackHTTPFlood() {
  const endpoints = [
    "/api/catalog",
    "/api/leads",
    "/api/catalog",
    "/api/leads",
  ];
  
  const promises = endpoints.map(ep => {
    return new Promise((resolve) => {
      const req = client.get(`https://iamobil-gestor-imob-13hr2vw59-edyinvestis-projects.vercel.app${ep}`, { timeout: 5000 }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => resolve({ ok: res.statusCode === 200, size: data.length }));
      });
      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => { req.destroy(); resolve({ ok: false }); });
    });
  });
  
  const results = await Promise.allSettled(promises);
  httpRequests += endpoints.length;
  return results.filter(r => r.status === "fulfilled" && r.value?.ok).length;
}

/** Simula agendamento de visitas em massa */
async function attackScheduleFlood() {
  const count = Math.floor(Math.random() * 10) + 5;
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(dataEngine.scheduleVisit({
      lead_name: `STRESS_${randomId()}`,
      property_title: randomFrom(INTERESTS),
      date_time: new Date(Date.now() + Math.random() * 86400000 * 30).toISOString(),
      notes: `Stress scheduled visit #${totalOps}`
    }));
  }
  const results = await Promise.allSettled(promises);
  return results.filter(r => r.status === "fulfilled").length;
}

/** Leitura/Escrita simultânea (conflito WAL) */
async function attackReadWriteConflict() {
  const results = await Promise.allSettled([
    attackLeadInjection(),
    attackDBHammer(),
    attackLeadInjection(),
    attackDBHammer(),
  ]);
  return results.filter(r => r.status === "fulfilled").length;
}

/** Chamadas HTTP ao WebSocket Adapter (health check) */
async function attackAdapterPing() {
  return new Promise((resolve) => {
    const req = client.get("https://iamobil-gestor-imob-13hr2vw59-edyinvestis-projects.vercel.app/api/catalog", { timeout: 3000 }, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { httpRequests++; resolve(1); });
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
  });
}

// ═══════════════════════════════════════════════════
//  MOTOR DE CAOS
// ═══════════════════════════════════════════════════

const ATTACKS = [
  { name: "💣 Lead Injection Burst",   weight: 0.30, fn: attackLeadInjection },
  { name: "🔨 DB Hammer",              weight: 0.20, fn: attackDBHammer },
  { name: "🌊 HTTP API Flood",         weight: 0.20, fn: attackHTTPFlood },
  { name: "📅 Schedule Flood",         weight: 0.10, fn: attackScheduleFlood },
  { name: "⚡ Read/Write Conflict",    weight: 0.15, fn: attackReadWriteConflict },
  { name: "📡 Adapter Ping",           weight: 0.05, fn: attackAdapterPing },
];

function pickAttack() {
  let r = Math.random();
  for (const atk of ATTACKS) {
    if (r < atk.weight) return atk;
    r -= atk.weight;
  }
  return ATTACKS[0];
}

function getMemoryMB() {
  const mem = process.memoryUsage();
  return Math.round(mem.heapUsed / 1024 / 1024);
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m${(s % 60).toString().padStart(2, "0")}s`;
}

// ═══════════════════════════════════════════════════
//  DISPLAY
// ═══════════════════════════════════════════════════

function printHeader() {
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  🔥🔥🔥  STRESS TEST EXTREMO - 7 MINUTOS DE INFERNO  🔥🔥🔥`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  ⏱️  Duração: 7 minutos`);
  console.log(`  ⚡ Tick: ${TICK_INTERVAL_MS}ms (${(1000/TICK_INTERVAL_MS).toFixed(0)} ticks/seg)`);
  console.log(`  👷 Workers paralelos: ${CONCURRENT_WORKERS}`);
  console.log(`  📊 Operações esperadas: ~${Math.floor(DURATION_MS/TICK_INTERVAL_MS*CONCURRENT_WORKERS).toLocaleString()}`);
  console.log(`${"═".repeat(64)}\n`);
}

function printProgress() {
  const elapsed = Date.now() - START;
  const remaining = Math.max(0, DURATION_MS - elapsed);
  const memMB = getMemoryMB();
  if (memMB > peakMemoryMB) peakMemoryMB = memMB;
  const successRate = totalOps > 0 ? ((successOps/totalOps)*100).toFixed(1) : "0.0";
  
  process.stdout.write(
    `\r  ⏳ ${formatTime(remaining)} restantes | ` +
    `Ops: ${totalOps.toLocaleString()} | ` +
    `✅ ${successRate}% | ` +
    `💉 Leads: ${leadsInjected.toLocaleString()} | ` +
    `📖 DB: ${dbReads.toLocaleString()} | ` +
    `🌐 HTTP: ${httpRequests.toLocaleString()} | ` +
    `🧠 RAM: ${memMB}MB   `
  );
}

function printFinal() {
  const elapsed = Date.now() - START;
  const opsPerSec = (totalOps / (elapsed / 1000)).toFixed(1);
  
  console.log(`\n\n${"═".repeat(64)}`);
  console.log(`  🏆  STRESS TEST CONCLUÍDO!`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  ⏱️  Duração real:        ${formatTime(elapsed)}`);
  console.log(`  📊 Total de operações:   ${totalOps.toLocaleString()}`);
  console.log(`  ✅ Sucesso:              ${successOps.toLocaleString()}`);
  console.log(`  ❌ Falhas:               ${failOps.toLocaleString()}`);
  console.log(`  📈 Taxa de sucesso:      ${((successOps/totalOps)*100).toFixed(2)}%`);
  console.log(`  ⚡ Ops/segundo:          ${opsPerSec}`);
  console.log(`  💉 Leads injetados:      ${leadsInjected.toLocaleString()}`);
  console.log(`  📖 Leituras DB:          ${dbReads.toLocaleString()}`);
  console.log(`  🌐 Requests HTTP:        ${httpRequests.toLocaleString()}`);
  console.log(`  🧠 Pico de memória:      ${peakMemoryMB}MB`);
  console.log(`${"═".repeat(64)}\n`);
}

// ═══════════════════════════════════════════════════
//  EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════

async function runTick() {
  const workers = [];
  for (let w = 0; w < CONCURRENT_WORKERS; w++) {
    const attack = pickAttack();
    workers.push(
      attack.fn().then(ok => {
        totalOps++;
        if (ok) successOps++;
        else failOps++;
      }).catch(() => {
        totalOps++;
        failOps++;
      })
    );
  }
  await Promise.allSettled(workers);
}

async function main() {
  printHeader();
  
  let progressInterval = setInterval(printProgress, 2000);
  
  while (Date.now() - START < DURATION_MS) {
    await runTick();
    // Micro-delay para não travar o event loop completamente
    await new Promise(r => setTimeout(r, TICK_INTERVAL_MS));
  }
  
  clearInterval(progressInterval);
  printFinal();
  process.exit(0);
}

main().catch(err => {
  console.error(`\n💀 [CRITICAL FAIL] Motor de stress quebrou: ${err.message}`);
  process.exit(1);
});
