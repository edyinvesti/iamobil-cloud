const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const catalogPath = path.join(__dirname, '..', 'CATALOG.md');
const dbPath = path.join(__dirname, '..', 'iamobil.db');

async function sync() {
  console.log('🔄 [Sync] Iniciando sincronização do catálogo com o banco de dados...');
  
  if (!fs.existsSync(catalogPath)) {
    console.error('❌ Catalogo não encontrado!');
    return;
  }

  const content = fs.readFileSync(catalogPath, 'utf8');
  const sections = content.split('---').slice(1); // Pular cabeçalho
  const properties = [];

  for (const sect of sections) {
    const titleMatch = sect.match(/## (.*)/);
    const locMatch = sect.match(/📍 Localização:\*\* (.*)/);
    const valMatch = sect.match(/💰 Valor:\*\* R\$ ([\d\.]+)/);
    const areaMatch = sect.match(/📐 Área:\*\* (\d+)/);
    const quartoMatch = sect.match(/🛏️ Quartos:\*\* (\d+)/);
    const descMatch = sect.match(/✨ Diferencial:\*\* (.*)/);
    const imgMatch = sect.match(/🖼️ Imagem:\*\* (.*)/);

    if (titleMatch) {
      const priceStr = (valMatch ? valMatch[1] : '0').replace(/\./g, '');
      const location = locMatch ? locMatch[1] : '';
      const city = location.split(',')[0].trim();

      properties.push({
        title: titleMatch[1].trim(),
        location: location.trim(),
        city: city,
        price: parseInt(priceStr, 10),
        area: parseInt(areaMatch ? areaMatch[1] : '0', 10),
        bedrooms: parseInt(quartoMatch ? quartoMatch[1] : '0', 10),
        description: descMatch ? descMatch[1].trim() : '',
        image: imgMatch ? imgMatch[1].trim() : ''
      });
    }
  }

  const db = new sqlite3.Database(dbPath);
  
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      location TEXT,
      city TEXT,
      price INTEGER,
      area INTEGER,
      bedrooms INTEGER,
      description TEXT,
      image TEXT
    )`);

    // Limpar tabela antes de re-sincronizar
    db.run(`DELETE FROM properties`, () => {
      const stmt = db.prepare(`INSERT INTO properties (title, location, city, price, area, bedrooms, description, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of properties) {
        stmt.run(p.title, p.location, p.city, p.price, p.area, p.bedrooms, p.description, p.image);
      }
      stmt.finalize();
      console.log(`✅ [Sync] ${properties.length} imóveis sincronizados com sucesso.`);
      db.close();
    });
  });
}

sync();
