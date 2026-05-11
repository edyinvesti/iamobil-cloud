const { createClient } = require('@libsql/client');
require('dotenv').config();

async function testTurso() {
    console.log("🔍 [Cloud Probe] Iniciando teste de conexão com Turso...");
    console.log("🔗 URL:", process.env.TURSO_DB_URL);
    
    if (!process.env.TURSO_DB_URL || !process.env.TURSO_DB_AUTH_TOKEN) {
        console.error("❌ Credenciais ausentes no .env");
        process.exit(1);
    }

    const client = createClient({
        url: process.env.TURSO_DB_URL,
        authToken: process.env.TURSO_DB_AUTH_TOKEN
    });

    try {
        const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
        console.log("📂 Tabelas encontradas na Nuvem:", tables.rows.map(r => r.name).join(', '));
        
        for (const table of tables.rows) {
            const count = await client.execute(`SELECT COUNT(*) as total FROM ${table.name}`);
            console.log(`📊 Tabela [${table.name}]: ${count.rows[0].total} registros`);
        }

        console.log("✅ Conexão com a Nuvem está PERFEITA!");
        process.exit(0);
    } catch (e) {
        console.error("❌ Falha na conexão com Turso:", e.message);
        process.exit(1);
    }
}

testTurso();
