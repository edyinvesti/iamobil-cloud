const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'iamobil.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking non-stress leads in:', dbPath);

db.get("SELECT COUNT(*) as count FROM leads WHERE name NOT LIKE 'STRESS_%' AND name NOT LIKE 'Stress Lead %' AND interest != 'MAX LOAD TEST'", (err, row) => {
  if (err) {
    console.error('Error counting leads:', err);
    process.exit(1);
  }
  
  console.log(`Non-stress leads count: ${row.count}`);
  db.close();
});
