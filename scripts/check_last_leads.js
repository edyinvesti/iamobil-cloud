const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'iamobil.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking last leads in:', dbPath);

db.all("SELECT * FROM leads ORDER BY id DESC LIMIT 10", (err, rows) => {
  if (err) {
    console.error('Error fetching leads:', err);
    process.exit(1);
  }
  
  console.log('Last 10 leads:');
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
