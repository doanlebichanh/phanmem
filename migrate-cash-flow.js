const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'freight.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Bắt đầu migration: Cải tiến cash_flow table...\n');

db.serialize(() => {
  // 1. Add transaction_group column
  db.run(`ALTER TABLE cash_flow ADD COLUMN transaction_group INTEGER`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ Cột transaction_group đã tồn tại');
      } else {
        console.error('❌ Lỗi thêm transaction_group:', err.message);
      }
    } else {
      console.log('✅ Đã thêm cột transaction_group');
    }
  });

  // 2. Add category_details column
  db.run(`ALTER TABLE cash_flow ADD COLUMN category_details TEXT`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✓ Cột category_details đã tồn tại');
      } else {
        console.error('❌ Lỗi thêm category_details:', err.message);
      }
    } else {
      console.log('✅ Đã thêm cột category_details');
    }
    
    setTimeout(() => {
      console.log('\n✅ Migration hoàn thành!');
      console.log('\nTính năng mới:');
      console.log('- Có thể ghi nhiều danh mục chi phí trong 1 giao dịch');
      console.log('- Tự động tính tổng tiền');
      console.log('- Nhóm các giao dịch liên quan với transaction_group');
      db.close();
    }, 500);
  });
});
