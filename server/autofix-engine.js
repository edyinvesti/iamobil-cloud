const fs = require("fs");
const path = require("path");
const { completeOneTurn, executeToolCall, AGENT_TOOLS } = require("./hermes-gateway-adapter");
const memoryManager = require("./memory-manager");

const LOG_FILE = path.join(__dirname, "..", "server.log");
const REPAIR_LOG = path.join(__dirname, "..", "REPAROS_IA.md");

let lastReadSize = 0;

/**
 * Motor de Auto-Healing iAmobil
 * Monitora o log e tenta corrigir erros fatais automaticamente.
 */
class AutofixEngine {
  constructor() {
    console.log("🚀 [Autofix-Engine] Iniciado. Vigilante ativo com Memória.");
    this.repairAttempts = new Map(); // Para evitar loops de reparo
    if (fs.existsSync(LOG_FILE)) {
      lastReadSize = fs.statSync(LOG_FILE).size;
    }
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => {
      this.checkLogs();
    }, 15000); 
  }

  async checkLogs() {
    try {
      if (!fs.existsSync(LOG_FILE)) return;
      const stats = fs.statSync(LOG_FILE);
      if (stats.size <= lastReadSize) return;

      const fd = fs.openSync(LOG_FILE, 'r');
      const buffer = Buffer.alloc(stats.size - lastReadSize);
      fs.readSync(fd, buffer, 0, stats.size - lastReadSize, lastReadSize);
      fs.closeSync(fd);

      const newContent = buffer.toString('utf8');
      lastReadSize = stats.size;

      if (this.isFatalError(newContent)) {
        const errorKey = newContent.split('\n')[0].slice(0, 100);
        const attempts = this.repairAttempts.get(errorKey) || 0;
        
        if (attempts >= 3) {
          console.warn(`⚠️ [Autofix-Engine] Abortando reparo para erro recorrente: ${errorKey}`);
          return;
        }

        console.log("🚨 [Autofix-Engine] Erro fatal detectado! Consultando Genio Fix...");
        this.repairAttempts.set(errorKey, attempts + 1);
        await this.triggerRepair(newContent);
      }
    } catch (err) {
      console.error("[Autofix-Engine] Erro no Monitor:", err.message);
    }
  }

  isFatalError(content) {
    const criticalKeywords = [
      "Error: Cannot find module",
      "ReferenceError:",
      "SyntaxError:",
      "ECONNREFUSED",
      "Status code 500",
      "Internal Server Error",
      "Unable to acquire lock"
    ];
    return criticalKeywords.some(kw => content.includes(kw));
  }

  async triggerRepair(errorContext) {
    const memory = memoryManager.getMemory();
    const systemPrompt = `Você é o Genio Fix, o sistema de auto-reparo de ELITE da iAmobil.
Foi detectado um ERRO FATAL no log. 

CONTEXTO DO PROJETO (MEMÓRIA):
Stack: ${memory.stack.join(", ")}
Arquivos conhecidos: ${JSON.stringify(memory.conhecimento_arquivos)}
Últimos reparos: ${JSON.stringify(memory.historico_correcoes)}

Sua missão é:
1. Siga RIGOROSAMENTE o "Protocolo de Segurança iAmobil" (assets/skills/security-protocol/SKILL.md).
2. Inicie com "system_health_check" para entender o estado do servidor.
3. Analisar o log e correlacionar com a memória do projeto.
4. Usar ferramentas para examinar e CORRIGIR o erro, sempre priorizando a estabilidade.
5. SEMPRE salve backups (.bak) antes de editar.
6. Se a correção falhar ou introduzir novo erro, PARE e peça ajuda humana. Não entre em loop.

Responda com brevidade sobre o que consertou.`;

    const userMsg = `LOG RECENTE:\n${errorContext.slice(-2000)}`;

    try {
      const { textContent, toolCalls } = await completeOneTurn([
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg }
      ], process.env.HERMES_MODEL || "llama3.2", AGENT_TOOLS);

      let filesAffected = [];
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          console.log(`🔧 [GenioFix Action] Executando: ${tc.name}`);
          await executeToolCall(tc);
          if (tc.args?.path) filesAffected.push(tc.args.path);
        }
      }

      // Registrar na memória persistente
      memoryManager.addRepair(errorContext, textContent || "Correção via ferramentas.", filesAffected);
      
      this.logRepair(errorContext, textContent || "Reparo executado via ferramentas.");
    } catch (err) {
      console.error("[Autofix-Engine] Falha ao disparar reparo:", err.message);
    }
  }

  logRepair(error, solution) {
    const entry = `\n---\n### 🔧 Reparo Automático: ${new Date().toLocaleString('pt-BR')}\n` +
                  `**Erro:** \`${error.split('\n')[0]}\`\n` +
                  `**Ação do Genio Fix:** ${solution}\n`;
    
    fs.appendFileSync(REPAIR_LOG, entry, "utf8");
  }
}

module.exports = new AutofixEngine();
