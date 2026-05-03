const fs = require("fs");
const path = require("path");

const MEMORY_FILE = path.join(process.cwd(), "PROJECT_MEMORY.json");

class MemoryManager {
  constructor() {
    this.initMemory();
  }

  initMemory() {
    if (!fs.existsSync(MEMORY_FILE)) {
      const initial = {
        stack: ["Node.js", "Next.js", "Hermes AI", "Groq", "SQLite"],
        erros_recorrentes: [],
        reparos_sucesso: [],
        conhecimento_arquivos: {
          "server/index.js": "Ponto de entrada do servidor Next.js e inicialização de motores.",
          "server/hermes-gateway-adapter.js": "Núcleo de orquestração de IA e ferramentas (Edy).",
          "server/messaging_hub.js": "Ponte entre Telegram/WhatsApp e o cérebro da iAmobil.",
          "server/data_engine.js": "Gestão de persistência de Leads e CRM em SQLite.",
          "server/autofix-engine.js": "Vigilante autônomo e motor de Auto-Healing."
        },
        historico_correcoes: []
      };
      fs.writeFileSync(MEMORY_FILE, JSON.stringify(initial, null, 2), "utf8");
    }
  }

  getMemory() {
    try {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    } catch (err) {
      console.error("[MemoryManager] Read Error:", err.message);
      return {};
    }
  }

  addRepair(error, solution, filesAffected) {
    const memory = this.getMemory();
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.slice(0, 500),
      solution: solution.slice(0, 1000),
      files: filesAffected
    };
    memory.historico_correcoes.push(entry);
    
    // Manter apenas os últimos 20 reparos para não estourar o contexto
    if (memory.historico_correcoes.length > 20) {
      memory.historico_correcoes.shift();
    }

    const tempFile = MEMORY_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(memory, null, 2), "utf8");
    fs.renameSync(tempFile, MEMORY_FILE);
    console.log("💾 [MemoryManager] Novo reparo registrado na memória do projeto.");
  }
}

module.exports = new MemoryManager();
