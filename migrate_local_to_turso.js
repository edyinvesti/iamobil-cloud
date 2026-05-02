require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
const path = require('path');

async function migrateData() {
    console.log("🚀 Iniciando Operação Zero-Custo: Migração Direta Local -> Nuvem");

    const tursoUrl = process.env.TURSO_DB_URL;
    const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
        console.error("❌ Credenciais do Turso faltando no .env");
        process.exit(1);
    }

    const tursoClient = createClient({ url: tursoUrl, authToken: tursoToken });
    const localDbPath = path.join(process.cwd(), "data", "iamobil.db");

    // 1. Criar tabela no Turso se não existir
    await tursoClient.execute(`CREATE TABLE IF NOT EXISTS rag_vectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT,
        content TEXT,
        embedding TEXT
    )`);

    const db = new sqlite3.Database(localDbPath, sqlite3.OPEN_READONLY, async (err) => {
        if (err) {
            console.error("❌ Falha ao abrir o banco local:", err);
            process.exit(1);
        }

        db.all("SELECT * FROM rag_vectors", [], async (err, rows) => {
            if (err) {
                console.error("❌ Falha ao ler vetores locais:", err);
                process.exit(1);
            }

            console.log(`📦 Encontrados ${rows.length} vetores locais. Transferindo...`);

            let success = 0;
            for (const row of rows) {
                try {
                    // Check se já existe no cloud
                    const check = await tursoClient.execute({
                        sql: "SELECT id FROM rag_vectors WHERE source = ? AND content = ? LIMIT 1",
                        args: [row.source, row.content]
                    });

                    if (check.rows.length === 0) {
                        await tursoClient.execute({
                            sql: "INSERT INTO rag_vectors (source, content, embedding) VALUES (?, ?, ?)",
                            args: [row.source, row.content, row.embedding]
                        });
                        success++;
                        if (success % 10 === 0) console.log(`Enviados: ${success}/${rows.length}`);
                    }
                } catch (e) {
                    console.error("⚠️ Erro ao inserir linha:", e.message);
                }
            }

            console.log(`\n✅ Migração Direta Finalizada! ${success} novos conhecimentos injetados na nuvem. Custo: $0.00.`);
            db.close();
            process.exit(0);
        });
    });
}

migrateData();
