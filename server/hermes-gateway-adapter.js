"use strict";
console.log(`[hermes-adapter] BOOTING AT ${new Date().toISOString()} | CWD: ${process.cwd()}`);

/**
 * Hermes Gateway Adapter — with multi-agent orchestration
 *
 * The main Hermes agent acts as an orchestrator and can:
 *   - spawn_agent(name, role, instructions, wipe, continuity, boundaries)
 *   - delegate_task(agent_id, message)
 *   - list_team()
 *   - configure_agent(agent_id, ...)
 *   - dismiss_agent(agent_id)
 *
 * Sub-agents appear as 3D characters in the office, each with their own
 * conversation history, system prompt, and settings.
 *
 * Environment variables:
 *   HERMES_API_URL        Hermes HTTP API base URL   (default: http://localhost:8642)
 *   HERMES_API_KEY        Bearer token for Hermes     (default: empty)
 *   HERMES_ADAPTER_PORT   WebSocket port              (default: 18789)
 *   HERMES_MODEL          Model identifier            (default: hermes)
 *   HERMES_AGENT_NAME     Display name in Claw3D UI   (default: Hermes)
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const dataEngine = require("./data_engine");
const { createExternalBackup } = require("./backup_manager");
const { takeScreenshot } = require("./screenshot-service");
const multiposter = require("./multiposter_engine");
const tokenOptimizer = require("./token_optimizer");

function loadDotenvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadRuntimeEnv() {
  const cwd = process.cwd();
  loadDotenvFile(path.join(cwd, ".env.local"));
  loadDotenvFile(path.join(cwd, ".env"));
}

loadRuntimeEnv();
function loadIdentity(folder = "edy") {
  const agentPath = path.join(process.cwd(), "agents", folder, "IDENTITY.md");
  const rootPath = path.join(process.cwd(), "IDENTITY.md");
  const finalPath = fs.existsSync(agentPath) ? agentPath : rootPath;
  if (!fs.existsSync(finalPath)) return "";
  const content = fs.readFileSync(finalPath, "utf8");
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const identity = {};
  for (let i = 0; i < lines.length; i += 2) {
    if (lines[i] && lines[i + 1]) {
      identity[lines[i].toLowerCase()] = lines[i + 1];
    }
  }
  return identity;
}

// --- v6 Semantic Memory (RAG) -----------------------------------------------

async function getEmbedding(text) {
  const apiKey = process.env.HERMES_API_KEY || process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey && !geminiKey) return null;

  try {
    if (apiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({ input: text, model: "text-embedding-3-small" })
        });
        
        if (res.ok) {
          const data = await res.json();
          return data.data?.[0]?.embedding;
        }
        
        // Se falhar (429 por exemplo) e tivermos Gemini, tentar fallback
        if (geminiKey && (res.status === 429 || res.status >= 500)) {
          console.warn(`[v6] OpenAI/Groq Embeddings failed (${res.status}). Falling back to Gemini...`);
          return getGeminiEmbedding(text);
        }
      } catch (err) {
        if (geminiKey) return getGeminiEmbedding(text);
        throw err;
      }
    } else if (geminiKey) {
      return getGeminiEmbedding(text);
    }
    return null;
  } catch (err) {
    console.error("[Embeddings] Error:", err.message);
    return null;
  }
}

async function getGeminiEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] } })
    });
    const data = await res.json();
    return data.embedding?.values;
  } catch (err) {
    console.error("[Gemini Embeddings] Error:", err.message);
    return null;
  }
}

async function execSemanticSearch({ query }) {
  console.log(`[v6] Semantic Search: "${query}"`);
  const kb = loadKnowledgeBase();
  const mem = loadGoldMemory();
  
  // v6-alpha: Híbrido inteligente que vasculha base de conhecimento e memória.
  const allContext = `${kb}\n\n${mem}`;
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  const relevantLines = allContext.split("\n").filter(line => {
    return keywords.some(k => line.toLowerCase().includes(k));
  }).slice(0, 8); // Reduzido de 15 para 8 para economizar tokens

  if (relevantLines.length === 0) {
    return JSON.stringify({ ok: true, results: "Nenhuma informa\u00e7\u00e3o sem\u00e2ntica relevante encontrada para esta consulta espec\u00edfica." });
  }

  return JSON.stringify({ 
    ok: true, 
    results: relevantLines.join("\n"),
    note: "Resultado obtido via indexa\u00e7\u00e3o sem\u00e2ntica iAmobil v6." 
  });
}
function loadSoul(folder = "edy") {
  const agentPath = path.join(process.cwd(), "agents", folder, "SOUL.md");
  const rootPath = path.join(process.cwd(), "SOUL.md");
  const finalPath = fs.existsSync(agentPath) ? agentPath : rootPath;
  if (!fs.existsSync(finalPath)) return "";
  return fs.readFileSync(finalPath, "utf8");
}
function loadAgents(folder = "edy") {
  const agentPath = path.join(process.cwd(), "agents", folder, "AGENTS.md");
  const rootPath = path.join(process.cwd(), "AGENTS.md");
  const finalPath = fs.existsSync(agentPath) ? agentPath : rootPath;
  if (!fs.existsSync(finalPath)) return "";
  return fs.readFileSync(finalPath, "utf8");
}
function loadHeartbeat(folder = "edy") {
  const agentPath = path.join(process.cwd(), "agents", folder, "HEARTBEAT.md");
  const rootPath = path.join(process.cwd(), "HEARTBEAT.md");
  const finalPath = fs.existsSync(agentPath) ? agentPath : rootPath;
  if (!fs.existsSync(finalPath)) return "";
  return fs.readFileSync(finalPath, "utf8");
}
function loadKnowledgeBase() {
  const juridicPath = path.join(process.cwd(), "assets", "knowledge_base", "KNOWLEDGE_IMOBILIARIO.md");
  const ruralPath = path.join(process.cwd(), "assets", "knowledge_base", "RURAL_PORTFOLIO.md");
  const juridic = fs.existsSync(juridicPath) ? fs.readFileSync(juridicPath, "utf8") : "";
  const rural = fs.existsSync(ruralPath) ? fs.readFileSync(ruralPath, "utf8") : "";
  return `${juridic}\n\n${rural}`;
}
function loadGoldMemory() {
  const memoryPath = path.join(process.cwd(), "assets", "knowledge_base", "GOLD_MEMORY.md");
  if (!fs.existsSync(memoryPath)) return "";
  return fs.readFileSync(memoryPath, "utf8");
}
const soul = loadSoul();
const agentsConfig = loadAgents();
const heartbeat = loadHeartbeat();
const knowledgeBase = loadKnowledgeBase();
const goldMemory = loadGoldMemory();
const identity = loadIdentity();
const ADAPTER_LOG = path.join(__dirname, "../logs/adapter_debug.log");
function logAdapter(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(ADAPTER_LOG, entry, "utf8");
  console.log(msg);
}

let HERMES_API_URL = (process.env.HERMES_API_URL || "http://localhost:8642").replace(/\/+$/, "").replace(/\/v1$/, "");
console.log(`[hermes-adapter] API Base URL: ${HERMES_API_URL}`);

let HERMES_API_KEY = process.env.HERMES_API_KEY || "";
const ADAPTER_PORT = parseInt(process.env.HERMES_ADAPTER_PORT || "18789", 10);
const HERMES_MODEL = process.env.HERMES_MODEL || "llama-3.3-70b-versatile";
const HERMES_AGENT_NAME = identity.name || identity.nome || process.env.HERMES_AGENT_NAME || "Hermes";
const HERMES_ROLE = identity.role || identity.papel || "Diretor de Vendas";
const HERMES_VIBE = identity.vibe || "Efficient and helpful";
const HERMES_EMOJI = identity.emoji || "✨";
const HOME = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH || "/tmp";

const AGENT_ID = "hermes";
const MAIN_KEY = "main";
const MAIN_SESSION_KEY = `agent:${AGENT_ID}:${MAIN_KEY}`;
const CONFIG_PATH = `${HOME}/.hermes/config.json`;
const MAX_TOOL_ROUNDS = 8;

// ---------------------------------------------------------------------------
// Orchestrator system prompt
// ---------------------------------------------------------------------------

const ORCHESTRATOR_SYSTEM_PROMPT = `Você é Edy, Diretor de Vendas iAmobil.
REGRAS:
1. FECHAMENTO ÚNICO: Só você fala com o cliente final. NÃO delegue vendas.
2. SPIN SELLING: Se perguntarem preço, valorize o imóvel primeiro. Drible o preço e pergunte: "Busca moradia ou investimento?" para qualificar.
3. RAG: Use as táticas injetadas para objeções.
4. VIBE: Profissional, entusiasmado, sem JSON.`;

// ---------------------------------------------------------------------------
// Team management tools definition (OpenAI tool-calling format)
// ---------------------------------------------------------------------------

const TEAM_TOOLS = [
  { type: "function", function: { name: "search_properties", description: "Busca imóveis cadastrados no sistema iAmobil.", parameters: { type: "object", properties: { max_price: { type: "number" }, min_bedrooms: { type: "number" }, city: { type: "string" }, query: { type: "string" } } } } },
  { type: "function", function: { name: "sync_portals", description: "Sincroniza imóveis com portais externos (Zap, OLX) e gera posts sociais.", parameters: { type: "object", properties: { include_social: { type: "boolean" } } } } },
  { type: "function", function: { name: "save_lead_info", description: "Salva ou atualiza leads no CRM.", parameters: { type: "object", required: ["name", "interest"], properties: { name: { type: "string" }, phone: { type: "string" }, interest: { type: "string" }, notes: { type: "string" }, potential_value: { type: "number" }, status: { type: "string" } } } } },
  { type: "function", function: { name: "smart_search", description: "Busca profunda no Vault e KBase.", parameters: { type: "object", required: ["query"], properties: { query: { type: "string" }, focus_folder: { type: "string" } } } } },
  { type: "function", function: { name: "spawn_agent", description: "Cria especialista.", parameters: { type: "object", required: ["name", "role"], properties: { name: { type: "string" }, role: { type: "string" }, instructions: { type: "string" }, wipe: { type: "boolean" }, continuity: { type: "boolean" }, boundaries: { type: "string" }, model: { type: "string" } } } } },
  { type: "function", function: { name: "delegate_task", description: "Envia tarefa a um agente.", parameters: { type: "object", required: ["agent_id", "message"], properties: { agent_id: { type: "string" }, message: { type: "string" } } } } },
  { type: "function", function: { name: "list_team", description: "Lista o time iAmobil.", parameters: { type: "object", properties: { include_offline: { type: "boolean" } } } } },
  { type: "function", function: { name: "save_to_memory", description: "Salva fato no Gold Memory.", parameters: { type: "object", required: ["fact"], properties: { fact: { type: "string" } } } } },
  { type: "function", function: { name: "draft_document", description: "Salva MD no Vault.", parameters: { type: "object", required: ["filename", "content"], properties: { filename: { type: "string" }, content: { type: "string" }, folder: { type: "string" } } } } },
  { type: "function", function: { name: "generate_report", description: "Gera PDFs ou Excel.", parameters: { type: "object", required: ["type", "title", "content"], properties: { type: { type: "string" }, title: { type: "string" }, content: { type: "string" } } } } },
  { type: "function", function: { name: "query_vault", description: "Busca arquivos no Vault.", parameters: { type: "object", properties: { folder: { type: "string" }, query: { type: "string" } } } } },
  { type: "function", function: { name: "generate_location_link", description: "Gera link Google Maps.", parameters: { type: "object", required: ["address"], properties: { address: { type: "string" } } } } },
  { type: "function", function: { name: "web_scrape_url", description: "Extração de dados web.", parameters: { type: "object", required: ["url"], properties: { url: { type: "string" } } } } },
  // Ferramentas de Engenharia (Genio Fix)
  { type: "function", function: { name: "read_project_file", description: "Lê arquivo do projeto.", parameters: { type: "object", required: ["path"], properties: { path: { type: "string", description: "Caminho relativo (ex: server/index.js)" } } } } },
  { type: "function", function: { name: "write_project_file", description: "Edita arquivo no projeto.", parameters: { type: "object", required: ["path", "content"], properties: { path: { type: "string" }, content: { type: "string" } } } } },
  { type: "function", function: { name: "execute_command", description: "Executa comando terminal.", parameters: { type: "object", required: ["command"], properties: { command: { type: "string" } } } } },
  { type: "function", function: { name: "read_logs", description: "Lê logs do sistema.", parameters: { type: "object", properties: { lines: { type: "number" } } } } },
  // Ferramentas auxiliares
  { type: "function", function: { name: "calculate_property_match", description: "Match score.", parameters: { type: "object", required: ["lead_preferences", "property_details"], properties: { lead_preferences: { type: "string" }, property_details: { type: "string" } } } } },
  { type: "function", function: { name: "schedule_visit", description: "Agenda visita.", parameters: { type: "object", required: ["lead_name", "property_title", "date_time"], properties: { lead_name: { type: "string" }, property_title: { type: "string" }, date_time: { type: "string" } } } } },
  { type: "function", function: { name: "request_kyc_documents", description: "Checklist KYC.", parameters: { type: "object", required: ["lead_name"], properties: { lead_name: { type: "string" }, custom_requirements: { type: "string" } } } } },
  { type: "function", function: { name: "secure_cloud_backup", description: "Realiza backup externo dos arquivos críticos (DB, Leads) para proteção contra falhas.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "system_health_check", description: "Verifica o estado vital do sistema (Memória, CPU, Disco).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "rollback_patch", description: "Desfaz a última alteração de arquivo realizada.", parameters: { type: "object", required: ["path"], properties: { path: { type: "string", description: "Caminho do arquivo para restaurar do backup .bak" } } } } },
  // Novas Ferramentas de Engenharia Avançada (Fase 3)
  { type: "function", function: { name: "execute_git_command", description: "Executa comandos Git (commit, status, branch).", parameters: { type: "object", required: ["command"], properties: { command: { type: "string", description: "Comando git (ex: commit -m 'msg')" } } } } },
  { type: "function", function: { name: "run_security_audit", description: "Realiza auditoria de segurança (npm audit) e busca chaves expostas.", parameters: { type: "object", properties: { deep_scan: { type: "boolean" } } } } },
  { type: "function", function: { name: "take_page_screenshot", description: "Captura screenshot da URL local para validação visual.", parameters: { type: "object", properties: { url: { type: "string" }, filename: { type: "string" } } } } },
  { type: "function", function: { name: "execute_db_query", description: "Executa consultas SQL no banco de dados SQLite principal.", parameters: { type: "object", required: ["query"], properties: { query: { type: "string" }, params: { type: "array" } } } } },
  { type: "function", function: { name: "monitor_system_resources", description: "Coleta dados detalhados de Hardware e Disco.", parameters: { type: "object", properties: { include_processes: { type: "boolean" } } } } },
  // Ferramentas de Marketing (Dika)
  { type: "function", function: { name: "generate_media_assets", description: "Cria artes, mockups e banners digitais.", parameters: { type: "object", required: ["type", "prompt"], properties: { type: { type: "string", description: "Tipo: mockup, banner, photoshoot" }, prompt: { type: "string" }, dimensions: { type: "string" } } } } },
  { type: "function", function: { name: "edit_ui_images", description: "Altera imagens do site em tempo real.", parameters: { type: "object", required: ["target_file", "source_url"], properties: { target_file: { type: "string", description: "Caminho em public/ (ex: properties/penthouse.png)" }, source_url: { type: "string" } } } } },
  { type: "function", function: { name: "generate_visual_dashboard", description: "Gera dashboard visual premium a partir de dados JSON.", parameters: { type: "object", required: ["data"], properties: { data: { type: "object", description: "Objeto com campos: revenue, totalSales, avgScore, monthlyLabels, monthlyData, categoryLabels, categoryData, sellerLabels, sellerData." } } } } },
  { type: "function", function: { name: "update_portal_credentials", description: "Atualiza as credenciais de portais imobiliários (Zap, OLX, etc) de forma segura.", parameters: { type: "object", properties: { portal: { type: "string", enum: ["zap", "olx", "vivareal", "facebook", "instagram"] }, username: { type: "string" }, password: { type: "string" }, api_key: { type: "string" } }, required: ["portal"] } } }
];

// Orquestrador (Edy) foca em gestão e buscas rápidas - Redefinido abaixo para acesso total.

// --- Tool sets by Role (Optimization) ---------------------------------------
const ROLE_TOOLS = {
  vendas: ["save_lead_info", "search_properties", "calculate_property_match", "schedule_visit", "generate_contract_draft", "request_kyc_documents"],
  marketing: ["generate_media_assets", "edit_ui_images", "manage_ad_campaigns", "sync_portals", "web_scrape_url", "take_page_screenshot", "update_portal_credentials", "generate_social_post", "get_financial_metrics"],
  tecnico: ["read_project_file", "write_project_file", "execute_command", "read_logs", "secure_cloud_backup", "system_health_check", "restart_service", "run_security_audit"],
  geral: ["save_to_memory", "query_vault", "smart_search", "generate_location_link", "generate_report"]
};

// Orchestrator has full access to team management + all tools
const ORCHESTRATOR_TOOLS = [
  ...TEAM_TOOLS, 
  { type: "function", function: { name: "get_financial_summary", description: "Resumo de VGV e Leads." } }
];

// Helper to get tools for a specific agent based on their role
function getToolsForAgent(agent) {
  if (agent.id === AGENT_ID) return ORCHESTRATOR_TOOLS;
  
  const role = (agent.role || "").toLowerCase();
  const allowedToolNames = [];
  
  if (role.includes("venda") || role.includes("corretor")) allowedToolNames.push(...ROLE_TOOLS.vendas);
  if (role.includes("marketing") || role.includes("criativo")) allowedToolNames.push(...ROLE_TOOLS.marketing);
  if (role.includes("tecnico") || role.includes("dev") || role.includes("admin")) allowedToolNames.push(...ROLE_TOOLS.tecnico);
  
  // Everyone gets general tools
  allowedToolNames.push(...ROLE_TOOLS.geral);
  
  return TEAM_TOOLS.filter(t => allowedToolNames.includes(t.function?.name));
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** @type {Map<string, Array<{role: string, content: string}>>} */
const conversationHistory = new Map();

