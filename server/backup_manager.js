const fs = require("fs");
const path = require("path");

const SOURCE_FILES = [
  { path: "data/iamobil.db", name: "iamobil.db" },
  { path: "data/LEADS.md", name: "LEADS.md" },
  { path: "assets/knowledge_base/CATALOG.md", name: "CATALOG.md" },
  { path: "assets/knowledge_base/GOLD_MEMORY.md", name: "GOLD_MEMORY.md" },
  { path: ".env", name: ".env" }
];

const BACKUP_ROOT = path.join(process.env.USERPROFILE || process.env.HOME, "Documents", "iAmobil_Backups");

/**
 * Backup Manager - Garante a resiliência dos dados da iAmobil.
 */
function createExternalBackup() {
  console.log("💿 [Backup-Manager] Iniciando backup de segurança externa...");
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dailyPath = path.join(BACKUP_ROOT, `Backup_${timestamp.slice(0, 10)}`);
  
  if (!fs.existsSync(dailyPath)) {
    fs.mkdirSync(dailyPath, { recursive: true });
  }

  SOURCE_FILES.forEach(item => {
    const src = path.join(process.cwd(), item.path);
    const dest = path.join(dailyPath, `${timestamp}_${item.name}`);
    
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest);
      } catch (e) {
        console.error(`❌ [Backup-Manager] Erro ao copiar ${file}:`, e.message);
      }
    }
  });

  console.log(`✅ [Backup-Manager] Backup concluído em: ${dailyPath}`);
  return dailyPath;
}

module.exports = { createExternalBackup };
