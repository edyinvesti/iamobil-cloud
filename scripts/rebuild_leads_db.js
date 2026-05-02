const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'iamobil.db');
const db = new sqlite3.Database(dbPath);

console.log('Cleaning database:', dbPath);

db.serialize(() => {
  // 1. Create a clean table with only legitimate-looking leads (limit to 500 for safety)
  db.run(`
    CREATE TABLE leads_clean AS 
    SELECT * FROM leads 
    WHERE name NOT LIKE '%Stress%' 
      AND name NOT LIKE '%STRESS_%' 
      AND interest != 'MAX LOAD TEST' 
    LIMIT 500;
  `, (err) => {
    if (err) {
      console.error('Error creating clean table:', err);
      process.exit(1);
    }
    console.log('Clean table created with up to 500 rows.');

    // 2. Drop the old bloated table
    db.run("DROP TABLE leads;", (err) => {
      if (err) {
        console.error('Error dropping old table:', err);
        process.exit(1);
      }
      console.log('Bloated leads table dropped.');

      // 3. Rename the clean table
      db.run("ALTER TABLE leads_clean RENAME TO leads;", (err) => {
        if (err) {
          console.error('Error renaming table:', err);
          process.exit(1);
        }
        console.log('Database restored with clean leads table.');

        // 4. Vacuum to reclaim space
        console.log('Starting VACUUM (this may take a few seconds)...');
        db.run("VACUUM;", (err) => {
          if (err) {
            console.error('Error vacuuming:', err);
          } else {
            console.log('Database vacuumed successfully.');
          }
          db.close();
        });
      });
    });
  });
});
