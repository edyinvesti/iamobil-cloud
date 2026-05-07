const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
const pdfParse = require('pdf-parse');
const axios = require('axios');

class RagEngine {
    constructor() {
        this.dbPath = path.join(process.cwd(), "data", "iamobil.db");
        this.kbPath = path.join(process.cwd(), "assets", "knowledge_base");
        this.defaultOpenAiKey = process.env.OPENAI_API_KEY || process.env.HERMES_API_KEY;
        this.geminiKey = process.env.GEMINI_API_KEY;
        
        this.tursoUrl = process.env.TURSO_DB_URL;
        this.tursoToken = process.env.TURSO_DB_AUTH_TOKEN;

        if (this.tursoUrl && this.tursoToken) {
            this.dbClient = createClient({
                url: this.tursoUrl,
                authToken: this.tursoToken
            });
            console.log("☁️ [RAG Engine] Conectado ao Turso DB (Nuvem)");
        } else {
            this.dbClient = null;
            console.log("💾 [RAG Engine] Conectado ao SQLite (Local)");
        }
        
        this.initVectorDB();
    }

    async executeQuery(sql, params = []) {
        if (this.dbClient) {
            try {
                const rs = await this.dbClient.execute({ sql, args: params });
                return rs.rows;
            } catch (e) {
                if (e.message && (
                    e.message.includes('no such table') || 
                    e.message.includes('tabela inexistente') || 
                    e.message.includes('tabela não encontrada')
                )) {
                    console.warn("⚠️ [RAG Engine] Tabela não encontrada, inicializando...");
                    await this.initVectorDB();
                    try {
                        const rs2 = await this.dbClient.execute({ sql, args: params });
                        return rs2.rows;
                    } catch (e2) {
                        return [];
                    }
                }
                console.error("❌ [Turso DB] Erro na query:", e.message);
                return [];
            }
        } else {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.dbPath);
                if (sql.trim().toUpperCase().startsWith("SELECT")) {
                    db.all(sql, params, (err, rows) => {
                        db.close();
                        if (err) reject(err);
                        else resolve(rows || []);
                    });
                } else {
                    db.run(sql, params, function(err) {
                        db.close();
                        if (err) reject(err);
                        else resolve({ insertId: this.lastID, changes: this.changes });
                    });
                }
            });
        }
    }

    async initVectorDB() {
        await this.executeQuery(`CREATE TABLE IF NOT EXISTS rag_vectors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            content TEXT,
            embedding TEXT
        )`);
    }

    async getEmbedding(input, retries = 2, delay = 3000) {
        if (!this.defaultOpenAiKey && !this.geminiKey) {
            console.error("❌ [RAG Engine] Nenhuma chave de API (OpenAI ou Gemini) encontrada.");
            return null;
        }

        try {
            // Tentativa Primária: OpenAI
            if (this.defaultOpenAiKey) {
                try {
                    const response = await axios.post('https://api.openai.com/v1/embeddings', {
                        input: input,
                        model: "text-embedding-3-small"
                    }, {
                        headers: { "Authorization": `Bearer ${this.defaultOpenAiKey}` },
                        timeout: 15000
                    });
                    
                    if (Array.isArray(input)) {
                        return response.data.data.map(d => d.embedding);
                    }
                    return response.data.data[0].embedding;
                } catch (e) {
                    if (e.response && e.response.status === 429) {
                        console.log(`⚠️ [RAG Engine] OpenAI falhou (429 Rate Limit). Tentando Fallback Imediato para Gemini...`);
                        return await this.getGeminiEmbeddingFallback(input);
                    }
                    throw e; 
                }
            } else {
                console.log(`⚠️ [RAG Engine] Chave OpenAI ausente. Tentando Fallback para Gemini...`);
                return await this.getGeminiEmbeddingFallback(input);
            }
        } catch (error) {
            console.error("❌ [RAG Engine] Falha na obtenção do Embedding (Principal):", error.response?.data || error.message);
            if (retries > 0) {
                console.log(`🔄 [RAG Engine] Tentando novamente em ${delay/1000}s... (Restam ${retries})`);
                await new Promise(res => setTimeout(res, delay));
                return this.getEmbedding(input, retries - 1, delay * 1.5);
            }
            return null;
        }
    }

    // [Fallback] Mecanismo de Segurança via Gemini (Gratuito/Alta Estabilidade)
    async getGeminiEmbeddingFallback(input) {
        if (!this.geminiKey) {
            console.error("❌ [RAG Engine] Chave do Gemini (Fallback) não configurada.");
            return null;
        }

        try {
            const inputs = Array.isArray(input) ? input : [input];
            const embeddings = [];

            for (const text of inputs) {
                const response = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.geminiKey}`,
                    {
                        content: { parts: [{ text: text }] }
                    },
                    { timeout: 15000, headers: { "Content-Type": "application/json" } }
                );

                const vector = response.data?.embedding?.values;
                if (!vector) throw new Error("Gemini retornou um formato inválido ou vazio.");
                
                // Truncate ou Padding nativo para 1536 dimensões se necessário
                // O modelo text-embedding-004 da Google retorna 768 dimensões por padrão.
                // A nossa similaridade de cosseno funciona independente da dimensão, desde que seja consistente na base.
                embeddings.push(vector);
            }

            return Array.isArray(input) ? embeddings : embeddings[0];
        } catch (error) {
            console.error("❌ [RAG Engine] Falha Crítica no Fallback do Gemini:", error.response?.data || error.message);
            return null;
        }
    }

    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
        
        const a = new Float32Array(vecA);
        const b = new Float32Array(vecB);
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        return isNaN(similarity) ? 0 : similarity;
    }

    async syncKnowledgeBase() {
        if (!fs.existsSync(this.kbPath)) {
            console.error("❌ [RAG Engine] Pasta assets/knowledge_base não encontrada.");
            return;
        }

        const files = fs.readdirSync(this.kbPath);
        for (const file of files) {
            const filePath = path.join(this.kbPath, file);
            const ext = path.extname(file).toLowerCase();
            const sourceName = path.basename(file);

            // Verifica usando a nova função genérica
            const existing = await this.executeQuery("SELECT id FROM rag_vectors WHERE source = ? LIMIT 1", [sourceName]);
            if (existing && existing.length > 0) continue; 

            // Se não existe, lê o conteúdo
            let content = "";
            if (ext === '.md' || ext === '.txt') {
                content = fs.readFileSync(filePath, "utf8");
            } else if (ext === '.pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                try {
                    const data = await pdfParse(dataBuffer);
                    content = data.text;
                } catch (err) {
                    console.error(`❌ [RAG Engine] Erro ao carregar PDF ${file}:`, err.message);
                }
            }

            if (content) {
                const chunks = content.split(/\n\s*\n/);
                const batchSize = 5;
                const rawChunks = chunks;

                for (let i = 0; i < rawChunks.length; i += batchSize) {
                    const batch = rawChunks.slice(i, i + batchSize)
                        .map(chunk => chunk.replace(/\n/g, " ").trim())
                        .filter(chunk => chunk.length >= 50);
                    
                    if (batch.length === 0) continue;

                    const embeddings = await this.getEmbedding(batch);
                    
                    if (embeddings && Array.isArray(embeddings)) {
                        for (let j = 0; j < batch.length; j++) {
                            await this.executeQuery(
                                "INSERT INTO rag_vectors (source, content, embedding) VALUES (?, ?, ?)", 
                                [sourceName, batch[j], JSON.stringify(embeddings[j])]
                            );
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 5000));
                }
                console.log(`✅ [RAG Engine] Arquivo ${file} injetado e vetorizado!`);
            }
        }
    }

    async searchKnowledge(query, limit = 3) {
        const queryEmbedding = await this.getEmbedding(query);
        if (!queryEmbedding) return "";

        const keywords = query.toLowerCase()
            .replace(/[^\w\sà-ú]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3);

        let sql = "SELECT id, content, embedding FROM rag_vectors";
        let params = [];
        
        if (keywords.length > 0) {
            const likeClauses = keywords.map(() => "content LIKE ?").join(" OR ");
            sql += ` WHERE ${likeClauses}`;
            params = keywords.map(k => `%${k}%`);
        }
        
        sql += " LIMIT 50";

        try {
            let rows = await this.executeQuery(sql, params);

            if (!rows || rows.length === 0) {
                if (keywords.length > 0) {
                    rows = await this.executeQuery("SELECT id, content, embedding FROM rag_vectors ORDER BY RANDOM() LIMIT 20", []);
                    if (!rows || rows.length === 0) return "";
                } else {
                    return "";
                }
            }

            return this.performReranking(queryEmbedding, rows, limit);
        } catch (e) {
            console.error("❌ [RAG Engine] Erro na busca:", e.message);
            return "";
        }
    }

    performReranking(queryEmbedding, candidates, limit) {
        const scoredDocs = candidates.map(r => {
            try {
                const docEmb = JSON.parse(r.embedding);
                const score = this.cosineSimilarity(queryEmbedding, docEmb);
                return { content: r.content, score };
            } catch (e) {
                return { content: r.content, score: 0 };
            }
        });

        scoredDocs.sort((a, b) => b.score - a.score);
        const topDocs = scoredDocs.slice(0, limit).filter(d => d.score > 0.45);
        
        if (topDocs.length > 0) {
            return topDocs.map(d => d.content).join("\n---\n");
        } else {
            return "";
        }
    }
}

module.exports = new RagEngine();
