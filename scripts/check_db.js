const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'iamobil.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database:', dbPath);

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err);
      process.exit(1);
    }
    
    console.log('Tables:', tables.map(t => t.name).join(', '));
    
    tables.forEach(table => {
      db.get(`SELECT COUNT(*) as count FROM ${table.name}`, (err, row) => {
        if (err) {
          console.error(`Error counting rows in ${table.name}:`, err);
        } else {
          console.log(`Table ${table.name}: ${row.count} rows`);
        }
      });
    });
  });
});
