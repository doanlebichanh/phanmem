const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./freight.db');

console.log('🔄 Bắt đầu migration: Sửa bảng customers...\n');

db.serialize(() => {
  // Bước 1: Thêm cột contact_person
  db.run(`ALTER TABLE customers ADD COLUMN contact_person TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Lỗi thêm contact_person:', err.message);
    } else {
      console.log('✅ Đã thêm cột contact_person');
    }
  });

  // Bước 2: Copy dữ liệu từ contact_name sang contact_person
  db.run(`UPDATE customers SET contact_person = contact_name WHERE contact_person IS NULL`, (err) => {
    if (err) {
      console.error('❌ Lỗi copy data:', err.message);
    } else {
      console.log('✅ Đã copy dữ liệu từ contact_name sang contact_person');
    }
  });

  // Bước 3: Thêm các cột còn thiếu
  db.run(`ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'individual'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Lỗi thêm customer_type:', err.message);
    } else {
      console.log('✅ Đã thêm cột customer_type');
    }
  });

  db.run(`ALTER TABLE customers ADD COLUMN payment_terms TEXT DEFAULT 'COD'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Lỗi thêm payment_terms:', err.message);
    } else {
      console.log('✅ Đã thêm cột payment_terms');
    }
  });

  db.run(`ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('❌ Lỗi thêm status:', err.message);
    } else {
      console.log('✅ Đã thêm cột status');
    }
  });

  // Bước 4: Kiểm tra kết quả
  db.all('PRAGMA table_info(customers)', (err, rows) => {
    if (err) {
      console.error('❌ Lỗi kiểm tra schema:', err);
    } else {
      console.log('\n📋 Schema mới của bảng customers:');
      rows.forEach(col => {
        console.log(`  - ${col.name} (${col.type})${col.dflt_value ? ' DEFAULT ' + col.dflt_value : ''}`);
      });
    }
    
    db.close((err) => {
      if (err) console.error('❌ Lỗi đóng database:', err);
      else console.log('\n✅ Migration hoàn tất!');
    });
  });
});
