const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Xác định đường dẫn database
let dbPath;
try {
  // Nếu chạy trong Electron, dùng app.getPath('userData')
  const { app } = require('electron');
  const userDataPath = app.getPath('userData');
  
  // Tạo thư mục nếu chưa tồn tại
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  dbPath = path.join(userDataPath, 'freight.db');
  console.log('📁 Database path:', dbPath);
} catch (err) {
  // Nếu không phải Electron (chạy standalone server), dùng thư mục hiện tại
  dbPath = path.join(__dirname, 'freight.db');
  console.log('📁 Database path (standalone):', dbPath);
}

const db = new sqlite3.Database(dbPath);

db.run('PRAGMA foreign_keys = ON');

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Bảng users - người dùng hệ thống
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullname TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bảng drivers - tài xế
      db.run(`CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        license_number TEXT,
        license_expiry DATE,
        id_number TEXT,
        address TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bảng vehicles - xe đầu kéo
      db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT UNIQUE NOT NULL,
        vehicle_type TEXT,
        brand TEXT,
        model TEXT,
        year INTEGER,
        engine_power INTEGER,
        fuel_consumption_empty REAL,
        fuel_consumption_loaded REAL,
        capacity REAL,
        status TEXT DEFAULT 'available',
        registration_expiry DATE,
        insurance_expiry DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bảng containers - rơ moóc
      db.run(`CREATE TABLE IF NOT EXISTS containers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_number TEXT UNIQUE NOT NULL,
        container_type TEXT DEFAULT '20ft',
        status TEXT DEFAULT 'available',
        current_location TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bảng routes - tuyến đường
      db.run(`CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_name TEXT NOT NULL,
        origin TEXT NOT NULL,
        destination TEXT NOT NULL,
        distance_km REAL,
        estimated_hours REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Bảng pricing - giá cước theo tuyến
      db.run(`CREATE TABLE IF NOT EXISTS pricing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER,
        customer_id INTEGER,
        container_type TEXT,
        price REAL NOT NULL,
        effective_from DATE,
        effective_to DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`);

      // Bảng orders - đơn hàng
      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL,
        route_id INTEGER,
        container_id INTEGER,
        vehicle_id INTEGER,
        driver_id INTEGER,
        order_date DATE NOT NULL,
        pickup_date DATE,
        delivery_date DATE,
        pickup_location TEXT,
        intermediate_point TEXT,
        delivery_location TEXT,
        cargo_description TEXT,
        quantity REAL,
        weight REAL,
        price REAL NOT NULL,
        neo_xe REAL DEFAULT 0,
        chi_ho REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        pod_uploaded INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (route_id) REFERENCES routes(id),
        FOREIGN KEY (container_id) REFERENCES containers(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
      )`);

      // Bảng trip_costs - chi phí chuyến xe
      db.run(`CREATE TABLE IF NOT EXISTS trip_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        cost_type TEXT NOT NULL,
        amount REAL NOT NULL,
        fuel_liters REAL,
        fuel_price_per_liter REAL,
        distance_km REAL,
        receipt_number TEXT,
        invoice_file TEXT,
        cost_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`);

      // Bảng payments - thanh toán từ khách hàng
      db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        payment_date DATE NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        reference_number TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )`);

      // Bảng driver_advances - tạm ứng cho tài xế
      db.run(`CREATE TABLE IF NOT EXISTS driver_advances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        driver_id INTEGER NOT NULL,
        advance_date DATE NOT NULL,
        amount REAL NOT NULL,
        settlement_date DATE,
        settled INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
      )`);

      // Bảng documents - chứng từ
      db.run(`CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        document_type TEXT NOT NULL,
        file_name TEXT,
        file_path TEXT,
        file_url TEXT,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id)
      )`);

      // Bảng audit_logs - ghi log
      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`);

      // ===== PHASE 1: SALARY MANAGEMENT =====
      
      // Bảng driver_salaries - lương tài xế
      db.run(`CREATE TABLE IF NOT EXISTS driver_salaries (
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
        paid_date DATE,
        payment_method TEXT,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (driver_id) REFERENCES drivers(id),
        UNIQUE(driver_id, salary_month)
      )`);

      // Bảng driver_bonuses_penalties - thưởng/phạt tài xế
      db.run(`CREATE TABLE IF NOT EXISTS driver_bonuses_penalties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        date DATE NOT NULL,
        type TEXT NOT NULL,
        reason TEXT NOT NULL,
        amount REAL NOT NULL,
        order_id INTEGER,
        approved_by INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (driver_id) REFERENCES drivers(id),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )`);

      // ===== PHASE 1: VEHICLE MAINTENANCE =====
      
      // Bảng vehicle_maintenance - bảo dưỡng xe
      db.run(`CREATE TABLE IF NOT EXISTS vehicle_maintenance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        maintenance_type TEXT NOT NULL,
        maintenance_date DATE NOT NULL,
        odometer_reading INTEGER,
        cost REAL NOT NULL,
        next_due_date DATE,
        next_due_odometer INTEGER,
        garage TEXT,
        invoice_number TEXT,
        description TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )`);

      // Bảng vehicle_fees - phí xe (đăng kiểm, bảo hiểm, thuế)
      db.run(`CREATE TABLE IF NOT EXISTS vehicle_fees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        fee_type TEXT NOT NULL,
        amount REAL NOT NULL,
        paid_date DATE NOT NULL,
        valid_from DATE,
        valid_to DATE,
        receipt_number TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          return reject(err);
        }
        
        // ===== PHASE 2 & 3: ADVANCED FEATURES =====
        
        // Bảng fuel_records - quản lý nhiên liệu
        db.run(`CREATE TABLE IF NOT EXISTS fuel_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          fuel_date DATE NOT NULL,
          fuel_type TEXT NOT NULL,
          liters REAL NOT NULL,
          price_per_liter REAL NOT NULL,
          total_cost REAL NOT NULL,
          odometer_reading INTEGER,
          station_name TEXT,
          receipt_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Bảng cash_flow - dòng tiền
        db.run(`CREATE TABLE IF NOT EXISTS cash_flow (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_date DATE NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          order_id INTEGER,
          driver_id INTEGER,
          vehicle_id INTEGER,
          payment_method TEXT,
          reference_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (order_id) REFERENCES orders(id),
          FOREIGN KEY (driver_id) REFERENCES drivers(id),
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Bảng customers - quản lý khách hàng (Phase 3)
        db.run(`CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT NOT NULL,
          tax_code TEXT,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          customer_type TEXT DEFAULT 'individual',
          credit_limit REAL DEFAULT 0,
          payment_terms TEXT,
          notes TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Bảng quotes - báo giá (Phase 3)
        db.run(`CREATE TABLE IF NOT EXISTS quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_number TEXT UNIQUE NOT NULL,
          customer_id INTEGER NOT NULL,
          quote_date DATE NOT NULL,
          valid_until DATE,
          route_from TEXT NOT NULL,
          route_to TEXT NOT NULL,
          container_type TEXT,
          cargo_description TEXT,
          quantity INTEGER DEFAULT 1,
          unit_price REAL NOT NULL,
          total_amount REAL NOT NULL,
          discount_amount REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          final_amount REAL NOT NULL,
          status TEXT DEFAULT 'draft',
          notes TEXT,
          converted_order_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (converted_order_id) REFERENCES orders(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Bảng notifications - thông báo (Phase 3)
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          link TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Bảng gps_locations - GPS tracking (Phase 3 - Optional)
        db.run(`CREATE TABLE IF NOT EXISTS gps_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          speed REAL,
          heading REAL,
          altitude REAL,
          accuracy REAL,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_locations(vehicle_id, timestamp DESC)`);
        
        // Kiểm tra và tạo tài khoản admin
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
          if (err) return reject(err);
          
          if (!row) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(
              'INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)',
              ['admin', hashedPassword, 'Quản trị viên', 'admin'],
              (err) => {
                if (err) return reject(err);
                console.log('✓ Đã tạo tài khoản admin: admin/admin123');
                initContainers(resolve, reject);
              }
            );
          } else {
            initContainers(resolve, reject);
          }
        });
      });
    });
  });
}

function initContainers(resolve, reject) {
  const containers = [
    '50E21256', '50E33148', '50E40752', '50E53027',
    '50E53401', '50H11147', '50H51109', '50H68598',
    '51D44553', '50E33681', '50H11701', '50H43593'
  ];

  db.get('SELECT COUNT(*) as count FROM containers', [], (err, row) => {
    if (err) return reject(err);
    
    if (row.count === 0) {
      const stmt = db.prepare('INSERT INTO containers (container_number, container_type) VALUES (?, ?)');
      containers.forEach(num => {
        stmt.run(num, '40ft');
      });
      stmt.finalize((err) => {
        if (err) return reject(err);
        console.log(`✓ Đã thêm ${containers.length} xe container`);
        console.log('✓ Database đã được khởi tạo thành công!');
        resolve();
      });
    } else {
      console.log('✓ Database đã được khởi tạo thành công!');
      resolve();
    }
  });
}

module.exports = { db, initDatabase };
