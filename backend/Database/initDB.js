const db = require('./db');
const fs = require('fs');
const path = require('path');

const initDB = () => {
  const schemasDir = path.join(__dirname, 'schemas');
  const schemaFiles = fs.readdirSync(schemasDir).filter(f => f.endsWith('.sql'));
  
  schemaFiles.forEach(file => {
    const schema = fs.readFileSync(path.join(schemasDir, file), 'utf8');
    db.query(schema, (err) => {
      if (err) {
        console.log(`❌ Error creating table from ${file}:`, err);
        return;
      }
      console.log(`✅ Table created from ${file}`);
    });
  });
};

initDB();