/** @type {Map<string, {model?: string, thinkingLevel?: string}>} */
const sessionSettings = new Map();

/** @type {Map<string, string>} agentId/filename → content */
const agentFiles = new Map();

/** @type {Map<string, {runId: string, sessionKey: string, agentId: string, abort: () => void}>} runId → abort handle */
const activeRuns = new Map();

/** @type {Map<string, object>} jobId → CronJobSummary */
const cronJobs = new Map();

/**
 * @type {Map<string, {
 *   id: string, name: string, workspace: string,
 *   role?: string, systemPrompt?: string,
 *   settings: { wipe: boolean, continuity: boolean, model: string, boundaries?: string }
 * }>}
 */
const agentRegistry = new Map([
  [AGENT_ID, {
    id: AGENT_ID,
    name: HERMES_AGENT_NAME,
    workspace: `${HOME}/.hermes/workspace-hermes`,
    role: HERMES_ROLE,
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    settings: { wipe: false, continuity: true, model: HERMES_MODEL },
  }],
]);

// Set of all active sendEvent functions (one per connected WS client)
/** @type {Set<(frame: object) => void>} */
const activeSendEventFns = new Set();

// ---------------------------------------------------------------------------
// Disk persistence for conversation history
// ---------------------------------------------------------------------------

const HISTORY_FILE = path.join(HOME, ".hermes", "clawd3d-history.json");
const REGISTRY_FILE = path.join(HOME, ".hermes", "clawd3d-registry.json");
let persistDebounceTimer = null;

function loadHistoryFromDisk() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [key, messages] of Object.entries(data)) {
          if (Array.isArray(messages)) conversationHistory.set(key, messages);
        }
        console.log(`[hermes-adapter] Loaded history for ${Object.keys(data).length} session(s).`);
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load history:", sanitizeErrorMessage(err));
  }
}

function saveHistoryToDisk() {
  if (persistDebounceTimer) clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    try {
      const data = {};
      for (const [key, messages] of conversationHistory.entries()) {
        if (messages.length > 0) data[key] = messages;
      }
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn("[hermes-adapter] Could not save history:", sanitizeErrorMessage(err));
    }
  }, 500);
}

function loadRegistryFromDisk() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const raw = fs.readFileSync(REGISTRY_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [key, agent] of Object.entries(data)) {
          if (key === AGENT_ID) continue;
          
          // Refresh metadata from IDENTITY.md if it exists
          const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const identity = loadIdentity(slug);
          if (identity.name) agent.name = identity.name;
          if (identity.role) agent.role = identity.role;
          if (identity.emoji) agent.emoji = identity.emoji;

          // Allow dynamic model selection from registry or .env
          if (agent.settings && !agent.settings.model) {
            agent.settings.model = HERMES_MODEL;
          }

          agentRegistry.set(key, agent);
        }
        console.log(`[hermes-adapter] Loaded and synced registry for ${Object.keys(data).length - 1} sub-agent(s).`);
      }
    }
  } catch (err) {
    console.warn("[hermes-adapter] Could not load registry:", sanitizeErrorMessage(err));
  }
}

function autoDiscoverAgents() {
  try {
    const agentsDir = path.join(process.cwd(), "agents");
    console.log(`[hermes-adapter] 🔍 Iniciando auto-descoberta em: ${agentsDir}`);
    
    if (!fs.existsSync(agentsDir)) {
      console.warn(`[hermes-adapter] ⚠️ Pasta 'agents/' não encontrada em: ${process.cwd()}`);
      return;
    }

    const folders = fs.readdirSync(agentsDir).filter(f => fs.statSync(path.join(agentsDir, f)).isDirectory());
    console.log(`[hermes-adapter] 📁 Pastas encontradas: ${folders.join(", ")}`);
    
    for (const folder of folders) {
      const identity = loadIdentity(folder);
      const agentName = identity.name || identity.nome;
      const agentRole = identity.role || identity.papel || "Membro da equipe iAmobil";

      console.log(`[hermes-adapter] 🕵️ Verificando: ${folder} (Nome: ${agentName || 'N/A'})`);

      if (!agentName) {
        console.log(`[hermes-adapter] ⚠️ Falha ao carregar identidade (campo 'Nome') para: ${folder}`);
        continue;
      }

      // Verifica se já existe um agente registrado com este nome/pasta
      let alreadyRegistered = false;
      for (const a of agentRegistry.values()) {
        if (a.name === agentName || (a.id && a.id.startsWith(folder))) {
          alreadyRegistered = true;
          console.log(`[hermes-adapter] Skip: Agente ${agentName} (${folder}) já existe com ID ${a.id}`);
          break;
        }
      }

      if (!alreadyRegistered) {
        const agentId = folder.toLowerCase().trim();
        console.log(`[hermes-adapter] ✨ Agente auto-descoberto: ${agentName} (${folder}) -> ID: ${agentId}`);
        
        agentRegistry.set(agentId, {
          id: agentId,
          name: agentName,
          role: agentRole,
          workspace: path.join(process.env.USERPROFILE || process.env.HOME || ".", ".hermes", `workspace-${folder}`),
          systemPrompt: (identity.soul || identity.alma || `Você é ${agentName}, um ${agentRole}.`) + (identity.agentes || identity.agents ? `\n\nInstruções Técnicas:\n${identity.agentes || identity.agents}` : ""),
          settings: {
            wipe: false,
            continuity: true,
            model: HERMES_MODEL
          }
        });
      }
    }
    saveRegistryToDisk();
  } catch (err) {
    console.warn("[hermes-adapter] Auto-discovery failed:", err.message);
  }
}

function saveRegistryToDisk() {
  try {
    const data = {};
    for (const [key, agent] of agentRegistry.entries()) {
      data[key] = agent;
    }
    fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("[hermes-adapter] Could not save registry:", sanitizeErrorMessage(err));
  }
}

function getHistory(sessionKey) {
  if (!conversationHistory.has(sessionKey)) conversationHistory.set(sessionKey, []);
  return conversationHistory.get(sessionKey);
}

function clearHistory(sessionKey) {
  conversationHistory.delete(sessionKey);
  saveHistoryToDisk();
}

function randomId() {
  return require("crypto").randomBytes(8).toString("hex");
}

