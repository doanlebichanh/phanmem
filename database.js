const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const dbPath = path.join(__dirname, 'freight.db');
const db = new sqlite3.Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureColumn(table, column, columnDefSql) {
  const cols = await dbAll(`PRAGMA table_info(${table})`);
  const exists = cols.some(c => c.name === column);
  if (!exists) {
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDefSql}`);
  }
}

async function hasColumn(table, column) {
  const cols = await dbAll(`PRAGMA table_info(${table})`);
  return cols.some(c => c.name === column);
}

async function hasTable(table) {
  const row = await dbGet(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table]
  );
  return !!row;
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // Core tables (aligned with server.js)
        await dbRun(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          fullname TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'staff',
          status TEXT NOT NULL DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          tax_code TEXT,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          customer_type TEXT DEFAULT 'individual',
          credit_limit REAL DEFAULT 0,
          payment_terms TEXT DEFAULT 'COD',
          status TEXT DEFAULT 'active',
          current_debt REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS drivers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT,
          license_number TEXT,
          id_number TEXT,
          address TEXT,
          notes TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure backward-compatible columns for drivers
        await ensureColumn('drivers', 'license_expiry', 'DATE');
        await ensureColumn('drivers', 'birth_date', 'DATE');
        await ensureColumn('drivers', 'id_card_image', 'TEXT');
        await ensureColumn('drivers', 'license_image', 'TEXT');
        await ensureColumn('drivers', 'license_type', 'TEXT');
        await ensureColumn('drivers', 'hire_date', 'DATE');
        await ensureColumn('drivers', 'base_salary', 'REAL');

        await dbRun(`CREATE TABLE IF NOT EXISTS containers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          container_number TEXT UNIQUE NOT NULL,
          status TEXT DEFAULT 'available',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          route_name TEXT,
          origin TEXT,
          destination TEXT,
          distance_km REAL,
          estimated_hours REAL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure backward-compatible columns for existing DBs
        await ensureColumn('routes', 'route_name', 'TEXT');
        await ensureColumn('routes', 'notes', 'TEXT');
        // Best-effort backfill for legacy routes
        await dbRun(`
          UPDATE routes
          SET route_name = TRIM(COALESCE(origin, '') || ' - ' || COALESCE(destination, ''))
          WHERE (route_name IS NULL OR route_name = '')
            AND (origin IS NOT NULL OR destination IS NOT NULL)
        `);

        await dbRun(`CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plate_number TEXT,
          vehicle_type TEXT,
          brand TEXT,
          model TEXT,
          year INTEGER,
          engine_power REAL,
          fuel_consumption_empty REAL,
          fuel_consumption_loaded REAL,
          capacity REAL,
          status TEXT DEFAULT 'available',
          registration_expiry DATE,
          insurance_expiry DATE,
          inspection_expiry DATE,
          vin_number TEXT,
          engine_number TEXT,
          color TEXT,
          ownership TEXT,
          purchase_price REAL,
          purchase_date DATE,
          current_odometer REAL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure backward-compatible columns for existing DBs
        await ensureColumn('vehicles', 'brand', 'TEXT');
        await ensureColumn('vehicles', 'model', 'TEXT');
        await ensureColumn('vehicles', 'year', 'INTEGER');
        await ensureColumn('vehicles', 'engine_power', 'REAL');
        await ensureColumn('vehicles', 'fuel_consumption_empty', 'REAL');
        await ensureColumn('vehicles', 'fuel_consumption_loaded', 'REAL');
        await ensureColumn('vehicles', 'registration_expiry', 'DATE');
        await ensureColumn('vehicles', 'vin_number', 'TEXT');
        await ensureColumn('vehicles', 'engine_number', 'TEXT');
        await ensureColumn('vehicles', 'color', 'TEXT');
        await ensureColumn('vehicles', 'ownership', 'TEXT');
        await ensureColumn('vehicles', 'purchase_price', 'REAL');
        await ensureColumn('vehicles', 'purchase_date', 'DATE');
        await ensureColumn('vehicles', 'current_odometer', 'REAL');
        await ensureColumn('vehicles', 'notes', 'TEXT');

        // Best-effort backfill: inspection_expiry (legacy) -> registration_expiry (used by alerts/fees)
        if (await hasColumn('vehicles', 'inspection_expiry')) {
          await dbRun(`
            UPDATE vehicles
            SET registration_expiry = inspection_expiry
            WHERE (registration_expiry IS NULL OR registration_expiry = '')
              AND inspection_expiry IS NOT NULL
              AND inspection_expiry <> ''
          `);
        }

        await dbRun(`CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_code TEXT UNIQUE,
          customer_id INTEGER,
          route_id INTEGER,
          container_id INTEGER,
          vehicle_id INTEGER,
          driver_id INTEGER,
          order_date DATE,
          pickup_date DATE,
          delivery_date DATE,
          pickup_location TEXT,
          intermediate_point TEXT,
          delivery_location TEXT,
          cargo_description TEXT,
          quantity REAL,
          weight REAL,
          price REAL,
          neo_xe REAL DEFAULT 0,
          chi_ho REAL DEFAULT 0,
          final_amount REAL,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          booking_number TEXT,
          bill_of_lading TEXT,
          seal_number TEXT,
          cargo_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS trip_costs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          cost_type TEXT,
          amount REAL NOT NULL,
          fuel_liters REAL,
          fuel_price_per_liter REAL,
          distance_km REAL,
          receipt_number TEXT,
          invoice_file TEXT,
          invoice_file_data TEXT,
          cost_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        // Keep legacy shipments, but also support the newer payments schema
        await dbRun(`CREATE TABLE IF NOT EXISTS shipments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shipment_code TEXT UNIQUE,
          customer_id INTEGER NOT NULL,
          driver_id INTEGER,
          container_id INTEGER NOT NULL,
          shipment_date DATE NOT NULL,
          origin TEXT NOT NULL,
          destination TEXT NOT NULL,
          cargo_description TEXT,
          quantity REAL,
          unit_price REAL,
          total_charge REAL NOT NULL,
          extra_charges REAL DEFAULT 0,
          discount REAL DEFAULT 0,
          final_amount REAL,
          status TEXT DEFAULT 'pending',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shipment_id INTEGER,
          order_id INTEGER,
          customer_id INTEGER,
          payment_date DATE,
          amount REAL NOT NULL,
          payment_method TEXT,
          reference_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS driver_advances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          driver_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          advance_date DATE,
          purpose TEXT,
          settled INTEGER DEFAULT 0,
          settlement_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          filename TEXT,
          file_url TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS driver_salaries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER NOT NULL,
          salary_month TEXT NOT NULL,
          base_salary REAL DEFAULT 0,
          trip_count INTEGER DEFAULT 0,
          trip_bonus REAL DEFAULT 0,
          overtime_hours REAL DEFAULT 0,
          overtime_pay REAL DEFAULT 0,
          deductions REAL DEFAULT 0,
          advances_deducted REAL DEFAULT 0,
          total_salary REAL DEFAULT 0,
          notes TEXT,
          status TEXT DEFAULT 'draft',
          paid_date DATE,
          payment_method TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        // Bonuses / penalties (aligned with server.js)
        await dbRun(`CREATE TABLE IF NOT EXISTS driver_bonuses_penalties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER NOT NULL,
          date DATE NOT NULL,
          type TEXT NOT NULL,
          reason TEXT,
          amount REAL NOT NULL,
          order_id INTEGER,
          approved_by INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        // Legacy table (kept for older installs). If it exists, we can migrate data forward.
        await dbRun(`CREATE TABLE IF NOT EXISTS bonuses_penalties (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id INTEGER,
          type TEXT,
          amount REAL NOT NULL,
          reason TEXT,
          bonus_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS cash_flow (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_date DATE,
          type TEXT,
          category TEXT,
          description TEXT,
          amount REAL NOT NULL,
          payment_method TEXT,
          reference_number TEXT,
          order_id INTEGER,
          driver_id INTEGER,
          vehicle_id INTEGER,
          notes TEXT,
          transaction_group TEXT,
          category_details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS fuel_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER,
          fuel_date DATE,
          fuel_type TEXT,
          liters REAL,
          price_per_liter REAL,
          total_cost REAL,
          odometer_reading INTEGER,
          station_name TEXT,
          receipt_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS vehicle_maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER,
          maintenance_date DATE,
          maintenance_type TEXT,
          odometer_reading INTEGER,
          cost REAL,
          next_due_odometer INTEGER,
          garage TEXT,
          invoice_number TEXT,
          description TEXT,
          next_due_date DATE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS vehicle_fees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER,
          fee_type TEXT,
          amount REAL,
          paid_date DATE,
          valid_from DATE,
          valid_to DATE,
          receipt_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_number TEXT UNIQUE,
          customer_id INTEGER,
          quote_date DATE,
          valid_until DATE,
          route_from TEXT,
          route_to TEXT,
          container_type TEXT,
          cargo_description TEXT,
          quantity REAL DEFAULT 1,
          unit_price REAL,
          total_amount REAL,
          discount_amount REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          final_amount REAL,
          status TEXT DEFAULT 'draft',
          converted_order_id INTEGER,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT,
          entity TEXT,
          entity_id TEXT,
          old_value TEXT,
          new_value TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure critical columns exist for older DBs
        await ensureColumn('users', 'status', "TEXT NOT NULL DEFAULT 'active'");
        await ensureColumn('customers', 'contact_person', 'TEXT');
        await ensureColumn('customers', 'customer_type', "TEXT DEFAULT 'individual'");
        await ensureColumn('customers', 'credit_limit', 'REAL DEFAULT 0');
        await ensureColumn('customers', 'payment_terms', "TEXT DEFAULT 'COD'");
        await ensureColumn('customers', 'status', "TEXT DEFAULT 'active'");
        await ensureColumn('customers', 'current_debt', 'REAL DEFAULT 0');
        await ensureColumn('payments', 'order_id', 'INTEGER');
        await ensureColumn('payments', 'customer_id', 'INTEGER');
        await ensureColumn('payments', 'payment_date', 'DATE');

        // Orders VAT/debt fields (for consistent VAT reporting)
        await ensureColumn('orders', 'subtotal_amount', 'REAL');
        await ensureColumn('orders', 'vat_rate', 'REAL DEFAULT 0.1');
        await ensureColumn('orders', 'vat_amount', 'REAL');

        // Cash flow + operational tables for consolidated reports
        await ensureColumn('cash_flow', 'type', 'TEXT');

        // Backward-compat: older DBs used cash_flow.transaction_type
        if (await hasColumn('cash_flow', 'transaction_type')) {
          await dbRun(`
            UPDATE cash_flow
            SET type = COALESCE(NULLIF(type, ''), transaction_type)
            WHERE (type IS NULL OR type = '') AND transaction_type IS NOT NULL
          `);
        }

        await ensureColumn('driver_salaries', 'paid_date', 'DATE');
        await ensureColumn('driver_salaries', 'payment_method', 'TEXT');
        await ensureColumn('driver_advances', 'settlement_date', 'DATE');
        await ensureColumn('driver_advances', 'salary_id', 'INTEGER');
        await ensureColumn('fuel_records', 'fuel_type', 'TEXT');
        await ensureColumn('fuel_records', 'odometer_reading', 'INTEGER');

        // Vehicle maintenance: align with /api/maintenance fields
        await ensureColumn('vehicle_maintenance', 'odometer_reading', 'INTEGER');
        await ensureColumn('vehicle_maintenance', 'next_due_odometer', 'INTEGER');
        await ensureColumn('vehicle_maintenance', 'garage', 'TEXT');
        await ensureColumn('vehicle_maintenance', 'invoice_number', 'TEXT');
        await ensureColumn('vehicle_maintenance', 'notes', 'TEXT');
        await ensureColumn('vehicle_maintenance', 'created_by', 'INTEGER');
        await ensureColumn('fuel_records', 'station_name', 'TEXT');
        await ensureColumn('fuel_records', 'receipt_number', 'TEXT');
        await ensureColumn('vehicle_fees', 'paid_date', 'DATE');
        await ensureColumn('vehicle_fees', 'valid_from', 'DATE');
        await ensureColumn('vehicle_fees', 'valid_to', 'DATE');
        await ensureColumn('vehicle_fees', 'receipt_number', 'TEXT');

        // Bonuses / penalties compatibility
        await ensureColumn('driver_bonuses_penalties', 'order_id', 'INTEGER');
        await ensureColumn('driver_bonuses_penalties', 'approved_by', 'INTEGER');
        await ensureColumn('driver_bonuses_penalties', 'notes', 'TEXT');

        // One-way migrate legacy bonuses_penalties -> driver_bonuses_penalties when possible
        if (await hasTable('bonuses_penalties')) {
          const legacyHasDate = await hasColumn('bonuses_penalties', 'bonus_date');
          const legacyHasDriver = await hasColumn('bonuses_penalties', 'driver_id');
          const legacyHasType = await hasColumn('bonuses_penalties', 'type');
          const legacyHasReason = await hasColumn('bonuses_penalties', 'reason');
          const legacyHasAmount = await hasColumn('bonuses_penalties', 'amount');

          if (legacyHasDate && legacyHasDriver && legacyHasType && legacyHasAmount) {
            await dbRun(`
              INSERT INTO driver_bonuses_penalties (driver_id, date, type, reason, amount, created_at, created_by)
              SELECT 
                driver_id,
                bonus_date as date,
                type,
                ${legacyHasReason ? 'reason' : 'NULL'} as reason,
                amount,
                created_at,
                created_by
              FROM bonuses_penalties
              WHERE bonus_date IS NOT NULL
                AND amount IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM driver_bonuses_penalties dp
                  WHERE dp.driver_id = bonuses_penalties.driver_id
                    AND dp.date = bonuses_penalties.bonus_date
                    AND dp.type = bonuses_penalties.type
                    AND dp.amount = bonuses_penalties.amount
                )
            `);
          }
        }

        // Cash-basis migration: move existing orders.chi_ho / neo_xe into trip_costs (best-effort)
        // This allows cash-flow consolidated to rely on trip_costs with explicit cost_date.
        try {
          const hasOrders = await hasTable('orders');
          const hasTripCosts = await hasTable('trip_costs');
          if (hasOrders && hasTripCosts) {
            // Chi hộ
            await dbRun(`
              INSERT INTO trip_costs (order_id, cost_type, amount, cost_date, notes, created_at)
              SELECT
                o.id,
                'Chi hộ',
                o.chi_ho,
                COALESCE(o.delivery_date, o.order_date, date('now')),
                'Migrated from orders.chi_ho',
                CURRENT_TIMESTAMP
              FROM orders o
              WHERE COALESCE(o.chi_ho, 0) > 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM trip_costs tc
                  WHERE tc.order_id = o.id
                    AND tc.cost_type = 'Chi hộ'
                    AND tc.amount = o.chi_ho
                )
            `);

            // Nẹo xe
            await dbRun(`
              INSERT INTO trip_costs (order_id, cost_type, amount, cost_date, notes, created_at)
              SELECT
                o.id,
                'Nẹo xe',
                o.neo_xe,
                COALESCE(o.delivery_date, o.order_date, date('now')),
                'Migrated from orders.neo_xe',
                CURRENT_TIMESTAMP
              FROM orders o
              WHERE COALESCE(o.neo_xe, 0) > 0
                AND NOT EXISTS (
                  SELECT 1
                  FROM trip_costs tc
                  WHERE tc.order_id = o.id
                    AND tc.cost_type = 'Nẹo xe'
                    AND tc.amount = o.neo_xe
                )
            `);
          }
        } catch (e) {
          // Best-effort migration: ignore if schema differs in older DBs
        }

        // Seed admin
        const adminRow = await dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
        if (!adminRow) {
          const hashedPassword = bcrypt.hashSync('admin123', 10);
          await dbRun(
            'INSERT INTO users (username, password, fullname, role, status) VALUES (?, ?, ?, ?, ?)',
            ['admin', hashedPassword, 'Quản trị viên', 'admin', 'active']
          );
          console.log('✓ Đã tạo tài khoản admin: admin/admin123');
        }

        initContainers(resolve, reject);
      } catch (err) {
        reject(err);
      }
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