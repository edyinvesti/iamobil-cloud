const { createClient } = require('@libsql/client');
require('dotenv').config();

async function debugDB() {
    const tursoUrl = process.env.TURSO_DB_URL;
    const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;

    if (!tursoUrl || !tursoToken) {
        console.error("Missing Turso environment variables");
        return;
    }

    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    try {
        const rs = await client.execute("SELECT brokerCreci, COUNT(*) as count FROM properties GROUP BY brokerCreci");
        console.log("Property Counts by CRECI:");
        console.table(rs.rows);
        
        const latest = await client.execute("SELECT id, title, brokerCreci, receivedAt FROM properties ORDER BY receivedAt DESC LIMIT 5");
        console.log("\nLatest 5 properties:");
        console.table(latest.rows);
    } catch (e) {
        console.error("Database error:", e.message);
    } finally {
        client.close();
    }
}

debugDB();
