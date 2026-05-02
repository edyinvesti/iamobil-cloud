const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '..', 'iamobil.db');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT id, title, city, price, bedrooms FROM properties", (err, rows) => {
    if (err) {
      console.error("Erro ao ler banco:", err.message);
      return;
    }
    console.log("\n🏠 --- CONTEÚDO DO BANCO DE DADOS iAmobil --- 🏠");
    console.table(rows);
    console.log("------------------------------------------------\n");
    db.close();
  });
});
