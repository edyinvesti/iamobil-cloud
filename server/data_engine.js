const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

class DataEngine {
  constructor() {
    this.leadsPath = path.join(process.cwd(), "data", "LEADS.md");
    this.dbPath = path.join(process.cwd(), "data", "iamobil.db");
    if (!fs.existsSync(path.join(process.cwd(), "data"))) {
      fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    }
    this.db = new sqlite3.Database(this.dbPath);
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL;");
    this.initDB();
    this.isSyncing = false;
    this.needsSync = false;
  }

  initDB() {
    this.db.serialize(() => {
      this.db.run(`
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
      
      this.db.run("ALTER TABLE leads ADD COLUMN potential_value INTEGER DEFAULT 0", () => {});
      this.db.run("ALTER TABLE leads ADD COLUMN property_id INTEGER", () => {});
      this.db.run("ALTER TABLE leads ADD COLUMN last_contacted TEXT", () => {});

      this.db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lead_name TEXT,
          property_title TEXT,
          date_time TEXT,
          status TEXT DEFAULT 'Agendado',
          notes TEXT
        )
      `);
    });
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
    return new Promise((resolve) => {
      const timestamp = new Date().toLocaleString("pt-BR");
      const score = this.calculateNeuroScore(leadData);
      const potentialValue = parseInt(leadData.potential_value || 0, 10);

      this.db.run(
        `INSERT INTO leads (name, phone, interest, notes, score, status, date, potential_value, property_id, last_contacted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [leadData.name, leadData.phone, leadData.interest, leadData.notes, score, leadData.status || "Frio", timestamp, potentialValue, leadData.property_id || null, leadData.last_contacted || timestamp],
        (err) => {
          if (err) {
            console.error("[DataEngine] DB Error:", err.message);
            resolve({ ok: false });
          } else {
            this.syncMD();
            resolve({ ok: true, score });
          }
        }
      );
    });
  }

  async getFinancialReport() {
    return new Promise((resolve) => {
      this.db.get(
        "SELECT SUM(potential_value) as total_vgv, COUNT(*) as lead_count FROM leads WHERE score >= 80",
        [],
        (err, row) => {
          if (err) {
            console.error("[DataEngine] Financial Report Error:", err.message);
            resolve({ total_vgv: 0, commission: 0, lead_count: 0 });
          } else {
            const vgv = row?.total_vgv || 0;
            resolve({
              total_vgv: vgv,
              commission: vgv * 0.05, // 5% de comissão padrão
              lead_count: row?.lead_count || 0
            });
          }
        }
      );
    });
  }

  async getLeads() {
    return new Promise((resolve) => {
      this.db.all(`SELECT * FROM leads ORDER BY id DESC LIMIT 1000`, [], (err, rows) => {
        if (err) resolve([]);
        else resolve(rows);
      });
    });
  }

  async deleteLead(name, phone) {
    return new Promise((resolve) => {
      this.db.run(`DELETE FROM leads WHERE name = ? AND phone = ?`, [name, phone], (err) => {
        this.syncMD();
        resolve(!err);
      });
    });
  }

  async scheduleVisit(data) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT INTO appointments (lead_name, property_title, date_time, notes) VALUES (?, ?, ?, ?)`,
        [data.lead_name, data.property_title, data.date_time, data.notes || ""],
        (err) => {
          if (err) resolve({ ok: false, error: err.message });
          else resolve({ ok: true });
        }
      );
    });
  }

  async getAppointments() {
    return new Promise((resolve) => {
      this.db.all(`SELECT * FROM appointments ORDER BY date_time ASC`, [], (err, rows) => {
        if (err) resolve([]);
        else resolve(rows);
      });
    });
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

      fs.writeFileSync(this.leadsPath, content, "utf8");
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
