const fs = require("fs");
const path = require("path");
const { createClient } = require('@libsql/client');

class DataEngine {
  constructor() {
    this.leadsPath = path.join(process.cwd(), "data", "LEADS.md");
    this.dbPath = path.join(process.cwd(), "data", "iamobil.db");
    if (!fs.existsSync(path.join(process.cwd(), "data"))) {
      fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    }
    
    this.tursoUrl = process.env.TURSO_DB_URL;
    this.tursoToken = process.env.TURSO_DB_AUTH_TOKEN;

    if (this.tursoUrl && this.tursoToken) {
      this.dbClient = createClient({
        url: this.tursoUrl,
        authToken: this.tursoToken
      });
      console.log("☁️ [Data Engine] Conectado ao Turso DB (Nuvem)");
    } else {
      this.dbClient = null;
      this.db = new sqlite3.Database(this.dbPath);
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA synchronous = NORMAL;");
      console.log("💾 [Data Engine] Conectado ao SQLite (Local)");
    }

    this.initDB();
    this.isSyncing = false;
    this.needsSync = false;
  }

  async executeQuery(sql, params = []) {
    if (this.dbClient) {
      const rs = await this.dbClient.execute({ sql, args: params });
      return rs;
    } else {
      return new Promise((resolve, reject) => {
        if (sql.trim().toUpperCase().startsWith("SELECT")) {
          this.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        } else {
          this.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastInsertRowid: this.lastID, rowsAffected: this.changes });
          });
        }
      });
    }
  }

  async initDB() {
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        interest TEXT,
        notes TEXT,
        score INTEGER,
        status TEXT DEFAULT 'Frio',
        date TEXT,
        potential_value INTEGER DEFAULT 0,
        property_id INTEGER,
        last_contacted TEXT
      )
    `);
    
    // Tentativa de adicionar colunas (ignorando erros se já existirem)
    try { await this.executeQuery("ALTER TABLE leads ADD COLUMN potential_value INTEGER DEFAULT 0"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE leads ADD COLUMN property_id INTEGER"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE leads ADD COLUMN last_contacted TEXT"); } catch(e) {}

    await this.executeQuery(`
       CREATE TABLE IF NOT EXISTS appointments (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         lead_name TEXT,
         property_title TEXT,
         date_time TEXT,
         status TEXT DEFAULT 'Agendado',
         notes TEXT
       )
    `);
  }

  calculateNeuroScore(data) {
    let score = 50;
    const text = ((data.interest || "") + " " + (data.notes || "")).toLowerCase();
    if (text.includes("imediato") || text.includes("urgente")) score += 30;
    if (text.includes("investimento") || text.includes("à vista")) score += 20;
    if (text.includes("visita") || text.includes("agendar")) score += 15;
    if (text.includes("curious") || text.includes("só vendo")) score -= 20;
    return Math.min(100, Math.max(0, score));
  }

  async saveLead(leadData) {
    const timestamp = new Date().toLocaleString("pt-BR");
    const score = this.calculateNeuroScore(leadData);
    const potentialValue = parseInt(leadData.potential_value || 0, 10);

    try {
      await this.executeQuery(
        `INSERT INTO leads (name, phone, interest, notes, score, status, date, potential_value, property_id, last_contacted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [leadData.name, leadData.phone, leadData.interest, leadData.notes, score, leadData.status || "Frio", timestamp, potentialValue, leadData.property_id || null, leadData.last_contacted || timestamp]
      );
      this.syncMD();
      return { ok: true, score };
    } catch (err) {
      console.error("[DataEngine] DB Error:", err.message);
      return { ok: false };
    }
  }

  async getFinancialReport() {
    try {
      const rs = await this.executeQuery(
        "SELECT SUM(potential_value) as total_vgv, COUNT(*) as lead_count FROM leads WHERE score >= 80",
        []
      );
      const row = rs.rows ? rs.rows[0] : null;
      const vgv = row?.total_vgv || 0;
      return {
        total_vgv: vgv,
        commission: vgv * 0.05, // 5% de comissão padrão
        lead_count: row?.lead_count || 0
      };
    } catch (err) {
      console.error("[DataEngine] Financial Report Error:", err.message);
      return { total_vgv: 0, commission: 0, lead_count: 0 };
    }
  }

  async getLeads() {
    try {
      const rs = await this.executeQuery(`SELECT * FROM leads ORDER BY id DESC LIMIT 1000`, []);
      return rs.rows || [];
    } catch (err) {
      return [];
    }
  }

  async deleteLead(name, phone) {
    try {
      await this.executeQuery(`DELETE FROM leads WHERE name = ? AND phone = ?`, [name, phone]);
      this.syncMD();
      return true;
    } catch (err) {
      return false;
    }
  }

  async scheduleVisit(data) {
    try {
      await this.executeQuery(
        `INSERT INTO appointments (lead_name, property_title, date_time, notes) VALUES (?, ?, ?, ?)`,
        [data.lead_name, data.property_title, data.date_time, data.notes || ""]
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async getAppointments() {
    try {
      const rs = await this.executeQuery(`SELECT * FROM appointments ORDER BY date_time ASC`, []);
      return rs.rows || [];
    } catch (err) {
      return [];
    }
  }

  async syncMD() {
    if (this.isSyncing) {
      this.needsSync = true;
      return;
    }
    
    this.isSyncing = true;
    this.needsSync = false;

    try {
      // Pegamos apenas os últimos 1000 leads para evitar overflow de memória em grandes volumes
      const leads = (await this.getLeads()).slice(-1000);
      let content = "# 📈 iAmobil - Gestão de Leads (CRM)\n\nRelatório dos últimos 1000 potenciais clientes capturados.\n\n";
      
      leads.forEach(l => {
        content += `---\n`;
        content += `👤 Nome:** ${l.name}\n`;
        content += `📱 Telefone:** ${l.phone}\n`;
        content += `🏠 Interesse:** ${l.interest}\n`;
        content += `📝 Notas:** ${l.notes}\n`;
        content += `💰 Valor Potencial:** R$ ${(l.potential_value || 0).toLocaleString('pt-BR')}\n`;
        content += `⭐ Score:** ${l.score}\n`;
        content += `📅 Data:** ${l.date}\n\n`;
      });

      const tempPath = this.leadsPath + ".tmp";
      fs.writeFileSync(tempPath, content, "utf8");
      fs.renameSync(tempPath, this.leadsPath);
    } catch (err) {
      console.error("[DataEngine] SyncMD Error:", err.message);
    } finally {
      this.isSyncing = false;
      if (this.needsSync) {
        // Delay next sync to avoid back-to-back heavy I/O
        setTimeout(() => this.syncMD(), 5000); 
      }
    }
  }
}

module.exports = new DataEngine();
