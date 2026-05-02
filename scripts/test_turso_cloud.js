const { createClient } = require('@libsql/client');
require('dotenv').config();

async function testTurso() {
    console.log("Testing Turso connection...");
    const url = process.env.TURSO_DB_URL;
    const token = process.env.TURSO_DB_AUTH_TOKEN;
    
    if (!url || !token) {
        console.error("Turso URL or Token missing in .env");
        return;
    }
    
    try {
        const client = createClient({ url, authToken: token });
        const rs = await client.execute("SELECT 1 as result");
        console.log("✅ Turso Connection Success!", rs.rows);
    } catch (e) {
        console.error("❌ Turso Connection Failed:", e.message);
    }
}

testTurso();