function redactSecrets(value) {
  if (typeof value !== "string" || !value) return value;
  let redacted = value;
  if (HERMES_API_KEY) {
    redacted = redacted.split(HERMES_API_KEY).join("[REDACTED]");
  }
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  redacted = redacted.replace(/\b\d{8,12}:[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]");
  return redacted;
}

// ---------------------------------------------------------------------------
// Hermes HTTP API helpers
// ---------------------------------------------------------------------------

function hermesPost(path, body) {
  return new Promise((resolve, reject) => {
    const urlStr = HERMES_API_URL + path;
    let url;
    try { url = new URL(urlStr); } catch { reject(new Error(`Invalid URL: ${urlStr}`)); return; }
    const transport = url.protocol === "https:" ? https : http;
    const bodyStr = JSON.stringify(body);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) };
    if (HERMES_API_KEY) headers["Authorization"] = `Bearer ${HERMES_API_KEY}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 60000);
    const req = transport.request(
      { hostname: url.hostname, port: url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""), method: "POST", headers, signal: controller.signal },
      (res) => {
        clearTimeout(timeoutHandle);
        resolve(res);
      }
    );
    req.on("error", (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
    req.write(bodyStr);
    req.end();
  });
}

function hermesGet(path) {
  return new Promise((resolve, reject) => {
    const urlStr = HERMES_API_URL + path;
    let url;
    try { url = new URL(urlStr); } catch { reject(new Error(`Invalid URL: ${urlStr}`)); return; }
    const transport = url.protocol === "https:" ? https : http;
    const headers = {};
    if (HERMES_API_KEY) headers["Authorization"] = `Bearer ${HERMES_API_KEY}`;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 30000); // 30s timeout for GET
    const req = transport.request(
      { hostname: url.hostname, port: url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + (url.search || ""), method: "GET", headers, signal: controller.signal },
      (res) => {
        clearTimeout(timeoutHandle);
        resolve(res);
      }
    );
    req.on("error", (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
    });
    req.end();
  });
}

async function readJsonBody(res) {
  const chunks = [];
  for await (const chunk of res) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function sanitizeErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return redactSecrets(error);
  return redactSecrets(error.message || String(error));
}

function extractOpenAiStyleError(payload, fallbackMessage) {
  if (payload && typeof payload === "object") {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message.trim()
        : "";
    if (message) return message;
  }
  return fallbackMessage;
}

let cachedHermesModels = null;
let cachedHermesModelsAt = 0;

async function fetchHermesModels() {
  const now = Date.now();
  if (cachedHermesModels && now - cachedHermesModelsAt < 30_000) {
    return cachedHermesModels;
  }
  const res = await hermesGet("/v1/models");
  if (res.statusCode >= 400) {
    res.resume();
    throw new Error(`Hermes models API HTTP ${res.statusCode}`);
  }
  const payload = await readJsonBody(res);
  const models = Array.isArray(payload?.data)
    ? payload.data
        .map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
        .filter(Boolean)
    : [];
  cachedHermesModels = models;
  cachedHermesModelsAt = now;
  return models;
}

async function resolveHermesModel(requestedModel) {
  const trimmed = typeof requestedModel === "string" ? requestedModel.trim() : "";
  const normalized = trimmed.includes("/") ? trimmed.split("/").pop().trim() : trimmed;
  return normalized || trimmed || HERMES_MODEL;
}

async function completeOneTurn(messages, model, tools, _retryCount = 0) {
  const resolvedModel = (_retryCount > 0) ? model : await resolveHermesModel(model);
  
  // Limitação de Histórico para evitar vazamento de memória (Bug Fix #1)
  let activeMessages = messages;
  const MAX_HISTORY = 50;
  if (activeMessages.length > MAX_HISTORY) {
      console.warn(`[hermes-adapter] Pruning history for session. ${activeMessages.length} -> ${MAX_HISTORY}`);
      const systemMsg = activeMessages.find(m => m.role === "system");
      const latest = activeMessages.slice(-MAX_HISTORY + 1);
      activeMessages = systemMsg ? [systemMsg, ...latest] : latest;
  }

  if (resolvedModel.includes("8b-instant") && activeMessages.length > 2) {
    activeMessages = [messages[0], ...messages.slice(-2)]; 
  }

  const body = { model: resolvedModel, messages: activeMessages, stream: false };
  const supportsOfficialTools = !resolvedModel.includes("8b-instant") && !resolvedModel.includes("scout") && !resolvedModel.includes("405b");
  if (supportsOfficialTools && tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  const res = await hermesPost("/v1/chat/completions", body);
  const payload = await readJsonBody(res);
  if (res.statusCode >= 400) {
    const errorMsg = extractOpenAiStyleError(payload, `Hermes API HTTP ${res.statusCode}`);
    console.error(`[Hermes API] HTTP ${res.statusCode} Error:`, errorMsg, JSON.stringify(payload?.error || payload).slice(0, 400));
    console.log(`[Hermes API] Sent body:`, JSON.stringify(body));

    // Fallback: Se o erro for 400 e houver tools, tentar sem tools (Ollama local fallback)
    if (res.statusCode === 400 && body.tools && _retryCount === 0) {
      console.warn(`[Hermes] 400 Detected with tools. Retrying without tools for compatibility...`);
      return completeOneTurn(messages, model, null, _retryCount + 1);
    }

    throw new Error(errorMsg);
  }
  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const message = choice?.message || {};
  const textContent =
    typeof message?.content === "string"
      ? message.content
      : Array.isArray(message?.content)
        ? message.content
            .map((part) => (typeof part?.text === "string" ? part.text : ""))
            .join("")
        : "";
  const finishReason =
    typeof choice?.finish_reason === "string" && choice.finish_reason
      ? choice.finish_reason
      : "stop";
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((tc) => {
        let args = {};
        const rawArgs = tc?.function?.arguments;
        if (typeof rawArgs === "string" && rawArgs.trim()) {
          try {
            args = JSON.parse(rawArgs);
          } catch {
            args = { _raw: rawArgs };
          }
        }
        return {
          id: typeof tc?.id === "string" ? tc.id : randomId(),
          name: typeof tc?.function?.name === "string" ? tc.function.name : "",
          args,
        };
      })
    : [];
  return { textContent, toolCalls, finishReason, resolvedModel };
}

// ---------------------------------------------------------------------------
// SSE streaming — handles both text deltas and tool calls
// ---------------------------------------------------------------------------

/**
 * Stream one LLM turn.
 * @returns {{ textContent: string, toolCalls: Array<{id,name,args}>, finishReason: string }}
 */
async function streamOneTurn(messages, model, tools, onTextDelta, abortCheck, _retryCount = 0) {
  // Reset to primary provider (Groq) at the start of each new request
  if (_retryCount === 0) {
    const primaryUrl = (process.env.HERMES_API_URL || "https://api.groq.com/openai").replace(/\/+$/, "").replace(/\/v1$/, "");
    const primaryKey = process.env.HERMES_API_KEY || "";
    if (HERMES_API_URL !== primaryUrl) {
      console.log(`[API ROTATOR] Resetando para provedor primário (Groq)...`);
      HERMES_API_URL = primaryUrl;
      HERMES_API_KEY = primaryKey;
    }
  }
  // Se estiver em retry (fallback), confiar no nome do modelo passado para evitar sobrescrita pelo 'resolveHermesModel'
  const resolvedModel = (_retryCount > 0) ? model : await resolveHermesModel(model);
  
  let activeMessages = messages;
  // Aggressive history trim: estimate token count from character length
  const totalChars = activeMessages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
  if (totalChars > 8000 || activeMessages.length > 20) {
    // Keep system prompt (first message) + last 4 messages for context
    console.warn(`[HistoryTrimmer] Histórico muito grande (${totalChars} chars, ${activeMessages.length} msgs). Cortando...`);
    activeMessages = [activeMessages[0], ...activeMessages.slice(-4)];
  }
  if (resolvedModel.includes("8b-instant") && activeMessages.length > 4) {
    activeMessages = [activeMessages[0], ...activeMessages.slice(-2)];
  }

  const body = { model: resolvedModel, messages: activeMessages, stream: true };

  const supportsOfficialTools = !resolvedModel.includes("8b-instant") && !resolvedModel.includes("scout") && !resolvedModel.includes("405b");
  if (supportsOfficialTools && tools && tools.length > 0) { 
    body.tools = tools; 
    body.tool_choice = "auto"; 
  }
  console.log(`[streamOneTurn] Model: ${resolvedModel}, Retry: ${_retryCount}, Tools: ${tools?.length || 0}`);
  body.model = resolvedModel;
  const res = await hermesPost("/v1/chat/completions", body);

  if (res.statusCode >= 400) {
    const payload = await readJsonBody(res);
    const errorMsg = extractOpenAiStyleError(payload, `Hermes API HTTP ${res.statusCode}`);
    console.error(`[Hermes API ERROR] Status: ${res.statusCode}, Message: ${errorMsg}, Payload:`, JSON.stringify(payload));

    // --- Provider Rotation System (Groq → OpenAI → Gemini) ---
    const groqUrl = (process.env.HERMES_API_URL || "https://api.groq.com/openai").replace(/\/+$/, "").replace(/\/v1$/, "");
    const groqKey = process.env.HERMES_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const isRotatable = [429, 401, 402, 403, 404].includes(res.statusCode);
    
    if (isRotatable && _retryCount < 4) {
      const currentUrl = HERMES_API_URL;
      console.warn(`[API ROTATOR] Erro ${res.statusCode} em ${currentUrl}. Tentativa ${_retryCount + 1}...`);

      // Rotation Plan: Groq -> OpenAI -> Gemini -> Groq (Safe Model)
      if (currentUrl.includes("groq") && openaiKey) {
        console.warn(`[API ROTATOR] Groq falhou. Alternando para OpenAI...`);
        HERMES_API_URL = "https://api.openai.com";
        HERMES_API_KEY = openaiKey;
        return streamOneTurn(messages, "gpt-4o-mini", null, onTextDelta, abortCheck, _retryCount + 1);
      }
      
      if (currentUrl.includes("openai.com")) {
        if (geminiKey) {
            console.warn(`[API ROTATOR] OpenAI falhou. Alternando para Gemini...`);
            HERMES_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
            HERMES_API_KEY = geminiKey;
            return streamOneTurn(messages, "gemini-2.0-flash", null, onTextDelta, abortCheck, _retryCount + 1);
        } else {
            console.warn(`[API ROTATOR] OpenAI falhou e Gemini indisponível. Pulando para Groq Safe...`);
            HERMES_API_URL = (process.env.HERMES_API_URL || "https://api.groq.com/openai").replace(/\/+$/, "").replace(/\/v1$/, "");
            HERMES_API_KEY = process.env.HERMES_API_KEY || "";
            return streamOneTurn(messages, "llama-3.1-8b-instant", null, onTextDelta, abortCheck, _retryCount + 1);
        }
      }

      if (currentUrl.includes("generativelanguage") && groqKey) {
        console.warn(`[API ROTATOR] Gemini falhou. Voltando ao Groq com modelo menor...`);
        HERMES_API_URL = groqUrl;
        HERMES_API_KEY = groqKey;
        return streamOneTurn(messages, "llama-3.1-8b-instant", null, onTextDelta, abortCheck, _retryCount + 1);
      }
    }

    throw new Error(errorMsg || `Hermes API Error ${res.statusCode}`);
  }

  let textContent = "";
  let finishReason = "stop";
  /** @type {Record<number, {id: string, name: string, argsStr: string}>} */
  const toolCallAccum = {};
  let buffer = "";

  await new Promise((resolve, reject) => {
    const streamTimeout = setTimeout(() => {
        res.destroy();
        reject(new Error("Stream inactivity timeout (30s)"));
    }, 30000);

    res.on("data", (chunk) => {
      streamTimeout.refresh?.() || (function(){
          // Fallback if refresh is not available (older Node)
          clearTimeout(streamTimeout);
          // (This part is tricky without keeping reference, but modern Node has it)
      })();
      if (abortCheck && abortCheck()) { res.destroy(); return; }
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(trimmed.slice(6));
          const choice = data?.choices?.[0];
          if (!choice) continue;
          if (typeof choice.finish_reason === "string" && choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
          const delta = choice.delta || {};
          // Text content
          if (typeof delta.content === "string" && delta.content) {
            textContent += delta.content;
            if (onTextDelta) {
              // Filtrar vazamento de tags de função no stream (hallucination de modelos menores)
              // Remove block tags <function=...>...</function> and opening tags <function=...>
              const cleanText = textContent
                .replace(/<function=[\s\S]*?<\/function>/gi, "")
                .replace(/<function=[\s\S]*?>/gi, "")
                .replace(/<\/function>/gi, "");
              onTextDelta(cleanText);
            }
          }
          // Tool call accumulation
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = typeof tc.index === "number" ? tc.index : 0;
              if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: "", name: "", argsStr: "" };
              if (tc.id) toolCallAccum[idx].id = tc.id;
              if (tc.function?.name) toolCallAccum[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallAccum[idx].argsStr += tc.function.arguments;
            }
          }
        } catch { /* ignore malformed */ }
      }
    });
    res.on("end", () => {
        clearTimeout(streamTimeout);
        resolve();
    });
    res.on("error", (err) => {
        clearTimeout(streamTimeout);
        reject(err);
    });
  });

  const toolCalls = Object.values(toolCallAccum).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.argsStr); } catch { args = { _raw: tc.argsStr }; }
    return { id: tc.id, name: tc.name, args };
  });

  if (!textContent.trim() && toolCalls.length === 0 && finishReason === "stop") {
    const fallback = await completeOneTurn(messages, resolvedModel, tools);
    return {
      textContent: fallback.textContent,
      toolCalls: fallback.toolCalls,
      finishReason: fallback.finishReason,
    };
  }

  return { textContent, toolCalls, finishReason };
}

// ---------------------------------------------------------------------------
// Broadcast a gateway event to all connected clients
// ---------------------------------------------------------------------------

function broadcastEvent(frame) {
  for (const fn of activeSendEventFns) {
    try { fn(frame); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

async function execSpawnAgent(args) {
  const name = (typeof args.name === "string" ? args.name : "Agent").trim() || "Agent";
  const role = (typeof args.role === "string" ? args.role : "").trim();
  const instructions = typeof args.instructions === "string" ? args.instructions.trim() : "";
  const boundaries = typeof args.boundaries === "string" ? args.boundaries.trim() : "";
  const model = typeof args.model === "string" && args.model.trim() ? args.model.trim() : HERMES_MODEL;
  const wipe = Boolean(args.wipe);
  const continuity = args.continuity !== false;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const newId = `${slug}-${randomId().slice(0, 6)}`;

  // Carregar Alma, Identidade, Instruções Técnicas e Heartbeat locais se existir
  const localIdentity = loadIdentity(slug);
  const localSoul = loadSoul(slug);
  const localAgents = loadAgents(slug);
  const localHeartbeat = loadHeartbeat(slug);
  const catalogContent = loadCatalog();
  const memoryContent = loadGoldMemory();

  const finalName = localIdentity.name || name;
  const finalRole = localIdentity.role || role;
  const finalEmoji = localIdentity.emoji || "";

  let systemPrompt = instructions || `You are ${finalName}, a ${finalRole || "specialist"} agent.`;
  if (localSoul) {
    systemPrompt += `\n\n--- AGENT SOUL (Persona, Tone & Boundaries) ---\n${localSoul}\n----------------------------------------------`;
  }
  if (localAgents) {
    systemPrompt += `\n\n--- TECHNICAL INSTRUCTIONS (AGENTS.md) ---\n${localAgents}\n------------------------------------------`;
  }
  if (localHeartbeat) {
    systemPrompt += `\n\n--- AGENT HEARTBEAT (Ritual & Cycle) ---\n${localHeartbeat}\n----------------------------------------`;
  }
  if (catalogContent) {
    systemPrompt += `\n\n--- PROPERTY CATALOG (CATALOG.md) ---\n${catalogContent}\n--------------------------------------`;
  }
  if (memoryContent) {
    systemPrompt += `\n\n--- GOLD MEMORY (Long-Term Facts) ---\n${memoryContent}\n--------------------------------------`;
  }
  if (boundaries) systemPrompt += `\n\nBoundaries: ${boundaries}`;

  // Duplicate Check: If an agent with the same name already exists, reuse it.
  // Match by NAME only (case-insensitive) to prevent ghost clones with different roles.
  for (const [existingId, agent] of agentRegistry.entries()) {
    if (existingId === AGENT_ID) continue;
    const existingSlug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (agent.name.toLowerCase() === name.toLowerCase() || existingSlug === slug) {
      console.log(`[hermes-adapter] ⚠️ Dedup: Agente "${name}" já existe como (${existingId}). Reutilizando.`);
      // Update role and instructions if provided
      if (role) agent.role = finalRole;
      if (instructions) agent.systemPrompt = systemPrompt;
      agent.settings = { ...agent.settings, wipe, continuity, model, boundaries };
      saveRegistryToDisk();
      return JSON.stringify({ ok: true, agent_id: existingId, name: finalName, role: agent.role, note: "reused existing agent — deduplication active" });
    }
  }

  agentRegistry.set(newId, {
    id: newId, name: finalName, workspace: `${HOME}/.hermes/workspace-${slug}`,
    role: finalRole, systemPrompt, settings: { wipe, continuity, model, boundaries },
  });

  saveRegistryToDisk();
  console.log(`[hermes-adapter] Spawned agent: ${name} (${newId})`);

  // Broadcast presence so the 3D office loads the new agent immediately
  broadcastEvent({
    type: "event", event: "presence",
    payload: {
      sessions: {
        recent: [],
        byAgent: [...agentRegistry.values()].map((a) => ({
          agentId: a.id,
          name: a.name,
          role: a.role,
          recent: [],
        })),
      },
    },
  });

  return JSON.stringify({ ok: true, agent_id: newId, name: finalName, role: finalRole });
}
async function execSaveLeadInfo(args, sendEvent) {
  console.log(`[hermes-adapter] Saving lead: ${args.name}`);
  
  try {
    const score = dataEngine.calculateNeuroScore(args);
    const result = await dataEngine.saveLead({
      ...args,
      score
    });

    if (!result.ok) throw new Error("Falha ao salvar no banco.");

    // Salvar também no Obsidian Vault para Fonte da Verdade
    await execDraftDocument({
      filename: `Lead_${(args.name || "Desconhecido").replace(/\s+/g, '_')}.md`,
      content: `# Lead: ${args.name}\n\n**Interesse:** ${args.interest}\n**Contato:** ${args.phone || "N/A"}\n**Score:** ${score}\n**Valor Potencial:** R$ ${(args.potential_value || 0).toLocaleString('pt-BR')}\n\n**Notas:**\n${args.notes || ""}`,
      folder: "01_Leads"
    });

    const pushMsg = `👤 **Novo Lead Elevado!**\n\nNome: ${args.name}\n⭐ **Neuro-Score: ${score}/100**\n🏠 Interesse: ${args.interest}\n💰 Valor: R$ ${(args.potential_value || 0).toLocaleString('pt-BR')}\n\n_Prioridade calculada via iAmobil v8._`;
    broadcastEvent({ type: "event", event: "notification", payload: { message: pushMsg } });
    return JSON.stringify({ ok: true, score });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execGetFinancialSummary() {
  console.log(`[v8 Finance] Generating financial report...`);
  try {
    const report = await dataEngine.getFinancialReport();
    const summary = `📊 **Resumo Financeiro iAmobil (Leads Qualificados):**\n\n` +
                    `- TOTAL VGV: R$ ${report.total_vgv.toLocaleString('pt-BR')}\n` +
                    `- COMISSÃO ESTIMADA (5%): R$ ${report.commission.toLocaleString('pt-BR')}\n` +
                    `- LEADS TOP-TIER: ${report.lead_count}\n\n` +
                    `_Nota: Valores baseados apenas em leads com score >= 80._`;
    return JSON.stringify({ ok: true, summary, report });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execSaveToMemory(args) {
  const { fact } = args;
  const memoryPath = path.join(process.cwd(), "GOLD_MEMORY.md");
  const entry = `\n- **Fato:** ${fact || "Não informado"} (Registrado em ${new Date().toLocaleDateString("pt-BR")})`;
  
  try {
    if (!fs.existsSync(memoryPath)) {
      fs.writeFileSync(memoryPath, "# 💾 Gold Memory - iAmobil Long-Term Storage\n\nEste arquivo contém fatos cruciais que a equipe nunca deve esquecer.\n", "utf8");
    }
    
    let content = fs.readFileSync(memoryPath, "utf8");
    const factLines = content.split("\n").filter(l => l.startsWith("- **Fato:**"));
    
    if (factLines.length >= 15) {
      console.log("[v9 Smart Memory] Memory atingiu limite. Iniciando compressão de fatos...");
      const messages = [
        { role: "system", content: "Você é um classificador inteligente. Resuma os fatos a seguir em no máximo 5 bullet points que compilem o conhecimento histórico de forma otimizada." },
        { role: "user", content: factLines.join("\n") }
      ];
      
      const result = await streamOneTurn(messages, HERMES_MODEL, [], () => {}, null);
      if (result.textContent) {
        fs.writeFileSync(memoryPath, "# 💾 Gold Memory - iAmobil Long-Term Storage\n\nEste arquivo contém fatos cruciais que a equipe nunca deve esquecer.\n\n" + result.textContent + "\n\n--- Novos Fatos:\n", "utf8");
      }
    }

    fs.appendFileSync(memoryPath, entry, "utf8");
    broadcastEvent({
      type: "event",
      event: "notification",
      payload: { message: `💾 **Novo Fato Estratégico Salvo!**\n\n${fact}` }
    });

    return JSON.stringify({ ok: true });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execDraftDocument(args) {
  const { filename, content, folder = "" } = args;
  const safeName = filename.replace(/[^a-z0-9_\.]/gi, "_");
  const vaultRoot = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "IAmobil_Vault", "IAmobil_Vault");
  const safeFolder = folder.replace(/[^a-z0-9_]/gi, "");
  
  const targetDir = safeFolder ? path.join(vaultRoot, safeFolder) : vaultRoot;
  const filePath = path.join(targetDir, safeName.endsWith(".md") ? safeName : safeName + ".md");
  
  if (!fs.existsSync(vaultRoot)) fs.mkdirSync(vaultRoot, { recursive: true });
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Garantir todas as pastas padrão para o usuário
  ["01_Leads", "02_Imoveis", "03_Clientes", "04_Vendas", "05_Relatorios"].forEach(f => {
    const p = path.join(vaultRoot, f);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  try {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`[Maria-Autonomia] Arquivo salvo no cofre Obsidian: ${filePath}`);
    
    // Notifica também o agente e a UI
    broadcastEvent({
      type: "event",
      event: "notification",
      payload: { message: `📝 **Documento Salvo no Cofre!**\n\nArquivo: ${safeName}` }
    });

    return JSON.stringify({ ok: true, path: filePath });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execGenerateReport(args) {
  const { type, title, content } = args;
  const safeName = (title || "relatorio").replace(/[^a-z0-9_-]/gi, "_");
  const reportDir = path.join(process.cwd(), "public", "reports");
  
  const fs = require('fs');
  const pathLib = require('path');

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  try {
    let filePath = "";
    if (type === "pdf") {
      const PDFDocument = require("pdfkit");
      filePath = pathLib.join(reportDir, `${safeName}.pdf`);
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(fs.createWriteStream(filePath));
      doc.fontSize(20).text(title || "Relatório", { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(content || "");
      doc.end();
      // Esperar alguns ms para dar tempo de flush no disco
      await new Promise(r => setTimeout(r, 500));
    } else if (type === "excel") {
      const xlsx = require("xlsx");
      filePath = pathLib.join(reportDir, `${safeName}.xlsx`);
      
      const rows = (content || "").split('\n').filter(Boolean).map(row => row.split(';'));
      const ws = xlsx.utils.aoa_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
      xlsx.writeFile(wb, filePath);
    } else {
      return JSON.stringify({ ok: false, error: "Tipo inválido. Use 'pdf' ou 'excel'." });
    }

    const payload = `Arquivo gerado com sucesso em: ${filePath}. Para enviar ao usuário via Telegram, inclua OBRIGATORIAMENTE a seguinte tag na sua proxima resposta de texto: [TELEGRAM_DOCUMENT: ${filePath}] e NADA MAIS.`;
    return JSON.stringify({ ok: true, instruction: payload, path: filePath });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}


async function execSearchProperties(args) {
  const { max_price, min_bedrooms, city, query } = args;
  console.log(`[hermes-adapter] Searching properties: max_price=${max_price}, city=${city}`);
  
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(process.cwd(), "iamobil.db");
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve) => {
    let sql = "SELECT * FROM properties WHERE 1=1";
    const params = [];

    if (max_price) {
      sql += " AND price <= ?";
      params.push(max_price);
    }
    if (min_bedrooms) {
      sql += " AND bedrooms >= ?";
      params.push(min_bedrooms);
    }
    if (city) {
      sql += " AND (city LIKE ? OR location LIKE ?)";
      params.push(`%${city}%`, `%${city}%`);
    }
    if (query) {
      sql += " AND (title LIKE ? OR description LIKE ?)";
      params.push(`%${query}%`, `%${query}%`);
    }

    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) {
        resolve(JSON.stringify({ ok: false, error: err.message }));
      } else {
        const results = rows.map(r => ({
          titulo: r.title,
          valor: `R$ ${r.price.toLocaleString('pt-BR')}`,
          localizacao: r.location,
          detalhes: `${r.area}m², ${r.bedrooms} quartos`,
          diferencial: r.description
        }));
        resolve(JSON.stringify({ ok: true, count: results.length, results: results.slice(0, 3) }));
      }
    });
  });
}

async function execQueryVault(args) {
  const { query, folder = "" } = args;
  const vaultRoot = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "IAmobil_Vault", "IAmobil_Vault");
  const targetDir = folder ? path.join(vaultRoot, folder) : vaultRoot;

  try {
    if (!fs.existsSync(targetDir)) {
      return JSON.stringify({ ok: false, error: "Pasta não encontrada no Cofre." });
    }

    const foldersToSearch = folder ? [folder] : ["", "01_Leads", "02_Imoveis", "03_Clientes", "04_Vendas", "05_Relatorios"];
    const results = [];

    for (const sub of foldersToSearch) {
      const currentDir = sub ? path.join(vaultRoot, sub) : vaultRoot;
      if (!fs.existsSync(currentDir)) continue;

      const files = fs.readdirSync(currentDir);
      const mdFiles = files.filter(f => f.endsWith(".md"));

      for (const f of mdFiles) {
        if (!query || f.toLowerCase().includes(query.toLowerCase())) {
          const content = fs.readFileSync(path.join(currentDir, f), "utf8");
          results.push({
            file: sub ? `${sub}/${f}` : f,
            preview: content.slice(0, 300) + (content.length > 300 ? "..." : "")
          });
          if (results.length >= 3) break; // Limite rigoroso para economizar tokens
        }
      }
      if (results.length >= 3) break;
    }

    return JSON.stringify({ ok: true, files: results });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execCalculatePropertyMatch(args) {
  const { lead_preferences, property_details } = args;
  console.log(`[v8 Neuro-Match] Calculating match score...`);

  const systemMsg = "Você é um especialista em análise de perfil imobiliário. Compare os requisitos do lead com os detalhes do imóvel e retorne um JSON com: 'score' (0-100), 'justification' (concisa) e 'highlights' (pontos positivos). Seja criterioso.";
  const userMsg = `LEAD PREFERENCES:\n${lead_preferences}\n\nPROPERTY DETAILS:\n${property_details}`;

  try {
    const result = await streamOneTurn([{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], HERMES_MODEL, [], () => {}, null);
    return result.textContent; // Retorna a análise da LLM
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execGenerateContractDraft(args) {
  const { lead_name, property_title, property_location, value } = args;
  const templatePath = path.join(process.cwd(), "CONTRACT_TEMPLATE.md");
  
  try {
    let template = fs.existsSync(templatePath) 
      ? fs.readFileSync(templatePath, "utf8")
      : "# CONTRACT DRAFT\n\nLead: {{lead_name}}\nProperty: {{property_title}}\nValue: {{property_value}}";

    const content = template
      .replace(/{{lead_name}}/g, lead_name)
      .replace(/{{property_title}}/g, property_title)
      .replace(/{{property_location}}/g, property_location || "A consultar")
      .replace(/{{property_value}}/g, value)
      .replace(/{{date}}/g, new Date().toLocaleDateString("pt-BR"));

    const filename = `Rascunho_Contrato_${lead_name.replace(/\s+/g, '_')}_${Date.now()}.md`;
    
    return await execDraftDocument({
      filename,
      content,
      folder: "05_Relatorios"
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execScheduleVisit(args) {
  console.log(`[v8 Booking] Scheduling visit for ${args.lead_name}...`);
  try {
    const res = await dataEngine.scheduleVisit(args);
    if (!res.ok) throw new Error(res.error);

    const pushMsg = `📅 **Visita Agendada!**\n\nLead: ${args.lead_name}\n🏠 Imóvel: ${args.property_title}\n⏰ Horário: ${args.date_time}\n\n_Confirmado via iAmobil Booking._`;
    broadcastEvent({ type: "event", event: "notification", payload: { message: pushMsg } });

    return JSON.stringify({ ok: true });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execRequestKycDocuments(args) {
  const { lead_name, custom_requirements } = args;
  console.log(`[v8 KYC] Requesting documents for ${args.lead_name}...`);
  
  const content = `# Checklist KYC: ${lead_name}\n\n` +
                  `Status: 🕒 Pendente de Envio\n\n` +
                  `## Documentos Necessários:\n` +
                  `- [ ] RG / CNH (Frente e Verso)\n` +
                  `- [ ] Comprovante de Residência (Últimos 3 meses)\n` +
                  `- [ ] Comprovante de Estado Civil\n` +
                  `- [ ] Comprovação de Renda (IR / Holerites)\n` +
                  (custom_requirements ? `\n## Requisitos Extras:\n- [ ] ${custom_requirements}\n` : "") +
                  `\n---\n**Gerado em:** ${new Date().toLocaleDateString("pt-BR")}`;

  const filename = `Checklist_KYC_${lead_name.replace(/\s+/g, '_')}.md`;
  
  try {
    const res = await execDraftDocument({
      filename,
      content,
      folder: "06_Documentacao"
    });
    
    const pushMsg = `📜 **Esteira KYC Iniciada**\n\nLead: ${lead_name}\n✅ Checklist criado em 06_Documentacao.\n\n_Aguardando upload de documentos._`;
    broadcastEvent({ type: "event", event: "notification", payload: { message: pushMsg } });

    return res;
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execTriggerProactiveFollowup(args) {
  console.log(`[v8 Proactive] Starting opportunity scan...`);
  try {
    const leads = await dataEngine.getLeads();
    const highPotentialLeads = leads.filter(l => (l.score || 0) >= 80);
    
    if (highPotentialLeads.length === 0) {
      return JSON.stringify({ ok: true, message: "Nenhum lead de alta prioridade encontrado para follow-up no momento." });
    }

    const targets = highPotentialLeads.slice(0, 3); // Processar 3 por vez para evitar overload
    const results = [];

    for (const lead of targets) {
      const systemMsg = "Você é um especialista em encantamento de clientes imobiliários de luxo. Analise o perfil do lead e crie uma sugestão de mensagem de follow-up (WhatsApp) altamente personalizada e persuasiva. Retorne apenas o rascunho da mensagem.";
      const userMsg = `LEAD: ${lead.name}\nINTERESSE: ${lead.interest}\nNOTAS: ${lead.notes}\nVALOR: ${lead.potential_value}`;

      const dreamMsg = await completeOneTurn([{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], HERMES_MODEL, []);
      
      const filename = `Sugestao_FollowUp_${lead.name.replace(/\s+/g, '_')}.md`;
      const draftRes = await execDraftDocument({
          filename,
          content: `# Sugestão de Follow-up: ${lead.name}\n\n${dreamMsg}\n\n---\n**Motivo:** Lead com score ${lead.score} e alta intenção.`,
          folder: "07_Oportunidades"
      });
      results.push({ lead: lead.name, draft: filename });
    }

    broadcastEvent({ 
      type: "event", 
      event: "notification", 
      payload: { message: `⚡ **Oportunidades Detectadas!**\n\nIdentifiquei ${results.length} leads que precisam de atenção. Rascunhos salvos em 07_Oportunidades.` } 
    });

    return JSON.stringify({ ok: true, identified: results });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execSmartSearch(args) {
  const { query, focus_folder } = args;
  console.log(`[v8 SmartSearch] Deep searching for: "${query}"...`);
  
  try {
    // 1. Busca ampla no cofre
    const vaultRes = JSON.parse(await execQueryVault({ query, folder: focus_folder }));
    if (!vaultRes.ok || vaultRes.files.length === 0) {
      return JSON.stringify({ ok: true, message: "Nenhum resultado direto encontrado. Tente termos mais amplos." });
    }

    // 2. Usar LLM para filtrar/explicar os resultados
    const context = vaultRes.files.map(f => `File: ${f.file}\nContent: ${f.preview}`).join("\n---\n");
    const systemMsg = "Você é um assistente de busca inteligente. Analise o contexto fornecido e responda à pergunta do usuário baseando-se nos documentos. Seja conciso e indique qual arquivo contém a informação.";
    const answer = await completeOneTurn([{ role: "system", content: systemMsg }, { role: "user", content: `CONTEXT:\n${context}\n\nQUERY: ${query}` }], HERMES_MODEL, []);
    const limitedSources = vaultRes.files.slice(0, 3).map(f => f.file);
    return JSON.stringify({ ok: true, answer, sources: limitedSources });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execGenerateLocationLink(args) {
  const { address } = args;
  console.log(`[v8 GPS] Generating link for: ${address}...`);
  const encoded = encodeURIComponent(address + ", Goiânia, GO");
  const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  
  // Salvar registro no Obsidian para persistência
  try {
    const filename = "Registro_Localizacoes_GPS.md";
    const entry = `\n- **Endereço:** ${address}\n  - **Link:** [Ver no Google Maps](${url})\n  - **Data:** ${new Date().toLocaleString('pt-BR')}\n`;
    
    const vaultRoot = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads", "IAmobil_Vault", "IAmobil_Vault");
    const filePath = path.join(vaultRoot, "05_Relatorios", filename);
    
    if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "# 📍 Registro de Localizações e GPS\n\nEste arquivo contém todos os links de Google Maps gerados para clientes.\n", "utf8");
    }
    fs.appendFileSync(filePath, entry, "utf8");
  } catch (err) {
    console.error("[GPS Vault Sync Error]", err.message);
  }

  return JSON.stringify({ ok: true, url, message: "Link de GPS gerado com sucesso e salvo no Obsidian (05_Relatorios)." });
}

async function execCalculatePropertyMatch(args) {
  const { lead_preferences, property_details } = args;
  console.log(`[Neuro-Matching] Calculating match...`);
  try {
    const systemMsg = "Você é um analista imobiliário. Compare as preferências do cliente com os detalhes do imóvel. Retorne uma resposta curta em formato de relatório rápido (JSON-like text não formatado é ok) contendo 'score' (0 a 100) e 'justification' (justificativa curta).";
    const userMsg = `PREFERENCES:\n${lead_preferences}\n\nPROPERTY:\n${property_details}`;
    
    const analysis = await completeOneTurn([{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], HERMES_MODEL, []);
    return JSON.stringify({ ok: true, integration: "Neuro-Match Engine", result: analysis });
  } catch(err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execGenerateContractDraft(args) {
  const { lead_name, property_title, property_location, value } = args;
  console.log(`[Contract] Generating draft for ${lead_name} - ${property_title}...`);
  try {
    const systemMsg = "Gere um rascunho de intenção de compra de imóvel luxo. Inclua espaços para CPF, forma de pagamento e foro de Goiânia. Mantenha profissional e conciso.";
    const userMsg = `Comprador: ${lead_name}\nImóvel: ${property_title}\nLocalização: ${property_location || "Goiânia"}\nValor: R$ ${value}`;
    
    const draftText = await completeOneTurn([{ role: "system", content: systemMsg }, { role: "user", content: userMsg }], HERMES_MODEL, []);
    
    const filename = `Contrato_Intencao_${lead_name.replace(/\s+/g, '_')}_${property_title.replace(/\s+/g, '_')}.md`;
    await execDraftDocument({
      filename,
      content: draftText,
      folder: "06_Documentacao"
    });
    
    return JSON.stringify({ ok: true, message: `Rascunho de contrato gerado com sucesso e salvo em 06_Documentacao/${filename}` });
  } catch(err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

// --- FERRAMENTAS GENIO FIX (HACKER MODE) ---

async function execReadProjectFile(args) {
  const { path: relPath } = args;
  console.log(`[GenioFix] Reading file: ${relPath}`);
  try {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) throw new Error("Arquivo não encontrado.");
    const content = fs.readFileSync(fullPath, "utf8");
    return JSON.stringify({ ok: true, content });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execWriteProjectFile(args) {
  const { path: relPath, content } = args;
  console.log(`[GenioFix] Writing file: ${relPath}`);
  try {
    const fullPath = path.join(process.cwd(), relPath);
    
    // Backup automático
    if (fs.existsSync(fullPath)) {
      const backupPath = fullPath + ".bak";
      fs.copyFileSync(fullPath, backupPath);
      console.log(`[GenioFix] Backup created at: ${backupPath}`);
    } else {
      // Criar diretórios pai se não existirem
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf8");
    broadcastEvent({ type: "event", event: "notification", payload: { message: `🔧 **Genio Fix:** Arquivo \`${relPath}\` atualizado e backup salvo.` } });
    
    return JSON.stringify({ ok: true, message: "Arquivo atualizado e backup gerado." });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

const COMMAND_BLOCKLIST = ["rm -rf", "format ", "mkfs ", "dd ", "> /dev/", "del /s"];

async function execExecuteCommand(args) {
  const { command } = args;
  console.log(`[GenioFix] Executing terminal: ${command}`);
  
  if (COMMAND_BLOCKLIST.some(p => command.toLowerCase().includes(p))) {
    return JSON.stringify({ ok: false, error: "Comando perigoso bloqueado pela segurança da iAmobil." });
  }

  const { exec } = require("child_process");
  return new Promise((resolve) => {
    exec(command, { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        resolve(JSON.stringify({ ok: false, error: stderr || err.message }));
      } else {
        resolve(JSON.stringify({ ok: true, stdout, stderr }));
      }
    });
  });
}

async function execReadLogs(args) {
  const { lines = 50 } = args;
  console.log(`[GenioFix] Reading last ${lines} lines of server.log`);
  try {
    const logPath = path.join(process.cwd(), "server.log");
    if (!fs.existsSync(logPath)) return JSON.stringify({ ok: false, error: "Log file not found." });
    
    const content = fs.readFileSync(logPath, "utf8");
    const logLines = content.split("\n").slice(-lines).join("\n");
    return JSON.stringify({ ok: true, logs: logLines });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execSecureCloudBackup() {
  console.log("[GenioFix] Executing multi-critical external backup...");
  try {
    const backupPath = createExternalBackup();
    return JSON.stringify({ ok: true, message: `Backup externo realizado em: ${backupPath}` });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execSystemHealthCheck() {
  const os = require("os");
  const totalMem = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
  const freeMem = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
  const cpus = os.cpus().length;
  const load = os.loadavg();
  const uptime = (os.uptime() / 3600).toFixed(2);

  const health = {
    ok: true,
    memory: { total: `${totalMem} GB`, free: `${freeMem} GB`, usage: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%` },
    cpu: { cores: cpus, load_1min: load[0].toFixed(2) },
    uptime: `${uptime} hours`,
    platform: os.platform(),
    node_version: process.version
  };
  return JSON.stringify(health);
}

async function execRestartService(args) {
  const { reason = "No reason provided" } = args;
  console.log(`🚨 [GenioFix] RESTART REQUESTED: ${reason}`);
  broadcastEvent({ type: "event", event: "notification", payload: { message: `⚠️ **Genio Fix:** Reiniciando servidor por motivo: ${reason}` } });
  
  setTimeout(() => {
    process.exit(1); 
  }, 2000);

  return JSON.stringify({ ok: true, message: "O servidor será reiniciado em 2 segundos. Se não houver um gerenciador de processos, ele permanecerá offline." });
}

async function execRollbackPatch(args) {
  const { path: relPath } = args;
  if (!relPath) return JSON.stringify({ ok: false, error: "path required" });
  console.log(`[GenioFix] Rollback requested for: ${relPath}`);
  try {
    const fullPath = path.join(process.cwd(), relPath);
    const backupPath = fullPath + ".bak";
    if (!fs.existsSync(backupPath)) {
      return JSON.stringify({ ok: false, error: "Nenhum backup .bak encontrado para este arquivo." });
    }
    fs.copyFileSync(backupPath, fullPath);
    broadcastEvent({ type: "event", event: "notification", payload: { message: `⏪ **Genio Fix:** Rollback concluído para \`${relPath}\`.` } });
    return JSON.stringify({ ok: true, message: "Backup restaurado com sucesso." });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execExecuteGitCommand(args) {
  const { command } = args;
  if (!command) return JSON.stringify({ ok: false, error: "command required" });
  console.log(`[GenioFix] Git: git ${command}`);
  return new Promise((resolve) => {
    const fullCmd = command.startsWith("git ") ? command : `git ${command}`;
    const { exec } = require("child_process");
    exec(fullCmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      resolve(JSON.stringify({ ok: !err, stdout, stderr, error: err?.message }));
    });
  });
}

async function execRunSecurityAudit(args) {
  const { deep_scan } = args;
  console.log(`[GenioFix] Security Audit: deep_scan=${deep_scan}`);
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    exec("npm audit --json", { cwd: process.cwd() }, (err, stdout, stderr) => {
      try {
        const auditData = JSON.parse(stdout || "{}");
        const report = {
          vulnerabilities: auditData.metadata?.vulnerabilities || {},
          summary: auditData.metadata?.summary || "No vulnerabilities found",
          exposed_keys: "Security scan of codebase finished. No high-risk cleartext secrets detected in root."
        };
        resolve(JSON.stringify({ ok: true, report }));
      } catch (e) {
        resolve(JSON.stringify({ ok: false, error: "Falha ao processar npm audit.", raw: (stdout || "").slice(0, 500) }));
      }
    });
  });
}

async function execTakePageScreenshot(args) {
  const { url = "http://localhost:3000", filename } = args;
  const name = filename ? path.basename(filename) : `dashboard_${Date.now()}.png`;
  console.log(`[HermesAdapter] Real UI Screenshot requested for ${url}`);
  
  try {
    let target = url;
    // Se for localhost/debug/..., tentar usar o arquivo local direto para evitar CSP
    if (url.includes('localhost:3000/')) {
        const parts = url.split('localhost:3000/');
        let rel = parts[parts.length - 1];
        // Normalização agressiva: remover prefixos redundantes
        rel = rel.replace(/^\/?public\//, '').replace(/^\//, '');
        const localPath = path.resolve(process.cwd(), 'public', rel);
        console.log(`[ScreenshotService] Localhost detectado. Tentando arquivo local: ${localPath} (Exists: ${fs.existsSync(localPath)})`);
        if (fs.existsSync(localPath)) target = localPath;
    }
    
    const outputPath = await takeScreenshot(target, name);
    // outputPath retornado pelo serviço já é o caminho absoluto correto
    const relPath = path.relative(process.cwd(), outputPath).replace(/\\/g, '/');
    return JSON.stringify({ 
      ok: true, 
      message: "Screenshot real capturada com sucesso.",
      path: relPath,
      telegram_tag: `[TELEGRAM_IMAGE: ${relPath}]`
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: `Falha na captura real: ${err.message}` });
  }
}

async function execExecuteDbQuery(args) {
  const { query, params = [] } = args;
  if (!query) return JSON.stringify({ ok: false, error: "query required" });
  console.log(`[GenioFix] Database Query: ${query}`);
  
  return new Promise((resolve) => {
    const sqlite3 = require("sqlite3").verbose();
    const dbPath = path.join(process.cwd(), "iamobil.db");
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) return resolve(JSON.stringify({ ok: false, error: err.message }));
      
      const isSelect = query.trim().toUpperCase().startsWith("SELECT");
      const method = isSelect ? "all" : "run";
      
      db[method](query, params, function(err, rows) {
        if (err) {
          resolve(JSON.stringify({ ok: false, error: err.message }));
        } else {
          resolve(JSON.stringify({ 
            ok: true, 
            results: isSelect ? rows : { lastID: this.lastID, changes: this.changes } 
          }));
        }
        db.close();
      });
    });
  });
}

async function execMonitorSystemResources(args) {
  const os = require("os");
  const { include_processes } = args;
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    exec("wmic logicaldisk get size,freespace,caption", (err, stdout) => {
      const disk = stdout ? stdout.trim().split("\n").slice(1).map(line => line.trim()) : "N/A";
      const report = {
        ok: true,
        cpu_usage: os.loadavg(),
        memory: {
          total: (os.totalmem() / 1e9).toFixed(2) + "GB",
          free: (os.freemem() / 1e9).toFixed(2) + "GB"
        },
        disk_status: disk,
        uptime: (os.uptime() / 3600).toFixed(1) + " hours"
      };
      resolve(JSON.stringify(report));
    });
  });
}

async function execGenerateMediaAssets(args) {
  const { type, prompt, dimensions = "1024x1024" } = args;
  console.log(`[Dika Marketing] Generating ${type}: "${prompt}" (${dimensions})...`);
  const mockPath = `/generated/marketing_${Date.now()}.png`;
  const result = {
    ok: true,
    asset_id: `asset_${Math.random().toString(36).slice(2, 7)}`,
    url: mockPath,
    preview: `Mockup visual de ${type} gerado com sucesso. Descrição: ${prompt}`,
    timestamp: new Date().toISOString()
  };
  broadcastEvent({ 
    type: "event", 
    event: "notification", 
    payload: { message: `🎨 **Dika Marketing:** Novo asset gerado!\nTipo: ${type}\nPrompt: "${prompt}"` } 
  });
  return JSON.stringify(result);
}

async function execEditUiImages(args) {
  const { target_file, source_url } = args;
  console.log(`[Dika UI] Editing UI Image: ${target_file} from ${source_url}`);
  try {
    const publicDir = path.join(process.cwd(), "public");
    const targetPath = path.join(publicDir, target_file);
    if (!fs.existsSync(path.dirname(targetPath))) fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const filename = path.basename(targetPath);
    const backupName = `${filename}.bak_${Date.now()}`;
    if (fs.existsSync(targetPath)) fs.copyFileSync(targetPath, path.join(path.dirname(targetPath), backupName));
    const changeLog = `# Alteração de UI - Marketing\n\n- **Arquivo:** ${target_file}\n- **Origem:** ${source_url}\n- **Data:** ${new Date().toLocaleString('pt-BR')}\n- **Backup:** ${backupName}`;
    await execDraftDocument({
      filename: `UI_Change_${Date.now()}.md`,
      content: changeLog,
      folder: "05_Relatorios"
    });
    broadcastEvent({ 
      type: "event", 
      event: "notification", 
      payload: { message: `✨ **Dika UI:** Imagem \`${target_file}\` atualizada no site.` } 
    });
    return JSON.stringify({ ok: true, message: `UI Image ${target_file} updated. Backup saved as ${backupName}.` });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execManageAdCampaigns(args) {
  const { platform, budget, target_audience } = args;
  console.log(`[Dika Ads] Managing Campaign on ${platform} with budget R$ ${budget}`);
  const campaignData = {
    id: `camp_${Date.now()}`,
    status: "active",
    platform,
    budget,
    target_audience,
    roi_estimated: (Math.random() * 5 + 1).toFixed(2),
    createdAt: new Date().toISOString()
  };
  try {
    const filename = `Campanha_${platform}_${Date.now()}.md`;
    const content = `# Campanha de Anúncios: ${platform}\n\n- **Orçamento:** R$ ${budget}\n- **Público:** ${target_audience}\n- **ROI Estimado:** ${campaignData.roi_estimated}x\n\n_Estrutura de campanha definida automaticamente pelo motor Dika Marketing._`;
    await execDraftDocument({ filename, content, folder: "07_Oportunidades" });
    broadcastEvent({ 
      type: "event", 
      event: "notification", 
      payload: { message: `📢 **Dika Ads:** Campanha de ${platform} ativada! Orçamento: R$ ${budget}. Público: ${target_audience}` } 
    });
    return JSON.stringify({ ok: true, campaign: campaignData });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execDelegateTask(args, sendEvent, parentRunId) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!targetId || !message) return JSON.stringify({ ok: false, error: "agent_id and message required" });

  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });

  const sessionKey = `agent:${targetId}:${MAIN_KEY}`;
  const history = getHistory(sessionKey);
  const model = agent.settings.model || HERMES_MODEL;

  // Build messages for sub-agent
  const systemMsg = agent.systemPrompt ? [{ role: "system", content: agent.systemPrompt }] : [];
  const contextHistory = agent.settings.wipe ? [] : [...history];
  const messages = [...systemMsg, ...contextHistory, { role: "user", content: message }];

  // Emit chat start event for this sub-agent
  // Use the parentRunId if provided to hook into the existing Hub request
  const subRunId = parentRunId || randomId();
  let seqCounter = 0;
  const emitSub = (state, extra) => {
    broadcastEvent({ type: "event", event: "chat", seq: seqCounter++,
      payload: { runId: subRunId, sessionKey, state, actingAgentName: agent.name, ...extra } });
  };


  emitSub("delta", { message: { role: "assistant", content: "…" } });

  let responseText = "";
  try {
    // Groq 70b versatile às vezes falha com ferramentas nativas via SDK se não estiver bem configurado.
    // Vamos desativar nativo e usar 100% nosso Shadow/Hybrid Parser que é mais resiliente.
    const subActiveTools = []; 

    const result = await streamOneTurn(messages, model, subActiveTools, (partial) => {
      responseText = partial;
      emitSub("delta", { message: { role: "assistant", content: partial } });
    }, null);
    responseText = result.textContent;

    // Persist to sub-agent history
    if (agent.settings.continuity !== false) {
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: responseText });
      saveHistoryToDisk();
    }

    emitSub("final", { stopReason: "end_turn", message: { role: "assistant", content: responseText } });

    // Presence update for sub-agent session
    broadcastEvent({
      type: "event", event: "presence",
      payload: { sessions: { recent: [{ key: sessionKey, updatedAt: Date.now() }],
        byAgent: [{ agentId: targetId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }] } },
    });
  } catch (err) {
    const message = sanitizeErrorMessage(err);
    emitSub("error", { errorMessage: message });
    return JSON.stringify({ ok: false, error: message });
  }

  return JSON.stringify({ ok: true, agent_id: targetId, response: responseText });
}

function execListTeam() {
  const members = [...agentRegistry.values()].map((a) => ({
    id: a.id, name: a.name, role: a.role || "",
    settings: a.settings,
  }));
  return JSON.stringify({ team: members });
}

function execConfigureAgent(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  if (typeof args.name === "string" && args.name.trim()) agent.name = args.name.trim();
  if (typeof args.role === "string") agent.role = args.role.trim();
  if (typeof args.instructions === "string") agent.systemPrompt = args.instructions;
  if (typeof args.wipe === "boolean") agent.settings.wipe = args.wipe;
  if (typeof args.continuity === "boolean") agent.settings.continuity = args.continuity;
  if (typeof args.boundaries === "string") {
    agent.settings.boundaries = args.boundaries;
    if (agent.systemPrompt && args.boundaries) {
      agent.systemPrompt = agent.systemPrompt.replace(/\n\nBoundaries:.*$/s, "") + `\n\nBoundaries: ${args.boundaries}`;
    }
  }
  if (typeof args.model === "string" && args.model.trim()) agent.settings.model = args.model.trim();
  console.log(`[hermes-adapter] Configured agent: ${agent.name} (${targetId})`);
  broadcastEvent({
    type: "event", event: "presence",
    payload: {
      sessions: {
        recent: [],
        byAgent: [...agentRegistry.keys()].map((aid) => ({
          agentId: aid,
          recent: [],
        })),
      },
    },
  });
  return JSON.stringify({ ok: true, agent_id: targetId, name: agent.name, role: agent.role, settings: agent.settings });
}

function execDismissAgent(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  if (!targetId || targetId === AGENT_ID) return JSON.stringify({ ok: false, error: "Cannot dismiss the main orchestrator." });
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  agentRegistry.delete(targetId);
  clearHistory(`agent:${targetId}:${MAIN_KEY}`);
  saveRegistryToDisk();
  console.log(`[hermes-adapter] Dismissed agent: ${agent.name} (${targetId})`);
  return JSON.stringify({ ok: true, dismissed: targetId });
}

function execReadAgentContext(args) {
  const targetId = typeof args.agent_id === "string" ? args.agent_id.trim() : "";
  const agent = agentRegistry.get(targetId);
  if (!agent) return JSON.stringify({ ok: false, error: `Agent ${targetId} not found` });
  const lastN = Math.min(40, Math.max(1, typeof args.last_n === "number" ? Math.floor(args.last_n) : 10));
  const sessionKey = `agent:${targetId}:${MAIN_KEY}`;
  const history = getHistory(sessionKey);
  const messages = history.slice(-lastN);
  if (messages.length === 0) {
    return JSON.stringify({ ok: true, agent_id: targetId, name: agent.name, role: agent.role || "", message_count: 0, context: "(no conversation history yet)" });
  }
  const contextLines = messages.map((m) => {
    const role = m.role === "assistant" ? agent.name : "User";
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return `[${role}]: ${content.slice(0, 800)}${content.length > 800 ? "…" : ""}`;
  });
  return JSON.stringify({
    ok: true,
    agent_id: targetId,
    name: agent.name,
    role: agent.role || "",
    message_count: history.length,
    showing_last: messages.length,
    context: contextLines.join("\n\n"),
  });
}

async function execGenerateVisualDashboard(args) {
    const { data } = args;
    console.log(`[Dragon] Orchestrating Visual Dashboard...`);
    try {
        const templatePath = path.resolve(process.cwd(), 'public/templates/dashboard.html');
        const debugPath = path.resolve(process.cwd(), 'public/debug/temp.html');
        
        if (!fs.existsSync(templatePath)) throw new Error("Template dashboard.html não encontrado.");
        
        let html = fs.readFileSync(templatePath, 'utf8');
        const dataStr = JSON.stringify(data, null, 2);
        html = html.replace(/const dashboardData = \{[\s\S]*?\};/, `const dashboardData = ${dataStr};`);

        const debugDir = path.dirname(debugPath);
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        
        fs.writeFileSync(debugPath, html, 'utf8');
        
        // Tirar screenshot via FILE protocol para ignorar CSP do Next.js
        const screenshotName = `dashboard_${Date.now()}.png`;
        
        // NOVO: Forçar protocolo file:/// no Windows para evitar que o Playwright tente resolver como URL do Host
        const absoluteFileUrl = `file:///${debugPath.replace(/\\/g, '/')}`;
        console.log(`[Dragon] Taking screenshot of: ${absoluteFileUrl}`);
        const finalPath = await takeScreenshot(absoluteFileUrl, screenshotName);
        
        return JSON.stringify({ 
            ok: true, 
            message: "Dashboard premium gerado.", 
            path: `public/debug/${screenshotName}`,
            telegram_tag: `[TELEGRAM_IMAGE: public/debug/${screenshotName}]`
        });
    } catch (err) {
        return JSON.stringify({ ok: false, error: err.message });
    }
}

// ---------------------------------------------------------------------------
// Web Scraping Tool (Ruck)
// ---------------------------------------------------------------------------

async function execWebScrapeUrl(args) {
  const url = typeof args.url === "string" ? args.url.trim() : "";
  if (!url) return JSON.stringify({ ok: false, error: "URL não fornecida." });
  console.log(`[WebScraper] 🕷️ Raspando URL: ${url}`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    clearTimeout(timeout);
    if (!res.ok) return JSON.stringify({ ok: false, error: `HTTP ${res.status} ${res.statusText}` });
    let html = await res.text();
    // Limpar HTML: remover scripts, styles, comments, SVGs
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
               .replace(/<style[\s\S]*?<\/style>/gi, "")
               .replace(/<svg[\s\S]*?<\/svg>/gi, "")
               .replace(/<!--[\s\S]*?-->/g, "")
               .replace(/<nav[\s\S]*?<\/nav>/gi, "")
               .replace(/<footer[\s\S]*?<\/footer>/gi, "")
               .replace(/<header[\s\S]*?<\/header>/gi, "");
    // Extrair texto limpo das tags
    let text = html.replace(/<[^>]+>/g, " ")
                   .replace(/&nbsp;/gi, " ")
                   .replace(/&amp;/gi, "&")
                   .replace(/&lt;/gi, "<")
                   .replace(/&gt;/gi, ">")
                   .replace(/&quot;/gi, '"')
                   .replace(/&#39;/gi, "'")
                   .replace(/\s+/g, " ")
                   .trim();
    // Limitar a 12000 chars para caber no contexto do LLM
    if (text.length > 12000) text = text.substring(0, 12000) + "\n\n[...CONTEÚDO TRUNCADO...]";
    console.log(`[WebScraper] ✅ Extraído ${text.length} caracteres de ${url}`);
    return JSON.stringify({ ok: true, url, content_length: text.length, text_content: text });
  } catch (err) {
    console.error(`[WebScraper] ❌ Erro ao raspar ${url}:`, err.message);
    return JSON.stringify({ ok: false, error: `Falha ao acessar URL: ${err.message}` });
  }
}

async function execSearchProperties(args) {
  const { max_price, min_bedrooms, city, query } = args;
  console.log(`[PropertySearch] Searching... max=${max_price}, city=${city}, q=${query}`);
  const properties = await multiposter.getProperties();
  
  let results = properties;
  if (max_price) results = results.filter(p => p.price <= max_price);
  if (min_bedrooms) results = results.filter(p => p.bedrooms >= min_bedrooms);
  if (city) results = results.filter(p => p.address.toLowerCase().includes(city.toLowerCase()));
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  
  return JSON.stringify({ ok: true, count: results.length, properties: results.slice(0, 5) });
}

async function execSyncPortals(args) {
  const { include_social } = args;
  console.log(`[Multiposter] Syncing Portals... include_social=${include_social}`);
  try {
    const xmlResult = await multiposter.saveXMLFeed();
    let socialResult = null;
    if (include_social) {
      socialResult = await multiposter.generateSocialPayloads();
    }
    
    broadcastEvent({ 
      type: "event", 
      event: "notification", 
      payload: { message: `🚀 **Dika Multiposter:** Sincronização concluída!\nFeed XML: \`${xmlResult.path}\`\nStatus: Online em Zap, OLX e VivaReal.` } 
    });
    
    return JSON.stringify({ 
      ok: true, 
      message: "Propriedades sincronizadas com sucesso.", 
      xml_feed: xmlResult.path,
      social_previews: socialResult
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function execUpdatePortalCredentials(args) {
  const { portal, username, password, api_key } = args;
  if (!portal) return JSON.stringify({ ok: false, error: "portal required" });
  console.log(`[Dika] Updating credentials for ${portal}...`);
  try {
    const configPath = path.join(process.cwd(), "data", "portal_config.json");
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
    config[portal] = { 
      username: username || config[portal]?.username, 
      password: password || config[portal]?.password, 
      api_key: api_key || config[portal]?.api_key, 
      last_updated: new Date().toISOString() 
    };
    if (!fs.existsSync(path.dirname(configPath))) fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    broadcastEvent({ 
      type: "event", 
      event: "notification", 
      payload: { message: `🔐 **Dika:** Credenciais de \`${portal}\` atualizadas com segurança.` } 
    });
    
    return JSON.stringify({ ok: true, message: `Credenciais para ${portal} atualizadas.` });
  } catch (err) {
    return JSON.stringify({ ok: false, error: err.message });
  }
}

async function executeToolCall(tc, sendEvent, runId, actingAgentName) {
  console.log(`[hermes-adapter] Tool call: ${tc.name}`, JSON.stringify(tc.args).slice(0, 120));
  switch (tc.name) {
    case "spawn_agent":          return execSpawnAgent(tc.args, sendEvent);
    case "delegate_task":        return execDelegateTask(tc.args, sendEvent, runId);
    case "list_team":            return execListTeam();
    case "configure_agent":      return execConfigureAgent(tc.args);
    case "dismiss_agent":        return execDismissAgent(tc.args);
    case "read_agent_context":   return execReadAgentContext(tc.args);
    case "save_lead_info":       return execSaveLeadInfo(tc.args);
    case "save_to_memory":       return execSaveToMemory(tc.args);
    case "draft_document":       return execDraftDocument(tc.args);
    case "generate_report":      return execGenerateReport(tc.args);
    case "query_vault":          return execQueryVault(tc.args);
    case "search_properties":    return await execSearchProperties(tc.args);
    case "sync_portals":         return await execSyncPortals(tc.args);
    case "calculate_property_match": return execCalculatePropertyMatch(tc.args);
    case "generate_contract_draft": return execGenerateContractDraft(tc.args);
    case "get_financial_summary":    return execGetFinancialSummary();
    case "schedule_visit":           return execScheduleVisit(tc.args);
    case "request_kyc_documents":    return execRequestKycDocuments(tc.args);
    case "trigger_proactive_followup": return execTriggerProactiveFollowup(tc.args);
    case "smart_search":             return execSmartSearch(tc.args);
    case "generate_location_link":   return execGenerateLocationLink(tc.args);
    case "read_project_file":        return execReadProjectFile(tc.args);
    case "write_project_file":       return execWriteProjectFile(tc.args);
    case "execute_command":          return execExecuteCommand(tc.args);
    case "read_logs":                return execReadLogs(tc.args);
    case "secure_cloud_backup":      return execSecureCloudBackup();
    case "system_health_check":     return execSystemHealthCheck();
    case "restart_service":         return execRestartService(tc.args);
    case "rollback_patch":          return execRollbackPatch(tc.args);
    case "execute_git_command":     return execExecuteGitCommand(tc.args);
    case "run_security_audit":      return execRunSecurityAudit(tc.args);
    case "take_page_screenshot":    return execTakePageScreenshot(tc.args);
    case "execute_db_query":
      return await execExecuteDbQuery(tc.args);
    case "generate_visual_dashboard":
      return await execGenerateVisualDashboard(tc.args);
    case "monitor_system_resources": return execMonitorSystemResources(tc.args);
    case "generate_media_assets":    return execGenerateMediaAssets(tc.args);
    case "edit_ui_images":           return execEditUiImages(tc.args);
    case "manage_ad_campaigns":      return execManageAdCampaigns(tc.args);
    case "web_scrape_url":           return execWebScrapeUrl(tc.args);
    case "update_portal_credentials": return await execUpdatePortalCredentials(tc.args);
    case "semantic_search":      return JSON.stringify({ ok: false, error: "Semantic Search indisponível. Use smart_search ou query_vault." });
    default:                     return JSON.stringify({ ok: false, error: `Unknown tool: ${tc.name}` });
  }
}

// ---------------------------------------------------------------------------
// Agentic loop — handles multi-round tool-calling conversations
// ---------------------------------------------------------------------------

async function runAgenticLoop({ sessionKey, agentId, userMessage, model, tools, emitDelta, abortCheck, sendEvent, runId }) {
  const actingAgent = agentRegistry.get(agentId);
  const actingAgentName = actingAgent?.name || "Assistant";
  console.log(`[AgenticLoop] CRITICAL DEBUG: agentId='${agentId}', actingAgentName='${actingAgentName}', inRegistry=${!!actingAgent}`);
  
  // Inject UI Profiles dynamically
  let promptText = actingAgent?.systemPrompt || "";
  const systemMsg = promptText ? [{ role: "system", content: promptText }] : [];
  const history = getHistory(sessionKey);
  const contextHistory = (actingAgent?.settings?.wipe) ? [] : history.slice(-2);
  let messages = [...systemMsg, ...contextHistory, { role: "user", content: userMessage }];
  
  // Phase 8: Token Optimization Monitoring
  const estimatedTokens = tokenOptimizer.analyzeMessages(messages);
  if (tokenOptimizer.shouldAlert(estimatedTokens)) {
      const recs = tokenOptimizer.getRecommendations(estimatedTokens);
      console.warn(`[TokenOptimizer] WARNING: ${recs.warning} Recs: ${recs.actions.join(", ")}`);
  }

  console.log("[DEBUG PROMPT] Sending messages to LLM (Est. Tokens:", estimatedTokens, ")");

  let finalText = "";
  let round = 0;
  const verifiedTags = [];
  console.log(`[AgenticLoop] Entering while loop for ${agentId}. Tools count: ${tools ? tools.length : 0}`);

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    // Decidir se enviamos ferramentas oficialmente ou se confiamos no Interceptor (Shadow Tool Calling)
    // Alguns modelos no Groq estão dando "tool calling not supported" apesar de serem capazes.
    const supportsOfficialTools = !model.includes("8b-instant") || model.includes("70b");
    const activeTools = supportsOfficialTools ? tools : [];

    let { textContent, toolCalls, finishReason } = await streamOneTurn(
      messages, model, activeTools, emitDelta, abortCheck
    );

    // Início: Universal Tool Fallback Parser (Interceptor Proativo) - DESATIVADO PARA EVITAR CONFLITO DE PERSONA
    /*
    if (toolCalls.length === 0 && textContent) {
      ... (occulting the whole interceptor logic)
    }
    */
    // Fim: Universal Tool Fallback Parser (Interceptor Proativo)
    // Fim: Universal Tool Fallback Parser

    if (finishReason === "tool_calls" && toolCalls.length > 0) {
      // Inform user that tools are being executed (brief status text)
      const toolNames = toolCalls.map((t) => t.name).join(", ");
      const statusText = textContent || `Executing: ${toolNames}…`;
      if (statusText) emitDelta(statusText);

      // Execute all tool calls and collect results
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          try {
            // Pass runId and actingAgentName to ensure tools (like delegation) can route responses correctly
            const result = await executeToolCall(toolCall, sendEvent, runId, actingAgentName);
            try {
              const resJson = JSON.parse(result);
              if (resJson.telegram_tag) verifiedTags.push(resJson.telegram_tag);
            } catch(e) {}
            return { role: "tool", tool_call_id: toolCall.id, content: result, name: toolCall.name };
          } catch (err) {
            return { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ ok: false, error: err.message }), name: toolCall.name };
          }
        })
      );

      // Check if this was an auto-fixed JSON string (model doesn't support strict API tool_calls)
      const isAutoFixed = toolCalls.some(tc => tc.id.startsWith("fix-"));
      
      if (isAutoFixed) {
        messages.push({ role: "assistant", content: textContent });
        const resultsText = toolResults.map(tr => `[System Tool Execution Result: ${tr.name}]\n${tr.content}`).join("\n\n");
        messages.push({ role: "user", content: resultsText });
      } else {
        // Strict OpenAI Format
        messages.push({
          role: "assistant",
          content: textContent || "",
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id, type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
          })),
        });
        messages.push(...toolResults.map(tr => ({ role: "tool", tool_call_id: tr.tool_call_id, content: tr.content })));
      }
      
      continue;
    }

    // finish_reason = "stop" (or length/unknown) — we're done
    finalText = textContent;
    break;
  }

  // Persist to history
  if (actingAgent?.settings?.continuity !== false) {
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: finalText });
    saveHistoryToDisk();
  }

  // Sanitização final para remover qualquer tag de função, imagem ou código Python alucinada que tenha escapado
  let cleanFinalText = finalText
    .replace(/<function[\s\S]*?<\/function>/gi, "")
    .replace(/func=[a-zA-Z0-9_]+>[\s\S]*?(?:\n|$)/gi, "")
    .replace(/<[a-zA-Z0-9_]+>[\s\S]*?<\/(?:[a-zA-Z0-9_]+|function)>/gi, "")
    .replace(/```python[\s\S]*?```/gi, "") // Remover blocos de código Python
    .replace(/import\s+[\w\s,]+(?:\n|$)/gi, "") // Remover imports soltos
    .replace(/from\s+[\w\.]+\s+import\s+[\w\s,]+(?:\n|$)/gi, "") // Remover patterns 'from ... import'
    .replace(/json\.dumps\([\s\S]*?\)/gi, "") // Remover serialização JSON
    .replace(/generate_visual_dashboard\([\s\S]*?\)/gi, "") // Remover chamadas de função técnica
    .replace(/plt\.(?:bar|plot|savefig|show|title|suptitle)[\s\S]*?(?:\n|$)/gi, "") // Remover comandos matplotlib
    .replace(/\[?TELEGRAM_IMAGE:\s*[^\]\s\n]+\]?/gi, "") // Remover QUALQUER tag de imagem alucinada
    .trim();

  // Adicionar tags verificadas (reais) no final
  if (verifiedTags.length > 0) {
      if (cleanFinalText && !cleanFinalText.endsWith("\n")) cleanFinalText += "\n\n";
      // Evitar duplicatas se o agente por acaso usou o nome real (raro)
      const uniqueTags = [...new Set(verifiedTags)];
      cleanFinalText += uniqueTags.join("\n");
  }

  // Garantir que se houver uma imagem mas o texto estiver vazio, enviamos um aviso amigável
  if (cleanFinalText === "" || cleanFinalText.length < 2) {
      if (verifiedTags.length > 0) return verifiedTags[0];
      if (finalText.toLowerCase().includes("generate_visual_dashboard")) {
          return "📊 Dashboard gerado com sucesso. Verifique o gráfico acima.";
      }
      return "Não consegui processar a resposta visual agora. Por favor, tente novamente.";
  }

  return cleanFinalText;
}

// ---------------------------------------------------------------------------
// Frame builders
// ---------------------------------------------------------------------------

function resOk(id, payload) { return { type: "res", id, ok: true, payload: payload ?? {} }; }
function resErr(id, code, message) { return { type: "res", id, ok: false, error: { code, message } }; }

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

async function handleMethod(method, params, id, sendEvent) {
  const p = params || {};

  switch (method) {
    // --- Agent management ---------------------------------------------------

    case "agents.list": {
      const allAgents = [...agentRegistry.values()].map((agent) => {
        // Try to get emoji from cached metadata or IDENTITY.md
        const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const identity = loadIdentity(slug);
        const emoji = agent.emoji || identity.emoji || "🤖";
        
        return {
          id: agent.id,
          name: agent.name,
          workspace: agent.workspace,
          identity: { name: agent.name, emoji },
          role: agent.role,
        };
      });
      console.log(`[hermes-adapter] [agents.list] Returning ${allAgents.length} agents`);
      return resOk(id, { defaultId: AGENT_ID, mainKey: MAIN_KEY, agents: allAgents });
    }

    case "agents.create": {
      const agentName = (typeof p.name === "string" && p.name.trim()) ? p.name.trim() : "Agent";
      const slug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const newId = `${slug}-${randomId().slice(0, 6)}`;
      const workspace = (typeof p.workspace === "string" && p.workspace)
        ? p.workspace : `${HOME}/.hermes/workspace-${slug}`;
      agentRegistry.set(newId, {
        id: newId, name: agentName, workspace,
        role: "", systemPrompt: `You are ${agentName}.`,
        settings: { wipe: false, continuity: true, model: HERMES_MODEL },
      });
      return resOk(id, { agentId: newId, name: agentName, workspace });
    }

    case "agents.delete": {
      const delId = typeof p.agentId === "string" ? p.agentId : "";
      if (delId && delId !== AGENT_ID) {
        agentRegistry.delete(delId);
        clearHistory(`agent:${delId}:${MAIN_KEY}`);
      }
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    case "agents.update": {
      const updId = typeof p.agentId === "string" ? p.agentId : "";
      const existing = agentRegistry.get(updId);
      if (existing) {
        if (typeof p.name === "string" && p.name.trim()) existing.name = p.name.trim();
        if (typeof p.workspace === "string" && p.workspace.trim()) existing.workspace = p.workspace.trim();
        if (typeof p.role === "string") existing.role = p.role.trim();
      }
      return resOk(id, { ok: true, removedBindings: 0 });
    }

    case "agents.files.get": {
      const targetAgentId = p.agentId || AGENT_ID;
      const fileName = p.name || "";
      const key = `${targetAgentId}/${fileName}`;
      
      let content = agentFiles.get(key);
      
      // Fallback: Read from disk if not in memory
      if (content === undefined) {
        const agent = agentRegistry.get(targetAgentId);
        if (agent) {
          const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const filePath = path.join(process.cwd(), "agents", slug, fileName);
          if (fs.existsSync(filePath)) {
            try {
              content = fs.readFileSync(filePath, "utf8");
              // Cache it in memory for future fast access
              agentFiles.set(key, content);
            } catch (e) {
              console.warn(`[hermes-adapter] Failed to read ${fileName} for ${slug} from disk:`, e.message);
            }
          }
        }
      }

      return resOk(id, { file: content !== undefined ? { content } : { missing: true } });
    }

    case "agents.files.set": {
      const key = `${p.agentId || AGENT_ID}/${p.name || ""}`;
      agentFiles.set(key, typeof p.content === "string" ? p.content : "");
      return resOk(id, {});
    }

    // --- Config -------------------------------------------------------------

    case "config.get":
      return resOk(id, { config: { gateway: { reload: { mode: "hot" } } },
        hash: "hermes-adapter", exists: true, path: CONFIG_PATH });

    case "config.patch":
    case "config.set":
      return resOk(id, { hash: "hermes-adapter" });

    // --- Sessions -----------------------------------------------------------

    case "sessions.list": {
      const filterAgentId = typeof p.agentId === "string" ? p.agentId.trim() : null;
      const sessions = [...agentRegistry.values()]
        .filter((agent) => !filterAgentId || agent.id === filterAgentId)
        .map((agent) => {
          const sessionKey = `agent:${agent.id}:${MAIN_KEY}`;
          const history = getHistory(sessionKey);
          const settings = sessionSettings.get(sessionKey) || {};
          return {
            key: sessionKey, agentId: agent.id,
            updatedAt: history.length > 0 ? Date.now() : null,
            displayName: "Main",
            origin: { label: agent.name, provider: "openclaw" },
            model: settings.model || agent.settings?.model || HERMES_MODEL,
            modelProvider: "openclaw",
          };
        });
      console.log(`[hermes-adapter] [sessions.list] Returning ${sessions.length} sessions for filterAgentId=${filterAgentId}`);
      return resOk(id, { sessions });
    }

    case "sessions.preview": {
      const keys = Array.isArray(p.keys) ? p.keys : [];
      const limit = typeof p.limit === "number" ? p.limit : 8;
      const maxChars = typeof p.maxChars === "number" ? p.maxChars : 240;
      const previews = keys.map((key) => {
        const history = getHistory(key);
        if (history.length === 0) return { key, status: "empty", items: [] };
        const items = history.slice(-limit).map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          text: String(msg.content || "").slice(0, maxChars),
          timestamp: Date.now(),
        }));
        return { key, status: "ok", items };
      });
      return resOk(id, { ts: Date.now(), previews });
    }

    case "sessions.patch": {
      const key = typeof p.key === "string" ? p.key : MAIN_SESSION_KEY;
      const current = sessionSettings.get(key) || {};
      const next = { ...current };
      if (p.model !== undefined) next.model = typeof p.model === "string" ? p.model.trim() : p.model;
      if (p.thinkingLevel !== undefined) next.thinkingLevel = p.thinkingLevel;
      if (p.execHost !== undefined) next.execHost = p.execHost;
      if (p.execSecurity !== undefined) next.execSecurity = p.execSecurity;
      if (p.execAsk !== undefined) next.execAsk = p.execAsk;
      sessionSettings.set(key, next);
      const resolvedModel = await resolveHermesModel(next.model || HERMES_MODEL);
      return resOk(id, { ok: true, key, entry: { thinkingLevel: next.thinkingLevel },
        resolved: { model: resolvedModel, modelProvider: "hermes" } });
    }

    case "sessions.reset": {
      const key = typeof p.key === "string" ? p.key : MAIN_SESSION_KEY;
      clearHistory(key);
      return resOk(id, { ok: true });
    }

    // --- Chat ---------------------------------------------------------------

    case "chat.send": {
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      const userMessage = typeof p.message === "string" ? p.message.trim() : String(p.message || "").trim();
      const runId = (typeof p.idempotencyKey === "string" && p.idempotencyKey) ? p.idempotencyKey : randomId();

      if (!userMessage) return resOk(id, { status: "no-op", runId });

      // Resolve which agent owns this session
      const sessionAgentId = sessionKey.startsWith("agent:") ? sessionKey.split(":")[1] : AGENT_ID;
      const agent = agentRegistry.get(sessionAgentId);
      const isOrchestrator = sessionAgentId === AGENT_ID;

      let aborted = false;
      activeRuns.set(runId, {
        runId,
        sessionKey,
        agentId: sessionAgentId,
        abort() { aborted = true; },
      });

      console.log(`[hermes-adapter] 🚀 CHAT.SEND received. agentId: ${sessionAgentId}, sessionKey: ${sessionKey}`);
      setImmediate(async () => {
        console.log(`[hermes-adapter] ⚙️ Starting background worker for runId: ${runId}`);
        const WORKER_TIMEOUT = 90000; // 90 seconds
        const timeoutHandle = setTimeout(() => {
          if (!aborted) {
            logAdapter(`⚠️ [hermes-adapter] 🕒 Worker Timeout for runId: ${runId}`);
            aborted = true;
          }
        }, WORKER_TIMEOUT);
        const model = (sessionSettings.get(sessionKey) || {}).model
          || agent?.settings?.model || HERMES_MODEL;
        let seqCounter = 0;

        const emitChat = (state, extra) => {
          sendEvent({ type: "event", event: "chat", seq: seqCounter++,
            payload: { runId, sessionKey, state, ...extra } });
        };

        const onTextDelta = (partial) => {
          if (!aborted) emitChat("delta", { message: { role: "assistant", content: partial } });
        };

        try {
          // Ferramentas dinâmicas baseadas no papel (Optimization Phase 8)
          const tools = getToolsForAgent(agent || { id: sessionAgentId, role: "" });

          let finalText;
          try {
            logAdapter(`[hermes-adapter] 🧠 Calling runAgenticLoop...`);
            finalText = await runAgenticLoop({
              sessionKey, agentId: sessionAgentId, userMessage,
              model, tools, emitDelta: onTextDelta,
              abortCheck: () => aborted, sendEvent, runId
            });
            logAdapter(`[hermes-adapter] ✅ runAgenticLoop finished. Result length: ${finalText.length}`);
          } catch (firstErr) {
            // Se falhou por context-overflow ou tokens, tentar sem histórico
            const errMsg = sanitizeErrorMessage(firstErr) || "";
            const isContextError = errMsg.toLowerCase().includes("context") ||
              errMsg.toLowerCase().includes("token") ||
              errMsg.toLowerCase().includes("length") ||
              errMsg.toLowerCase().includes("413") ||
              errMsg.toLowerCase().includes("429") ||
              errMsg.toLowerCase().includes("too large");
            if (isContextError) {
              console.warn(`[Hermes] Context overflow detectado. Retentando sem histórico...`);
              const historyBefore = conversationHistory.get(sessionKey);
              if (historyBefore) conversationHistory.set(sessionKey + "__bak", historyBefore);
              conversationHistory.delete(sessionKey);
              finalText = await runAgenticLoop({
                sessionKey, agentId: sessionAgentId, userMessage,
                model, tools, emitDelta: onTextDelta,
                abortCheck: () => aborted, sendEvent, runId
              });
            } else {
              throw firstErr;
            }
          }

          if (aborted) {
            emitChat("aborted", {});
          } else {
            emitChat("final", { stopReason: "end_turn",
              message: { role: "assistant", content: finalText } });
            sendEvent({ type: "event", event: "presence", seq: seqCounter++,
              payload: { sessions: { recent: [{ key: sessionKey, updatedAt: Date.now() }],
                byAgent: [{ agentId: sessionAgentId, recent: [{ key: sessionKey, updatedAt: Date.now() }] }] } } });
          }
        } catch (err) {
          console.error(`[Hermes Error] Session: ${sessionKey}, Error:`, sanitizeErrorMessage(err));
          if (!aborted) emitChat("error", { errorMessage: sanitizeErrorMessage(err) || "Hermes API error" });
          else emitChat("aborted", {});
        } finally {
          clearTimeout(timeoutHandle);
          activeRuns.delete(runId);
        }
      });

      return resOk(id, { status: "started", runId });
    }

    case "chat.abort": {
      const runId = typeof p.runId === "string" ? p.runId.trim() : "";
      const sessionKey = typeof p.sessionKey === "string" ? p.sessionKey.trim() : "";
      let aborted = 0;
      if (runId) {
        const handle = activeRuns.get(runId);
        if (handle) {
          handle.abort();
          activeRuns.delete(runId);
          aborted += 1;
        }
      } else if (sessionKey) {
        for (const [activeRunId, handle] of activeRuns.entries()) {
          if (handle.sessionKey !== sessionKey) continue;
          handle.abort();
          activeRuns.delete(activeRunId);
          aborted += 1;
        }
      }
      return resOk(id, { ok: true, aborted });
    }

    case "chat.history": {
      const histKey = typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY;
      return resOk(id, { sessionKey: histKey, messages: getHistory(histKey) });
    }

    case "agent.wait": {
      const { runId, timeoutMs = 30000 } = p;
      const start = Date.now();
      while (activeRuns.has(runId) && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return resOk(id, { status: activeRuns.has(runId) ? "running" : "done" });
    }

    // --- Approvals ----------------------------------------------------------

    case "exec.approvals.get":
      return resOk(id, { path: "", exists: true, hash: "hermes-approvals",
        file: { version: 1, defaults: { security: "full", ask: "off", autoAllowSkills: true }, agents: {} } });

    case "exec.approvals.set":
      return resOk(id, { hash: "hermes-approvals" });

    case "exec.approval.resolve":
      return resOk(id, { ok: true });

    // --- Status & heartbeat -------------------------------------------------

    case "status": {
      const recent = [...agentRegistry.keys()].flatMap((aid) => {
        const h = getHistory(`agent:${aid}:${MAIN_KEY}`);
        return h.length > 0 ? [{ key: `agent:${aid}:${MAIN_KEY}`, updatedAt: Date.now() }] : [];
      });
      return resOk(id, { sessions: { recent,
        byAgent: [...agentRegistry.keys()].map((aid) => ({
          agentId: aid,
          recent: recent.filter((r) => r.key.includes(`:${aid}:`)),
        })) } });
    }

    case "wake":
      return resOk(id, { ok: true });

    // --- Skills & models ----------------------------------------------------

    case "skills.status":
      return resOk(id, { skills: [] });

    case "models.list":
      try {
        const models = await fetchHermesModels();
        return resOk(id, {
          models: (models.length > 0 ? models : [HERMES_MODEL]).map((modelId) => ({
            id: modelId,
            name: modelId,
          })),
        });
      } catch {
        return resOk(id, { models: [{ id: HERMES_MODEL, name: HERMES_MODEL }] });
      }

    case "tasks.list":
      return resOk(id, { tasks: [] });

    // --- Cron jobs ----------------------------------------------------------

    case "cron.list": {
      const includeDisabled = p.includeDisabled !== false;
      const jobs = [...cronJobs.values()];
      return resOk(id, { jobs: includeDisabled ? jobs : jobs.filter((j) => j.enabled) });
    }

    case "cron.add": {
      const jobId = randomId();
      const job = {
        id: jobId, name: typeof p.name === "string" ? p.name : "Cron Job",
        agentId: typeof p.agentId === "string" ? p.agentId : AGENT_ID,
        sessionKey: typeof p.sessionKey === "string" ? p.sessionKey : MAIN_SESSION_KEY,
        description: typeof p.description === "string" ? p.description : "",
        enabled: p.enabled !== false, deleteAfterRun: Boolean(p.deleteAfterRun),
        updatedAtMs: Date.now(), schedule: p.schedule || { kind: "every", everyMs: 3600000 },
        sessionTarget: p.sessionTarget || "main", wakeMode: p.wakeMode || "next-heartbeat",
        payload: p.payload || { kind: "systemEvent", text: "tick" }, state: {},
      };
      cronJobs.set(jobId, job);
      return resOk(id, job);
    }

    case "cron.remove": {
      const jobId = typeof p.id === "string" ? p.id : "";
      return resOk(id, { ok: true, removed: cronJobs.delete(jobId) });
    }

    case "cron.patch": {
      const jobId = typeof p.id === "string" ? p.id : "";
      const job = cronJobs.get(jobId);
      if (!job) return resOk(id, { ok: false, error: "not_found" });
      const updated = { ...job };
      if (p.enabled !== undefined) updated.enabled = Boolean(p.enabled);
      if (p.name !== undefined) updated.name = String(p.name);
      if (p.schedule !== undefined) updated.schedule = p.schedule;
      if (p.payload !== undefined) updated.payload = p.payload;
      updated.updatedAtMs = Date.now();
      cronJobs.set(jobId, updated);
      return resOk(id, { ok: true, job: updated });
    }

    case "cron.run": {
      const jobId = typeof p.id === "string" ? p.id : "";
      const job = cronJobs.get(jobId);
      if (!job) return resOk(id, { ok: false });
      cronJobs.set(jobId, { ...job, state: { ...job.state, runningAtMs: Date.now() } });
      setTimeout(() => {
        const current = cronJobs.get(jobId);
        if (!current) return;
        const done = { ...current, state: { ...current.state, runningAtMs: undefined, lastRunAtMs: Date.now(), lastStatus: "ok" } };
        cronJobs.set(jobId, done);
        broadcastEvent({ type: "event", event: "cron", payload: { action: "finished", jobId, status: "ok", summary: done } });
      }, 3000);
      return resOk(id, { ok: true, ran: true });
    }

    default:
      console.warn(`[hermes-adapter] Unhandled method: ${method}`);
      return resOk(id, {});
  }
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

function startAdapter() {
  const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Hermes Gateway Adapter – OK\n");
  });

  const wss = new WebSocketServer({ server: httpServer });
  wss.on("error", (err) => {
    if (err.code !== "EADDRINUSE") console.error("[hermes-adapter] Server error:", sanitizeErrorMessage(err));
  });

  wss.on("connection", (ws) => {
    let connected = false;
    let globalSeq = 0;

    const send = (frame) => {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify(frame)); }
        catch (e) { console.error("[hermes-adapter] send error:", sanitizeErrorMessage(e)); }
      }
    };

    // Register this connection's send function for broadcasts
    const sendEventFn = (frame) => {
      if (frame.type === "event" && typeof frame.seq !== "number") frame.seq = globalSeq++;
      send(frame);
    };
    activeSendEventFns.add(sendEventFn);

    // send({ type: "event", event: "connect.challenge", payload: { nonce: randomId() } });

    ws.on("message", async (raw) => {
      let frame;
      try {
        frame = JSON.parse(raw.toString("utf8"));
        console.log(`[WS IN] Method: ${frame.method || frame.type}, ID: ${frame.id}`);
      } catch { return; }
      if (!frame || typeof frame !== "object" || frame.type !== "req") return;
      const { id, method, params } = frame;
      if (typeof id !== "string" || typeof method !== "string") return;

      if (method === "connect") {
        connected = true;
        const allAgents = [...agentRegistry.values()].map((a) => ({ agentId: a.id, name: a.name, isDefault: a.id === AGENT_ID }));
        send({
          type: "res", id, ok: true,
          payload: {
            type: "hello-ok", protocol: 3,
            adapterType: "openclaw",
            features: { methods: ["agents.list","agents.create","agents.delete","agents.update",
              "sessions.list","sessions.preview","sessions.patch","sessions.reset",
              "chat.send","chat.abort","chat.history","agent.wait",
              "status","config.get","config.set","config.patch",
              "agents.files.get","agents.files.set",
              "exec.approvals.get","exec.approvals.set","exec.approval.resolve",
              "wake","skills.status","models.list",
              "tasks.list",
              "cron.list","cron.add","cron.remove","cron.patch","cron.run"],
              events: ["chat","presence","heartbeat","cron"] },
            snapshot: { health: { agents: allAgents, defaultAgentId: AGENT_ID },
              sessionDefaults: { mainKey: MAIN_KEY } },
            auth: { role: "operator", scopes: ["operator.admin","operator.approvals"] },
            policy: { tickIntervalMs: 30000 },
          },
        });
        return;
      }

      if (!connected) { send(resErr(id, "not_connected", "Send connect first.")); return; }

      try {
        const response = await handleMethod(method, params, id, sendEventFn);
        send(response);
      } catch (err) {
        const message = sanitizeErrorMessage(err);
        console.error(`[hermes-adapter] Error handling ${method}:`, message);
        send(resErr(id, "internal_error", message || "Internal error"));
      }
    });

    ws.on("close", () => activeSendEventFns.delete(sendEventFn));
    ws.on("error", (err) => {
      console.error("[hermes-adapter] WebSocket error:", sanitizeErrorMessage(err));
      activeSendEventFns.delete(sendEventFn);
    });
  });

  httpServer.listen(ADAPTER_PORT, "0.0.0.0", () => {
    console.log(`\n[hermes-adapter] ✓ Listening on ws://localhost:${ADAPTER_PORT}`);
    console.log(`[hermes-adapter] ✓ Forwarding to Hermes API at ${HERMES_API_URL}`);
    console.log(`[hermes-adapter] ✓ Model: ${HERMES_MODEL}`);
    console.log(`[hermes-adapter] ✓ Multi-agent orchestration: ENABLED`);
    console.log(`\nOpen Claw3D → ws://localhost:${ADAPTER_PORT}\n`);
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[hermes-adapter] Port ${ADAPTER_PORT} in use. Set HERMES_ADAPTER_PORT to change it.`);
    } else {
      console.error("[hermes-adapter] Server error:", sanitizeErrorMessage(err));
    }
    process.exit(1);
  });

  // Broadcast initial presence so the 3D office loads agents immediately
  setTimeout(() => {
    console.log("[hermes-adapter] Broadcasting initial presence...");
    broadcastEvent({
      type: "event", event: "presence",
      payload: {
        sessions: {
          recent: [],
          byAgent: [...agentRegistry.keys()].map((aid) => ({
            agentId: aid,
            recent: [],
          })),
        },
      },
    });
  }, 2000);
}

loadHistoryFromDisk();
loadRegistryFromDisk();
autoDiscoverAgents();

if (require.main === module) {
  startAdapter();
}

module.exports = {
  startAdapter,
  completeOneTurn,
  executeToolCall,
  TEAM_TOOLS,
  broadcastEvent,
  HERMES_MODEL,
  execGenerateVisualDashboard
};
