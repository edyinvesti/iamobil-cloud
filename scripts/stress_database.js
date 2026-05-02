const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'stress_test.db');

// Ensure data dir exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH); // Start fresh
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err);
        process.exit(1);
    }
});

async function runTest(useWal, iterations) {
    // Set journal mode
    if (useWal) {
        await new Promise(r => db.run('PRAGMA journal_mode = WAL;', r));
    } else {
        await new Promise(r => db.run('PRAGMA journal_mode = DELETE;', r));
    }

    await new Promise((resolve, reject) => {
        db.run('CREATE TABLE IF NOT EXISTS stress_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    console.log(`\nstarting Test (WAL Mode: ${useWal}) with ${iterations} concurrent inserts...`);

    let successes = 0;
    let errors = 0;
    
    const startTime = Date.now();

    const insertPromises = [];
    for (let i = 0; i < iterations; i++) {
        insertPromises.push(new Promise((resolve) => {
            db.run('INSERT INTO stress_logs (message) VALUES (?)', [`stress_test_msg_${i}`], function(err) {
                if (err) {
                    if (err.code === 'SQLITE_BUSY') {
                         errors++;
                    } else {
                         console.error(err);
                         errors++;
                    }
                } else {
                    successes++;
                }
                resolve();
            });
        }));
    }

    await Promise.all(insertPromises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`--- Results ---`);
    console.log(`Duration: ${duration} ms`);
    console.log(`Successes: ${successes}`);
    console.log(`Errors (SQLITE_BUSY locks): ${errors}`);
    console.log(`Throughput: ${Math.round((successes + errors) / (duration / 1000))} ops/sec`);
    
    // Clear table for next test
    await new Promise(r => db.run('DELETE FROM stress_logs', r));
}

async function main() {
    console.log("=== SQLite Database Stress Test ===");
    console.log("Database file: ", DB_PATH);
    const ITERATIONS = 500;
    // First run with standard journal mode
    await runTest(false, ITERATIONS);
    
    console.log("\n----------------------------------------");
    
    // Then run with WAL
    await runTest(true, ITERATIONS);
    
    db.close();
}

main().catch(console.error);
