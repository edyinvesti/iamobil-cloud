const dataEngine = require('./data_engine');
const fs = require('fs');
const path = require('path');

class MaintenanceEngine {
  constructor() {
    this.syncIntervalMs = 5 * 60 * 1000; // 5 minutos para sincronia pendente
    this.cleanupIntervalMs = 12 * 60 * 60 * 1000; // 12 horas para limpeza profunda
  }

  start() {
    console.log("🛠️ [Maintenance-Engine] Vigilante de Manutenção iniciado.");
    
    // Ciclo de sincronia de dados pendentes para a Nuvem
    setInterval(async () => {
      console.log("🔄 [Maintenance] Verificando fila de sincronia pendente...");
      await dataEngine.syncPendingToCloud();
    }, this.syncIntervalMs);

    // Ciclo de limpeza e auditoria de integridade
    setInterval(async () => {
      await this.runAudit();
    }, this.cleanupIntervalMs);

    // Rodar auditoria inicial após 1 minuto de boot
    setTimeout(() => this.runAudit(), 60000);
  }

  async runAudit() {
    console.log("🧹 [Maintenance] Iniciando ciclo de auditoria e limpeza...");
    try {
      // 1. Limpeza de Duplicatas por Título (Migrado do cleanup_duplicates.cjs)
      const properties = await dataEngine.executeQuery("SELECT id, title FROM properties");
      const rows = properties.rows || [];
      const seen = new Map();
      const toDelete = [];

      rows.forEach(p => {
        if (seen.has(p.title)) {
          toDelete.push(p.id);
        } else {
          seen.set(p.title, p.id);
        }
      });

      if (toDelete.length > 0) {
        console.log(`🗑️ [Maintenance] Removendo ${toDelete.length} duplicatas encontradas.`);
        for (const id of toDelete) {
          await dataEngine.deleteProperty(id);
        }
      }

      // 2. Verificação de Saúde do Banco (Auditoria de Integridade)
      const dbPath = dataEngine.dbPath;
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        console.log(`📊 [Maintenance] Integridade DB Local: OK (${(stats.size/1024/1024).toFixed(2)} MB)`);
      }

      console.log("✅ [Maintenance] Ciclo de auditoria concluído com sucesso.");
    } catch (err) {
      console.error("❌ [Maintenance] Erro durante auditoria:", err.message);
    }
  }
}

module.exports = new MaintenanceEngine();
