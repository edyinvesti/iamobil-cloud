const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'iamobil.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking non-stress leads sample in:', dbPath);

db.all("SELECT * FROM leads WHERE name NOT LIKE 'STRESS_%' AND name NOT LIKE 'Stress Lead %' AND interest != 'MAX LOAD TEST' LIMIT 20", (err, rows) => {
  if (err) {
    console.error('Error fetching leads:', err);
    process.exit(1);
  }
  
  console.log('Non-stress leads sample:');
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
