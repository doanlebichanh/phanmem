const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'freight.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Bắt đầu migration: Thêm trường final_amount và current_debt...\n');

db.serialize(() => {
  // 1. Thêm trường final_amount vào bảng orders
  db.run(`ALTER TABLE orders ADD COLUMN final_amount REAL DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ Trường final_amount đã tồn tại trong orders');
      } else {
        console.error('❌ Lỗi thêm final_amount:', err.message);
      }
    } else {
      console.log('✅ Đã thêm trường final_amount vào bảng orders');
    }
  });

  // 2. Thêm trường current_debt vào bảng customers
  db.run(`ALTER TABLE customers ADD COLUMN current_debt REAL DEFAULT 0`, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('✓ Trường current_debt đã tồn tại trong customers');
      } else {
        console.error('❌ Lỗi thêm current_debt:', err.message);
      }
    } else {
      console.log('✅ Đã thêm trường current_debt vào bảng customers');
    }
  });

  // 3. Cập nhật final_amount cho các đơn hàng hiện có
  db.run(`
    UPDATE orders 
    SET final_amount = ROUND((COALESCE(price, 0) + COALESCE(neo_xe, 0) + COALESCE(chi_ho, 0)) * 1.1)
    WHERE final_amount IS NULL OR final_amount = 0
  `, (err) => {
    if (err) {
      console.error('❌ Lỗi cập nhật final_amount:', err.message);
    } else {
      console.log('✅ Đã tính final_amount cho các đơn hàng hiện có');
    }
  });

  // 4. Tính công nợ hiện tại cho các khách hàng
  db.all(`
    SELECT 
      c.id,
      COALESCE(SUM(o.final_amount), 0) as total_orders,
      COALESCE(SUM(p.amount), 0) as total_paid
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    LEFT JOIN payments p ON o.id = p.order_id
    GROUP BY c.id
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Lỗi tính công nợ:', err.message);
      db.close();
      return;
    }

    let updated = 0;
    rows.forEach(row => {
      const debt = row.total_orders - row.total_paid;
      db.run('UPDATE customers SET current_debt = ? WHERE id = ?', [debt, row.id], (err) => {
        if (err) {
          console.error(`❌ Lỗi cập nhật nợ khách hàng ${row.id}:`, err.message);
        } else {
          updated++;
          if (updated === rows.length) {
            console.log(`✅ Đã cập nhật công nợ cho ${updated} khách hàng`);
            console.log('\n✅ Migration hoàn thành!');
            db.close();
          }
        }
      });
    });

    if (rows.length === 0) {
      console.log('✓ Không có khách hàng nào cần cập nhật');
      console.log('\n✅ Migration hoàn thành!');
      db.close();
    }
  });
});
