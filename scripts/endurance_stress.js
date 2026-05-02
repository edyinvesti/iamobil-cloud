const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log("=== STARTING 5-HOUR ENDURANCE STRESS TEST ===");

// We target the main database directly to see if the whole system can handle it
const DB_PATH = path.join(__dirname, '..', 'data', 'iamobil.db');
if (!fs.existsSync(DB_PATH)) {
    console.error("Database not found! Creating dummy iamobil.db for stress test...");
    // Just let sqlite create it
}

// Ensure WAL is activated permanently for this file
const setupDb = new sqlite3.Database(DB_PATH);
setupDb.run("PRAGMA journal_mode = WAL;", () => {
    setupDb.run("PRAGMA synchronous = NORMAL;", () => {
        console.log("✅ Database WAL & Synchronous modes optimized for endurance.");
        setupDb.close(() => {
            runStressLoop();
        });
    });
});

const startTime = Date.now();
const ENDURANCE_TIME_MS = 5 * 60 * 60 * 1000; // 5 hours

let totalSuccess = 0;
let totalErrors = 0;

function generateRandomLead() {
    return [
         `Stress Lead ${Math.floor(Math.random() * 100000)}`,
         `+551199${Math.floor(1000000 + Math.random() * 9000000)}`,
         'Interesse em endurance testing',
         'Notas geradas por stress script ' + Date.now(),
         Math.floor(Math.random() * 100),
         'Frio',
         new Date().toLocaleString("pt-BR"),
         Math.floor(Math.random() * 5000000),
         null,
         new Date().toLocaleString("pt-BR")
    ];
}

async function runStressLoop() {
    const db = new sqlite3.Database(DB_PATH);
    
    // Safety check table
    await new Promise(r => {
        db.run(`CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, interest TEXT,
            notes TEXT, score INTEGER, status TEXT DEFAULT 'Frio', date TEXT,
            potential_value INTEGER DEFAULT 0, property_id INTEGER, last_contacted TEXT
        )`, r);
    });

    console.log(`🚀 Endless endurance loop started. Will terminate in 5 hours.`);
    
    let isRunning = true;
    
    // Auto-terminate rule
    setTimeout(() => {
        isRunning = false;
        console.log(`\n\n🛑 ENDURANCE TEST COMPLETE 🛑`);
        console.log(`Total Uptime: 5 Hours`);
        console.log(`Total Success Inserts: ${totalSuccess}`);
        console.log(`Total Collision Errors: ${totalErrors}`);
        db.close();
        process.exit(0);
    }, ENDURANCE_TIME_MS);

    // Logging heartbeat
    setInterval(() => {
        const uptime = Math.round((Date.now() - startTime) / 1000 / 60);
        console.log(`[Uptime: ${uptime}m] Success: ${totalSuccess} | Errors: ${totalErrors}`);
    }, 60000); // once a minute
    
    // Keep inserting loop
    const cycle = () => {
        if (!isRunning) return;
        
        // Emulate a burst of 50 concurrent leads every half second
        const promises = [];
        for (let i = 0; i < 50; i++) {
             promises.push(new Promise((resolve) => {
                 db.run(
                     `INSERT INTO leads (name, phone, interest, notes, score, status, date, potential_value, property_id, last_contacted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                     generateRandomLead(),
                     function(err) {
                          if (err) totalErrors++;
                          else totalSuccess++;
                          resolve();
                     }
                 );
             }));
        }
        
        Promise.all(promises).then(() => {
            setTimeout(cycle, Math.random() * 500); // wait 0 to 500ms and burst again
        });
    };
    
    cycle();
}
