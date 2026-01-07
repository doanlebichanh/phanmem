const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const dbPath = path.join(__dirname, 'freight.db');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, fullname TEXT NOT NULL, role TEXT NOT NULL DEFAULT \'staff\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, tax_code TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by INTEGER)');
      db.run('CREATE TABLE IF NOT EXISTS drivers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, license_number TEXT, id_number TEXT, address TEXT, notes TEXT, status TEXT DEFAULT \'active\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS containers (id INTEGER PRIMARY KEY AUTOINCREMENT, container_number TEXT UNIQUE NOT NULL, status TEXT DEFAULT \'available\', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
      db.run('CREATE TABLE IF NOT EXISTS shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, shipment_code TEXT UNIQUE, customer_id INTEGER NOT NULL, driver_id INTEGER, container_id INTEGER NOT NULL, shipment_date DATE NOT NULL, origin TEXT NOT NULL, destination TEXT NOT NULL, cargo_description TEXT, quantity REAL, unit_price REAL, total_charge REAL NOT NULL, extra_charges REAL DEFAULT 0, discount REAL DEFAULT 0, final_amount REAL, status TEXT DEFAULT \'pending\', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by INTEGER)');
      db.run('CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, shipment_id INTEGER NOT NULL, payment_date DATE NOT NULL, amount REAL NOT NULL, payment_method TEXT, reference_number TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_by INTEGER)', (err) => {
        if (err) return reject(err);
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
          if (err) return reject(err);
          if (!row) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)', ['admin', hashedPassword, 'Quản trị viên', 'admin'], (err) => {
              if (err) return reject(err);
              console.log('✓ Đã tạo tài khoản admin: admin/admin123');
              initContainers(resolve, reject);
            });
          } else {
            initContainers(resolve, reject);
          }
        });
      });
    });
  });
}

function initContainers(resolve, reject) {
  const containers = ['50E21256', '50E33148', '50E40752', '50E53027', '50E53401', '50H11147', '50H51109', '50H68598', '51D44553', '50E33681', '50H11701', '50H43593'];
  db.get('SELECT COUNT(*) as count FROM containers', [], (err, row) => {
    if (err) return reject(err);
    if (row.count === 0) {
      const stmt = db.prepare('INSERT INTO containers (container_number) VALUES (?)');
      containers.forEach(num => stmt.run(num));
      stmt.finalize((err) => {
        if (err) return reject(err);
        console.log(`✓ Đã thêm ${containers.length} xe container`);
        console.log('✓ Database đã được khởi tạo thành công');
        resolve();
      });
    } else {
      console.log('✓ Database đã được khởi tạo thành công');
      resolve();
    }
  });
}

module.exports = { db, initDatabase };