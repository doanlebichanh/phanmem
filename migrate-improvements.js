const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'freight.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Bắt đầu migration: Thêm các trường cải tiến...\n');

db.serialize(() => {
  // ========== ORDERS: Thêm Booking, B/L, Seal ==========
  const orderFields = [
    'booking_number TEXT',
    'bill_of_lading TEXT',
    'seal_number TEXT',
    'cargo_type TEXT'
  ];
  
  orderFields.forEach(field => {
    const fieldName = field.split(' ')[0];
    db.run(`ALTER TABLE orders ADD COLUMN ${field}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error(`❌ Lỗi thêm ${fieldName}:`, err.message);
      } else if (!err) {
        console.log(`✅ Đã thêm trường ${fieldName} vào orders`);
      }
    });
  });

  // ========== DRIVERS: Thêm các trường mới ==========
  const driverFields = [
    'birth_date DATE',
    'id_card_image TEXT',
    'license_image TEXT',
    'license_type TEXT',
    'hire_date DATE',
    'base_salary REAL DEFAULT 0'
  ];
  
  driverFields.forEach(field => {
    const fieldName = field.split(' ')[0];
    db.run(`ALTER TABLE drivers ADD COLUMN ${field}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error(`❌ Lỗi thêm ${fieldName}:`, err.message);
      } else if (!err) {
        console.log(`✅ Đã thêm trường ${fieldName} vào drivers`);
      }
    });
  });

  // ========== VEHICLES: Thêm các trường mới ==========
  const vehicleFields = [
    'vin_number TEXT',
    'engine_number TEXT',
    'color TEXT',
    'ownership TEXT',
    'purchase_price REAL',
    'purchase_date DATE',
    'current_odometer INTEGER DEFAULT 0'
  ];
  
  vehicleFields.forEach(field => {
    const fieldName = field.split(' ')[0];
    db.run(`ALTER TABLE vehicles ADD COLUMN ${field}`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error(`❌ Lỗi thêm ${fieldName}:`, err.message);
      } else if (!err) {
        console.log(`✅ Đã thêm trường ${fieldName} vào vehicles`);
      }
    });
  });

  // ========== TRIP_COSTS: Thêm invoice_file_data ==========
  db.run(`ALTER TABLE trip_costs ADD COLUMN invoice_file_data TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('❌ Lỗi thêm invoice_file_data:', err.message);
    } else if (!err) {
      console.log('✅ Đã thêm trường invoice_file_data vào trip_costs');
    }
    
    setTimeout(() => {
      console.log('\n✅ Migration hoàn thành!');
      db.close();
    }, 500);
  });
});
