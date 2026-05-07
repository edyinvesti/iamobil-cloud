const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { createClient } = require('@libsql/client');

class DataEngine {
  constructor() {
    this.leadsPath = path.join(process.cwd(), "data", "LEADS.md");
    this.dbPath = path.join(process.cwd(), "data", "iamobil.db");
    if (!fs.existsSync(path.join(process.cwd(), "data"))) {
      fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    }
    this.dbClient = null;
    this.db = null;
    this.initDB();
    this.isSyncing = false;
    this.needsSync = false;
  }

  async checkClient() {
    if (this.dbClient || this.db) return;
    const tursoUrl = process.env.TURSO_DB_URL;
    const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
      this.dbClient = createClient({ url: tursoUrl, authToken: tursoToken });
      console.log("☁️ [Data Engine] Conectado ao Turso DB (Nuvem)");
    } else {
      this.db = new sqlite3.Database(this.dbPath);
      console.log("💾 [Data Engine] Conectado ao SQLite (Local)");
    }
  }



  async executeQuery(sql, params = []) {
    await this.checkClient();
    if (this.dbClient) {
      try {
        const rs = await this.dbClient.execute({ sql, args: params });
        return rs;
      } catch (e) {
        if (e.message && (
          e.message.includes('no such table') || 
          e.message.includes('tabela inexistente') || 
          e.message.includes('tabela não encontrada')
        )) {
          console.warn("⚠️ [Data Engine] Tabela não encontrada, inicializando...");
          await this.initDB();
          return await this.dbClient.execute({ sql, args: params });
        }
        throw e;
      }
    } else {
      return new Promise((resolve, reject) => {
        const runQuery = () => {
          if (sql.trim().toUpperCase().startsWith("SELECT")) {
            this.db.all(sql, params, (err, rows) => {
              if (err && (err.message.includes('no such table') || err.message.includes('tabela não encontrada'))) {
                console.warn("⚠️ [Data Engine] Tabela SQLite não encontrada, inicializando...");
                this.initDB().then(() => {
                  this.db.all(sql, params, (err2, rows2) => {
                    if (err2) reject(err2);
                    else resolve({ rows: rows2 });
                  });
                }).catch(reject);
              } else {
                if (err) reject(err);
                else resolve({ rows });
              }
            });
          } else {
            this.db.run(sql, params, function(err) {
              if (err && (err.message.includes('no such table') || err.message.includes('tabela não encontrada'))) {
                console.warn("⚠️ [Data Engine] Tabela SQLite não encontrada, inicializando...");
                this.initDB().then(() => {
                  this.db.run(sql, params, function(err2) {
                    if (err2) reject(err2);
                    else resolve({ lastInsertRowid: this.lastID, rowsAffected: this.changes });
                  });
                }).catch(reject);
              } else {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID, rowsAffected: this.changes });
              }
            });
          }
        };
        runQuery();
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

    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        title TEXT,
        price REAL,
        bedrooms INTEGER,
        bathrooms INTEGER,
        area REAL,
        location TEXT,
        description TEXT,
        imagePath TEXT,
        images TEXT,
        brokerName TEXT,
        brokerCreci TEXT,
        suites INTEGER DEFAULT 0,
        livingRooms INTEGER DEFAULT 0,
        kitchens INTEGER DEFAULT 0,
        parkingSpaces INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        receivedAt TEXT,
        aiDescription TEXT,
        zipCode TEXT,
        neighborhood TEXT,
        city TEXT,
        state TEXT,
        streetNumber TEXT,
        complement TEXT,
        sizeUnit TEXT DEFAULT 'm²'
      )
    `);

    // Migração de colunas novas
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN suites INTEGER DEFAULT 0"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN livingRooms INTEGER DEFAULT 0"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN kitchens INTEGER DEFAULT 0"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN parkingSpaces INTEGER DEFAULT 0"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN zipCode TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN neighborhood TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN city TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN state TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN streetNumber TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN complement TEXT"); } catch(e) {}
    try { await this.executeQuery("ALTER TABLE properties ADD COLUMN sizeUnit TEXT DEFAULT 'm²'"); } catch(e) {}

    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS brokers (
        creci TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        photo TEXT,
        lastActive TEXT
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

  async savePartnerProperty(data) {
    try {
      await this.executeQuery(
        `INSERT INTO properties (id, title, price, bedrooms, bathrooms, area, location, description, imagePath, images, brokerName, brokerCreci, suites, livingRooms, kitchens, parkingSpaces, status, receivedAt, aiDescription, zipCode, neighborhood, city, state, streetNumber, complement, sizeUnit) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, price=excluded.price, status=excluded.status, 
         bedrooms=excluded.bedrooms, bathrooms=excluded.bathrooms, suites=excluded.suites, 
         livingRooms=excluded.livingRooms, kitchens=excluded.kitchens, parkingSpaces=excluded.parkingSpaces,
         location=excluded.location, description=excluded.description, images=excluded.images,
         zipCode=excluded.zipCode, neighborhood=excluded.neighborhood, city=excluded.city, state=excluded.state, streetNumber=excluded.streetNumber, complement=excluded.complement, sizeUnit=excluded.sizeUnit`,
        [
          data.id, data.title, data.price, data.bedrooms || 0, data.bathrooms || 0, 
          data.size || 0, data.address || "", data.description || "", data.imagePath || "", 
          JSON.stringify(data.images || []), data.brokerName || "", data.brokerCreci || "", 
          data.suites || 0, data.livingRooms || 0, data.kitchens || 0, data.parkingSpaces || 0,
          data.remoteStatus || "pending", data.receivedAt || new Date().toISOString(), data.aiDescription || "",
          data.zipCode || "", data.neighborhood || "", data.city || "", data.state || "", data.streetNumber || "", data.complement || "",
          data.sizeUnit || 'm²'
        ]
      );
      return { ok: true };
    } catch (err) {
      console.error("[DataEngine] Property DB Error:", err.message);
      return { ok: false, error: err.message };
    }
  }

  async getPendingProperties() {
    try {
      const rs = await this.executeQuery(`SELECT * FROM properties WHERE status = 'pending' ORDER BY receivedAt DESC`, []);
      return rs.rows || [];
    } catch (err) {
      return [];
    }
  }

  async getPropertiesByBroker(creci) {
    try {
      const rs = await this.executeQuery(`SELECT * FROM properties WHERE brokerCreci = ? ORDER BY receivedAt DESC`, [creci]);
      const rows = rs.rows || [];
      return rows.map(p => {
        try {
          return { ...p, images: p.images ? JSON.parse(p.images) : [] };
        } catch {
          return { ...p, images: [] };
        }
      });
    } catch (err) {
      console.error("[DataEngine] getPropertiesByBroker Error:", err.message);
      return [];
    }
  }



  async getPropertyStatus(id) {
    try {
      const rs = await this.executeQuery(`SELECT status FROM properties WHERE id = ?`, [id]);
      return rs.rows?.[0]?.status || "unknown";
    } catch (err) {
      return "unknown";
    }
  }

  async saveBroker(data) {
    const timestamp = new Date().toISOString();
    try {
      await this.executeQuery(
        `INSERT INTO brokers (creci, name, email, phone, photo, lastActive) 
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(creci) DO UPDATE SET
         name=excluded.name, email=excluded.email, phone=excluded.phone, photo=excluded.photo, lastActive=excluded.lastActive`,
        [data.creci, data.name, data.email, data.phone, data.photo || null, timestamp]
      );
      return { ok: true };
    } catch (err) {
      console.error("[DataEngine] Broker DB Error:", err.message);
      return { ok: false, error: err.message };
    }
  }

  async getBrokers() {
    try {
      const rs = await this.executeQuery(`SELECT * FROM brokers ORDER BY lastActive DESC`, []);
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
