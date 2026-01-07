const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('freight.db');

db.all('PRAGMA table_info(routes)', (err, rows) => {
  if (err) {
    console.error(err);
    process.exitCode = 1;
    db.close();
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
