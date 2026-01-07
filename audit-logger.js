const db = require('./database').db;

// Helper function để ghi audit log
function logAudit(userId, username, role, action, entity, entityId, oldValue, newValue, ipAddress) {
  const logEntry = {
    user_id: userId,
    username: username,
    role: role,
    action: action,
    entity: entity,
    entity_id: entityId,
    old_value: oldValue ? JSON.stringify(oldValue) : null,
    new_value: newValue ? JSON.stringify(newValue) : null,
    ip_address: ipAddress,
    timestamp: new Date().toISOString()
  };

  db.run(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, ip_address) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, action, entity, entityId, logEntry.old_value, logEntry.new_value, ipAddress],
    (err) => {
      if (err) {
        console.error('❌ Error logging audit:', err);
      } else {
        console.log(`📝 Audit Log: ${username} (${role}) ${action} ${entity} #${entityId || 'N/A'}`);
      }
    }
  );

  // Kiểm tra hành vi bất thường
  checkSuspiciousActivity(logEntry);
}

// Kiểm tra hành vi bất thường
function checkSuspiciousActivity(logEntry) {
  const alerts = [];

  // 1. Kế toán cố tạo/sửa đơn hàng
  if (logEntry.role === 'accountant' && logEntry.entity === 'orders' && ['create', 'update'].includes(logEntry.action)) {
    alerts.push({
      severity: 'HIGH',
      message: `⚠️ KẾ TOÁN cố ${logEntry.action === 'create' ? 'tạo' : 'sửa'} đơn hàng #${logEntry.entity_id}`,
      user: logEntry.username,
      action: logEntry.action,
      entity: logEntry.entity
    });
  }

  // 2. Điều độ cố xóa thanh toán
  if (logEntry.role === 'dispatcher' && logEntry.entity === 'payments' && logEntry.action === 'delete') {
    alerts.push({
      severity: 'HIGH',
      message: `⚠️ ĐIỀU ĐỘ cố xóa thanh toán #${logEntry.entity_id}`,
      user: logEntry.username,
      action: logEntry.action,
      entity: logEntry.entity
    });
  }

  // 3. Staff cố thực hiện thao tác thêm/sửa/xóa
  if (logEntry.role === 'staff' && ['create', 'update', 'delete'].includes(logEntry.action)) {
    alerts.push({
      severity: 'CRITICAL',
      message: `🚨 NHÂN VIÊN cố ${logEntry.action === 'create' ? 'tạo' : logEntry.action === 'update' ? 'sửa' : 'xóa'} ${logEntry.entity} #${logEntry.entity_id}`,
      user: logEntry.username,
      action: logEntry.action,
      entity: logEntry.entity
    });
  }

  // 4. Xóa nhiều bản ghi trong thời gian ngắn (kiểm tra trong 5 phút gần nhất)
  if (logEntry.action === 'delete') {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    db.all(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE user_id = ? AND action = 'delete' AND created_at > ?`,
      [logEntry.user_id, fiveMinutesAgo],
      (err, rows) => {
        if (!err && rows[0].count >= 5) {
          alerts.push({
            severity: 'HIGH',
            message: `⚠️ ${logEntry.username} đã xóa ${rows[0].count} bản ghi trong 5 phút gần đây`,
            user: logEntry.username,
            action: 'bulk_delete',
            entity: 'multiple'
          });
          console.warn(`⚠️ CẢNH BÁO: ${alerts[alerts.length - 1].message}`);
        }
      }
    );
  }

  // 5. Thay đổi lớn về số tiền thanh toán (> 50 triệu)
  if (logEntry.entity === 'payments' && logEntry.new_value) {
    try {
      const newData = JSON.parse(logEntry.new_value);
      if (newData.amount > 50000000) {
        alerts.push({
          severity: 'MEDIUM',
          message: `💰 ${logEntry.username} ghi nhận thanh toán lớn: ${(newData.amount / 1000000).toFixed(1)}M VND`,
          user: logEntry.username,
          action: logEntry.action,
          entity: logEntry.entity,
          amount: newData.amount
        });
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // In cảnh báo ra console
  alerts.forEach(alert => {
    const prefix = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'HIGH' ? '⚠️' : '💡';
    console.warn(`${prefix} [${alert.severity}] ${alert.message}`);
    
    // Lưu cảnh báo vào database
    db.run(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        logEntry.user_id,
        'security_alert',
        alert.entity,
        logEntry.entity_id,
        null,
        JSON.stringify(alert),
        logEntry.ip_address
      ]
    );
  });

  return alerts;
}

// Middleware để ghi log
function auditMiddleware(action, entity) {
  return (req, res, next) => {
    // Lưu response gốc
    const originalJson = res.json;
    const originalSend = res.send;

    // Override res.json để capture response
    res.json = function(data) {
      // Ghi log sau khi response thành công
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user || {};
        const entityId = req.params.id || (data && data.id) || null;
        const oldValue = req.oldValue || null; // Phải set trước khi update/delete
        const newValue = req.body || data || null;
        const ipAddress = req.ip || req.connection.remoteAddress;

        logAudit(
          user.id,
          user.username,
          user.role,
          action,
          entity,
          entityId,
          oldValue,
          newValue,
          ipAddress
        );
      }

      return originalJson.call(this, data);
    };

    res.send = function(data) {
      // Tương tự cho res.send
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const user = req.user || {};
        const entityId = req.params.id || null;
        const ipAddress = req.ip || req.connection.remoteAddress;

        logAudit(
          user.id,
          user.username,
          user.role,
          action,
          entity,
          entityId,
          req.oldValue || null,
          req.body || null,
          ipAddress
        );
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

module.exports = {
  logAudit,
  auditMiddleware,
  checkSuspiciousActivity
};
