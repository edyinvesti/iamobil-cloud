const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const BRAIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hr default

class BrainEngine {
  constructor() {
    this.dbPath = path.join(process.cwd(), "data", "iamobil.db");
    this.knowledgePath = path.join(process.cwd(), "KNOWLEDGE_IMOBILIARIO.md");
    // fallback logic in case URL isn't configured, though .env has it
    this.apiUrl = process.env.HERMES_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
    this.apiKey = process.env.HERMES_API_KEY || process.env.OPENAI_API_KEY;
  }

  async reflectAndLearn() {
    if (!fs.existsSync(this.dbPath)) return;
    if (!this.apiKey) {
      console.warn("⚠️ [Brain] Chave de API não encontrada no .env para reflexão autônoma.");
      return;
    }

    try {
      console.log('🧠 [Brain] Analisando comportamento recente do banco para auto-aprendizado...');
      const db = new sqlite3.Database(this.dbPath);

      // Coletamos uma amostra dos ultimos 20 leads
      db.all("SELECT * FROM leads ORDER BY id DESC LIMIT 20", [], async (err, rows) => {
        if (err) {
            console.error('[Brain] Erro ao ler BD:', err.message);
            db.close();
            return;
        }
        
        if (!rows || rows.length === 0) {
            db.close();
            return;
        }
        
        const summary = JSON.stringify(rows.map(r => ({ interest: r.interest, status: r.status, notes: r.notes, score: r.score })));
        
        const prompt = `Atue como um analista chefe da imobiliária IAmobil.
Temos os seguintes dados brutos dos últimos 20 leads capturados pelo sistema:
${summary}

Baseado estritamente nesses contatos reais do sistema, deduza os padrões de comportamento e preferência notáveis atuais.
Responda com APENAS 3 marcadores rápidos, curtos e acionáveis servindo como regras imobiliárias de como a nossa Inteligência deve tratar clientes semelhantes amanhã. Formate a resposta sem texto inicial ou cumprimentos, apenas os marcadores md.`;

        const url = this.apiUrl;
        const bodyQuery = JSON.stringify({
            model: process.env.HERMES_MODEL || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3
        });
        
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: bodyQuery
            });
        } catch (fetchErr) {
            console.error('❌ [Brain] Fetch falhou:', fetchErr.message);
            db.close();
            return;
        }

        const data = await response.json();
        const insights = data?.choices?.[0]?.message?.content;
        
        if (insights) {
            const timestamp = new Date().toLocaleString("pt-BR");
            const logEntry = `\n\n### 🧠 Reflexão Autônoma [${timestamp}]\n${insights}`;
            fs.appendFileSync(this.knowledgePath, logEntry, "utf8");
            console.log(`✅ [Brain] Novos insights foram injetados no KNOWLEDGE_IMOBILIARIO.md com sucesso!`);
        } else {
             console.log(`⚠️ [Brain] Sem insights úteis gerados nesta iteração.`);
        }
        db.close();
      });
      
    } catch (e) {
      console.error('❌ [Brain] Erro durante a reflexão:', e.message);
    }
  }

  startAutonomousLearning(intervalInMs = BRAIN_INTERVAL_MS) {
    console.log(`⏰ [Brain] Motor Autônomo ligado! Reflexões marcadas a cada ${intervalInMs / 60000} minutos.`);
    // Roda uma vez de imediato
    setTimeout(() => this.reflectAndLearn(), 15000); 
    setInterval(() => this.reflectAndLearn(), intervalInMs);
  }
}

module.exports = new BrainEngine();
