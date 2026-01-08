const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./database');
const { logAudit, auditMiddleware } = require('./audit-logger');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Tăng giới hạn cho upload POD
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files với đường dẫn tuyệt đối
app.use(express.static(path.join(__dirname, 'public')));

// Route cho trang chủ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper functions for async sqlite3
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

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Middleware xác thực token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Không có token xác thực' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token không hợp lệ' });
    }
    req.user = user;
    next();
  });
}

// Middleware phân quyền theo vai trò
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Chức năng này yêu cầu vai trò: ${allowedRoles.join(', ')}. Vai trò hiện tại: ${req.user.role}` 
      });
    }
    
    next();
  };
}

// ====================
// AUTH APIs
// ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const user = await dbGet(
      'SELECT * FROM users WHERE username = ? AND status = ?',
      [username, 'active']
    );

    if (!user) {
      // Ghi log đăng nhập thất bại
      logAudit(null, username, 'unknown', 'login_failed', 'auth', null, null, { username }, ipAddress);
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      // Ghi log đăng nhập thất bại
      logAudit(user.id, username, user.role, 'login_failed', 'auth', null, null, { username }, ipAddress);
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    // Ghi log đăng nhập thành công
    logAudit(user.id, username, user.role, 'login_success', 'auth', null, null, { username, role: user.role }, ipAddress);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi đăng nhập' });
  }
});

// ====================
// USER MANAGEMENT APIs
// ====================

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xem danh sách user' });
    }
    
    const users = await dbAll(`
      SELECT id, username, fullname, role, status, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách user' });
  }
});

// Get single user (admin only)
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xem user' });
    }

    const user = await dbGet(
      `SELECT id, username, fullname, role, status, created_at FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy user' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin user' });
  }
});

// Create new user (admin only)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền tạo user' });
    }
    
    const { username, password, fullname, role } = req.body;
    
    // Validate role
    const validRoles = ['admin', 'accountant', 'dispatcher', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role không hợp lệ' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = await dbRun(
      'INSERT INTO users (username, password, fullname, role, status) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, fullname, role, 'active']
    );
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'users',
      result.lastID,
      null,
      { username, fullname, role, status: 'active' },
      req.ip
    );
    
    res.json({ 
      success: true, 
      id: result.lastID,
      message: 'Tạo user thành công'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username đã tồn tại, vui lòng chọn username khác' });
    }
    res.status(500).json({ error: 'Lỗi tạo user: ' + error.message });
  }
});

// Update user (admin only)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền sửa user' });
    }
    
    const { fullname, role, status } = req.body;
    
    // Get old data
    const oldUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    
    await dbRun(
      'UPDATE users SET fullname = ?, role = ?, status = ? WHERE id = ?',
      [fullname, role, status, req.params.id]
    );
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'users',
      req.params.id,
      oldUser,
      { fullname, role, status },
      req.ip
    );
    
    res.json({ success: true, message: 'Cập nhật user thành công' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Lỗi cập nhật user' });
  }
});

// Change password
app.put('/api/users/:id/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = parseInt(req.params.id);
    
    // User can only change their own password, unless admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền đổi mật khẩu user khác' });
    }
    
    // If not admin, verify old password
    if (req.user.role !== 'admin') {
      const user = await dbGet('SELECT password FROM users WHERE id = ?', [userId]);
      const validPassword = bcrypt.compareSync(oldPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Mật khẩu cũ không đúng' });
      }
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    
    res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Lỗi đổi mật khẩu' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Chỉ admin mới có quyền xóa user' });
    }
    
    // Cannot delete yourself
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'Không thể xóa chính mình' });
    }
    
    // Get old data
    const oldUser = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'users',
      req.params.id,
      oldUser,
      null,
      req.ip
    );
    res.json({ success: true, message: 'Xóa user thành công' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Lỗi xóa user' });
  }
});

// ====================
// DRIVERS APIs
// ====================

app.get('/api/drivers', authenticateToken, async (req, res) => {
  try {
    const drivers = await dbAll('SELECT * FROM drivers ORDER BY name');
    res.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách tài xế' });
  }
});

app.get('/api/drivers/:id', authenticateToken, async (req, res) => {
  try {
    const driver = await dbGet('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) {
      return res.status(404).json({ error: 'Không tìm thấy tài xế' });
    }
    res.json(driver);
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin tài xế' });
  }
});

app.post('/api/drivers', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      name, phone, license_number, license_expiry, id_number, address, status, notes,
      birth_date, id_card_image, license_image, license_type, hire_date, base_salary
    } = req.body;

    const result = await dbRun(
      `INSERT INTO drivers (
        name, phone, license_number, license_expiry, id_number, address, status, notes,
        birth_date, id_card_image, license_image, license_type, hire_date, base_salary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, phone, license_number, license_expiry, id_number, address, status || 'active', notes,
        birth_date, id_card_image, license_image, license_type, hire_date, base_salary || 0
      ]
    );

    const driver = await dbGet('SELECT * FROM drivers WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'drivers',
      result.lastID,
      null,
      driver,
      req.ip
    );
    
    res.status(201).json(driver);
  } catch (error) {
    console.error('Error creating driver:', error);
    res.status(500).json({ error: 'Lỗi tạo tài xế' });
  }
});

app.put('/api/drivers/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      name, phone, license_number, license_expiry, id_number, address, status, notes,
      birth_date, id_card_image, license_image, license_type, hire_date, base_salary
    } = req.body;

    // Get old data
    const oldDriver = await dbGet('SELECT * FROM drivers WHERE id = ?', [req.params.id]);

    await dbRun(
      `UPDATE drivers 
       SET name = ?, phone = ?, license_number = ?, license_expiry = ?, id_number = ?, address = ?, status = ?, notes = ?,
           birth_date = ?, id_card_image = ?, license_image = ?, license_type = ?, hire_date = ?, base_salary = ?
       WHERE id = ?`,
      [
        name, phone, license_number, license_expiry, id_number, address, status, notes,
        birth_date, id_card_image, license_image, license_type, hire_date, base_salary,
        req.params.id
      ]
    );

    const driver = await dbGet('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'drivers',
      req.params.id,
      oldDriver,
      driver,
      req.ip
    );
    
    res.json(driver);
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({ error: 'Lỗi cập nhật tài xế' });
  }
});

app.delete('/api/drivers/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old data
    const oldDriver = await dbGet('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM drivers WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'drivers',
      req.params.id,
      oldDriver,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa tài xế thành công' });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({ error: 'Lỗi xóa tài xế' });
  }
});

// ====================
// VEHICLES APIs
// ====================

app.get('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const vehicles = await dbAll('SELECT * FROM vehicles ORDER BY plate_number');
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách xe' });
  }
});

app.post('/api/vehicles', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      plate_number, vehicle_type, brand, model, year, engine_power, fuel_consumption_empty, fuel_consumption_loaded, 
      capacity, status, registration_expiry, insurance_expiry, notes,
      vin_number, engine_number, color, ownership, purchase_price, purchase_date, current_odometer
    } = req.body;

    const result = await dbRun(
      `INSERT INTO vehicles (
        plate_number, vehicle_type, brand, model, year, engine_power, fuel_consumption_empty, fuel_consumption_loaded, 
        capacity, status, registration_expiry, insurance_expiry, notes,
        vin_number, engine_number, color, ownership, purchase_price, purchase_date, current_odometer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plate_number, vehicle_type, brand, model, year, engine_power, fuel_consumption_empty, fuel_consumption_loaded, 
        capacity, status || 'available', registration_expiry, insurance_expiry, notes,
        vin_number, engine_number, color, ownership, purchase_price, purchase_date, current_odometer
      ]
    );

    const vehicle = await dbGet('SELECT * FROM vehicles WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'vehicles',
      result.lastID,
      null,
      vehicle,
      req.ip
    );
    
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ error: 'Lỗi tạo xe' });
  }
});

app.put('/api/vehicles/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      plate_number, vehicle_type, brand, model, year, engine_power, fuel_consumption_empty, fuel_consumption_loaded, 
      capacity, status, registration_expiry, insurance_expiry, notes,
      vin_number, engine_number, color, ownership, purchase_price, purchase_date, current_odometer
    } = req.body;

    // Get old data
    const oldVehicle = await dbGet('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);

    await dbRun(
      `UPDATE vehicles 
       SET plate_number = ?, vehicle_type = ?, brand = ?, model = ?, year = ?, engine_power = ?, 
           fuel_consumption_empty = ?, fuel_consumption_loaded = ?, capacity = ?, status = ?, 
           registration_expiry = ?, insurance_expiry = ?, notes = ?,
           vin_number = ?, engine_number = ?, color = ?, ownership = ?, purchase_price = ?, purchase_date = ?, current_odometer = ?
       WHERE id = ?`,
      [
        plate_number, vehicle_type, brand, model, year, engine_power, fuel_consumption_empty, fuel_consumption_loaded, 
        capacity, status, registration_expiry, insurance_expiry, notes,
        vin_number, engine_number, color, ownership, purchase_price, purchase_date, current_odometer,
        req.params.id
      ]
    );

    const vehicle = await dbGet('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'vehicles',
      req.params.id,
      oldVehicle,
      vehicle,
      req.ip
    );
    
    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Lỗi cập nhật xe' });
  }
});

app.delete('/api/vehicles/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old data
    const oldVehicle = await dbGet('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'vehicles',
      req.params.id,
      oldVehicle,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa xe thành công' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Lỗi xóa xe' });
  }
});

// ====================
// CONTAINERS APIs
// ====================

app.get('/api/containers', authenticateToken, async (req, res) => {
  try {
    const containers = await dbAll('SELECT * FROM containers ORDER BY container_number');
    res.json(containers);
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách container' });
  }
});

app.put('/api/containers/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { status, current_location, notes } = req.body;

    // Get old data
    const oldContainer = await dbGet('SELECT * FROM containers WHERE id = ?', [req.params.id]);

    await dbRun(
      'UPDATE containers SET status = ?, current_location = ?, notes = ? WHERE id = ?',
      [status, current_location, notes, req.params.id]
    );

    const container = await dbGet('SELECT * FROM containers WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'containers',
      req.params.id,
      oldContainer,
      container,
      req.ip
    );
    
    res.json(container);
  } catch (error) {
    console.error('Error updating container:', error);
    res.status(500).json({ error: 'Lỗi cập nhật container' });
  }
});

// ====================
// ROUTES APIs
// ====================

app.get('/api/routes', authenticateToken, async (req, res) => {
  try {
    const routes = await dbAll('SELECT * FROM routes ORDER BY route_name');
    res.json(routes);
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách tuyến' });
  }
});

app.post('/api/routes', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { route_name, origin, destination, distance_km, estimated_hours, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO routes (route_name, origin, destination, distance_km, estimated_hours, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [route_name, origin, destination, distance_km, estimated_hours, notes]
    );

    const route = await dbGet('SELECT * FROM routes WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'routes',
      result.lastID,
      null,
      route,
      req.ip
    );
    
    res.status(201).json(route);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: 'Lỗi tạo tuyến' });
  }
});

app.put('/api/routes/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { route_name, origin, destination, distance_km, estimated_hours, notes } = req.body;

    // Get old data
    const oldRoute = await dbGet('SELECT * FROM routes WHERE id = ?', [req.params.id]);

    await dbRun(
      `UPDATE routes 
       SET route_name = ?, origin = ?, destination = ?, distance_km = ?, estimated_hours = ?, notes = ?
       WHERE id = ?`,
      [route_name, origin, destination, distance_km, estimated_hours, notes, req.params.id]
    );

    const route = await dbGet('SELECT * FROM routes WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'routes',
      req.params.id,
      oldRoute,
      route,
      req.ip
    );
    
    res.json(route);
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({ error: 'Lỗi cập nhật tuyến' });
  }
});

app.delete('/api/routes/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old data
    const oldRoute = await dbGet('SELECT * FROM routes WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM routes WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'routes',
      req.params.id,
      oldRoute,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa tuyến thành công' });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({ error: 'Lỗi xóa tuyến' });
  }
});

// ====================
// ORDERS APIs
// ====================

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { customer_id, from, to, status } = req.query;
    
    let query = `
      SELECT o.*, 
        c.name as customer_name,
        d.name as driver_name,
        v.plate_number as vehicle_plate,
        cn.container_number,
        COALESCE(r.route_name, TRIM(COALESCE(r.origin, '') || ' - ' || COALESCE(r.destination, ''))) AS route_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN containers cn ON o.container_id = cn.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // Filter by customer
    if (customer_id) {
      query += ' AND o.customer_id = ?';
      params.push(customer_id);
    }
    
    // Filter by date range
    if (from) {
      query += ' AND o.order_date >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND o.order_date <= ?';
      params.push(to);
    }
    
    // Filter by status
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.order_date DESC';
    
    const orders = await dbAll(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách đơn hàng' });
  }
});

app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await dbGet(`
      SELECT o.*, 
        c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
        d.name as driver_name, d.phone as driver_phone,
        v.plate_number as vehicle_plate,
        cn.container_number,
        COALESCE(r.route_name, TRIM(COALESCE(r.origin, '') || ' - ' || COALESCE(r.destination, ''))) AS route_name,
        r.origin, r.destination
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN containers cn ON o.container_id = cn.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Lấy chi phí
    const costs = await dbAll('SELECT * FROM trip_costs WHERE order_id = ?', [req.params.id]);
    
    // Lấy thanh toán
    const payments = await dbAll('SELECT * FROM payments WHERE order_id = ?', [req.params.id]);

    res.json({ ...order, costs, payments });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin đơn hàng' });
  }
});

app.post('/api/orders', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const {
      customer_id, route_id, container_id, vehicle_id, driver_id,
      order_date, pickup_date, delivery_date,
      pickup_location, intermediate_point, delivery_location,
      cargo_description, quantity, weight, price, neo_xe, chi_ho, status, notes,
      booking_number, bill_of_lading, seal_number, cargo_type, vat_rate
    } = req.body;

    // Tạo mã đơn hàng tự động
    const orderCode = 'ORD' + Date.now().toString().slice(-8);
    
    // VAT: mặc định 10% (0.1). Có thể truyền vat_rate nếu cần.
    const vatRate = (vat_rate !== undefined && vat_rate !== null && vat_rate !== '') ? Number(vat_rate) : 0.1;
    const subtotal_amount = (Number(price) || 0) + (Number(neo_xe) || 0) + (Number(chi_ho) || 0);
    const final_amount = (req.body.final_amount !== undefined && req.body.final_amount !== null && req.body.final_amount !== '')
      ? Number(req.body.final_amount)
      : Math.round(subtotal_amount * (1 + vatRate));
    const vat_amount = final_amount - subtotal_amount;

    const result = await dbRun(
      `INSERT INTO orders (
        order_code, customer_id, route_id, container_id, vehicle_id, driver_id,
        order_date, pickup_date, delivery_date,
        pickup_location, intermediate_point, delivery_location,
        cargo_description, quantity, weight, price, neo_xe, chi_ho, subtotal_amount, vat_rate, vat_amount, final_amount, status, notes, created_by,
        booking_number, bill_of_lading, seal_number, cargo_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderCode, customer_id, route_id, container_id, vehicle_id, driver_id,
        order_date, pickup_date, delivery_date,
        pickup_location, intermediate_point, delivery_location,
        cargo_description, quantity, weight, price, neo_xe || 0, chi_ho || 0, subtotal_amount, vatRate, vat_amount, final_amount, status || 'pending', notes, req.user.id,
        booking_number, bill_of_lading, seal_number, cargo_type
      ]
    );
    
    // Cập nhật công nợ khách hàng
    await dbRun(
      'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
      [final_amount, customer_id]
    );

    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'orders',
      result.lastID,
      null,
      order,
      req.ip
    );
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Lỗi tạo đơn hàng' });
  }
});

app.put('/api/orders/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    console.log('Update order request body:', req.body);
    
    // Get old data before update
    const oldOrder = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

    if (!oldOrder) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }
    
    // Nếu có thay đổi giá/khách, tính lại final_amount và cập nhật công nợ
    const customerIdNew = req.body.customer_id !== undefined ? req.body.customer_id : oldOrder.customer_id;
    const hasAmountChange = (
      req.body.price !== undefined ||
      req.body.neo_xe !== undefined ||
      req.body.chi_ho !== undefined ||
      req.body.final_amount !== undefined ||
      req.body.vat_rate !== undefined
    );
    const hasCustomerChange = req.body.customer_id !== undefined && req.body.customer_id !== oldOrder.customer_id;

    if (hasAmountChange || hasCustomerChange) {
      const newPrice = req.body.price !== undefined ? req.body.price : oldOrder.price;
      const newNeoXe = req.body.neo_xe !== undefined ? req.body.neo_xe : (oldOrder.neo_xe || 0);
      const newChiHo = req.body.chi_ho !== undefined ? req.body.chi_ho : (oldOrder.chi_ho || 0);

      const vatRate = (req.body.vat_rate !== undefined && req.body.vat_rate !== null && req.body.vat_rate !== '')
        ? Number(req.body.vat_rate)
        : (oldOrder.vat_rate !== undefined && oldOrder.vat_rate !== null ? Number(oldOrder.vat_rate) : 0.1);

      const subtotalAmountNew = (Number(newPrice) || 0) + (Number(newNeoXe) || 0) + (Number(newChiHo) || 0);
      req.body.subtotal_amount = subtotalAmountNew;

      let finalAmountNew = req.body.final_amount;
      if (finalAmountNew === undefined) {
        finalAmountNew = Math.round(subtotalAmountNew * (1 + vatRate));
        req.body.final_amount = finalAmountNew;
      }

      req.body.vat_rate = vatRate;
      req.body.vat_amount = Number(finalAmountNew) - Number(subtotalAmountNew);

      const finalAmountOld = oldOrder.final_amount || 0;
      if (hasCustomerChange) {
        // Also move any recorded payments to keep customer debt consistent.
        const paymentSumRow = await dbGet(
          'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE order_id = ?',
          [req.params.id]
        );
        const totalPaid = paymentSumRow?.total_paid || 0;

        if (totalPaid > 0) {
          // Restore the reduction on old customer, apply it to new customer.
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
            [totalPaid, oldOrder.customer_id]
          );
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) - ? WHERE id = ?',
            [totalPaid, customerIdNew]
          );

          // Re-point payments to the new customer.
          await dbRun(
            'UPDATE payments SET customer_id = ? WHERE order_id = ?',
            [customerIdNew, req.params.id]
          );
        }

        // Move debt from old customer to new customer
        if (finalAmountOld !== 0) {
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) - ? WHERE id = ?',
            [finalAmountOld, oldOrder.customer_id]
          );
        }
        if (finalAmountNew !== 0) {
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
            [finalAmountNew, customerIdNew]
          );
        }
      } else {
        const debtDiff = finalAmountNew - finalAmountOld;
        if (debtDiff !== 0) {
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
            [debtDiff, oldOrder.customer_id]
          );
        }
      }
    }
    
    // Build dynamic UPDATE query based on fields provided
    const allowedFields = [
      'customer_id', 'route_id', 'container_id', 'vehicle_id', 'driver_id',
      'order_date', 'pickup_date', 'delivery_date',
      'pickup_location', 'intermediate_point', 'delivery_location',
      'cargo_description', 'quantity', 'weight', 'price', 'neo_xe', 'chi_ho',
      'subtotal_amount', 'vat_rate', 'vat_amount', 'final_amount',
      'status', 'notes',
      'booking_number', 'bill_of_lading', 'seal_number', 'cargo_type'
    ];
    
    const updates = [];
    const values = [];
    
    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Không có dữ liệu để cập nhật' });
    }
    
    values.push(req.params.id); // Add ID for WHERE clause
    
    const query = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
    console.log('Update query:', query);
    console.log('Update values:', values);
    
    await dbRun(query, values);

    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'orders',
      req.params.id,
      oldOrder,
      order,
      req.ip
    );
    
    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Lỗi cập nhật đơn hàng: ' + error.message });
  }
});

app.delete('/api/orders/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Lấy thông tin đơn hàng trước khi xóa
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }

    // Hoàn trả ảnh hưởng của các phiếu thu (vì khi tạo phiếu thu đã trừ công nợ)
    const payGroups = await dbAll(
      'SELECT customer_id, COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE order_id = ? GROUP BY customer_id',
      [req.params.id]
    );
    if (payGroups && payGroups.length > 0) {
      for (const g of payGroups) {
        if (g.customer_id) {
          await dbRun(
            'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
            [g.total_paid || 0, g.customer_id]
          );
        }
      }
    }
    
    // Trừ công nợ khách hàng
    if (order && order.final_amount) {
      await dbRun(
        'UPDATE customers SET current_debt = COALESCE(current_debt, 0) - ? WHERE id = ?',
        [order.final_amount, order.customer_id]
      );
    }
    
    // Xóa các bản ghi liên quan
    await dbRun('DELETE FROM trip_costs WHERE order_id = ?', [req.params.id]);
    await dbRun('DELETE FROM payments WHERE order_id = ?', [req.params.id]);
    await dbRun('DELETE FROM driver_advances WHERE order_id = ?', [req.params.id]);
    await dbRun('DELETE FROM documents WHERE order_id = ?', [req.params.id]);
    await dbRun('DELETE FROM orders WHERE id = ?', [req.params.id]);
    
    // Ghi audit log
    const ipAddress = req.ip || req.connection.remoteAddress;
    logAudit(req.user.id, req.user.username, req.user.role, 'delete', 'orders', req.params.id, order, null, ipAddress);
    
    res.json({ message: 'Xóa đơn hàng thành công' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Lỗi xóa đơn hàng' });
  }
});

// ====================
// TRIP COSTS APIs
// ====================

app.get('/api/orders/:orderId/costs', authenticateToken, async (req, res) => {
  try {
    const costs = await dbAll('SELECT * FROM trip_costs WHERE order_id = ? ORDER BY cost_date DESC', [req.params.orderId]);
    res.json(costs);
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Lỗi lấy chi phí' });
  }
});

app.post('/api/orders/:orderId/costs', authenticateToken, requireRole('admin', 'dispatcher', 'accountant'), async (req, res) => {
  try {
    const { cost_type, amount, fuel_liters, fuel_price_per_liter, distance_km, receipt_number, invoice_file, cost_date, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO trip_costs (order_id, cost_type, amount, fuel_liters, fuel_price_per_liter, distance_km, receipt_number, invoice_file, cost_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.orderId, cost_type, amount, fuel_liters, fuel_price_per_liter, distance_km, receipt_number, invoice_file, cost_date, notes, req.user.id]
    );

    const cost = await dbGet('SELECT * FROM trip_costs WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'costs',
      result.lastID,
      null,
      cost,
      req.ip
    );
    
    res.status(201).json(cost);
  } catch (error) {
    console.error('Error creating cost:', error);
    res.status(500).json({ error: 'Lỗi tạo chi phí' });
  }
});

app.delete('/api/costs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old cost data before deletion
    const oldCost = await dbGet('SELECT * FROM trip_costs WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM trip_costs WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'costs',
      req.params.id,
      oldCost,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa chi phí thành công' });
  } catch (error) {
    console.error('Error deleting cost:', error);
    res.status(500).json({ error: 'Lỗi xóa chi phí' });
  }
});

// Get all costs (for reports/dashboard)
app.get('/api/costs', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, vehicle_id, order_id } = req.query;
    
    let query = `
      SELECT 
        tc.*,
        o.order_code,
        v.plate_number,
        tc.amount as total_amount
      FROM trip_costs tc
      LEFT JOIN orders o ON tc.order_id = o.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (from_date) {
      query += ' AND tc.cost_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND tc.cost_date <= ?';
      params.push(to_date);
    }
    if (vehicle_id) {
      query += ' AND o.vehicle_id = ?';
      params.push(vehicle_id);
    }
    if (order_id) {
      query += ' AND tc.order_id = ?';
      params.push(order_id);
    }
    
    query += ' ORDER BY tc.cost_date DESC, tc.id DESC';
    
    const costs = await dbAll(query, params);
    res.json(costs);
  } catch (error) {
    console.error('Error fetching costs:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách chi phí' });
  }
});

// Báo cáo chi phí theo loại
app.get('/api/reports/costs-by-type', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    let query = `
      SELECT 
        v.plate_number as vehicle_number,
        SUM(CASE WHEN tc.cost_type = 'Dầu xe' THEN tc.amount ELSE 0 END) as fuel_cost,
        SUM(CASE WHEN tc.cost_type = 'Phí cầu đường' THEN tc.amount ELSE 0 END) as toll_cost,
        SUM(CASE WHEN tc.cost_type NOT IN ('Dầu xe', 'Phí cầu đường') THEN tc.amount ELSE 0 END) as other_cost,
        SUM(tc.amount) as total_cost,
        COUNT(DISTINCT tc.order_id) as trip_count,
        SUM(COALESCE(tc.fuel_liters, 0)) as total_fuel_liters,
        SUM(COALESCE(tc.distance_km, 0)) as total_distance
      FROM trip_costs tc
      JOIN orders o ON tc.order_id = o.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      WHERE v.plate_number IS NOT NULL
    `;
    
    const params = [];
    if (from_date) {
      query += ' AND tc.cost_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND tc.cost_date <= ?';
      params.push(to_date);
    }
    
    query += ' GROUP BY v.plate_number ORDER BY total_cost DESC';
    
    const report = await dbAll(query, params);
    res.json(report);
  } catch (error) {
    console.error('Error generating cost report:', error);
    res.status(500).json({ error: 'Lỗi tạo báo cáo chi phí' });
  }
});

// Báo cáo lợi nhuận theo đơn hàng
app.get('/api/reports/profit-by-order', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    
    let query = `
      SELECT 
        v.plate_number as vehicle_number,
        COUNT(o.id) as total_trips,
        SUM(o.price) as revenue,
        COALESCE(SUM(tc.amount), 0) as total_costs,
        SUM(o.price) - COALESCE(SUM(tc.amount), 0) as profit,
        CASE 
          WHEN SUM(o.price) > 0 
          THEN ROUND((SUM(o.price) - COALESCE(SUM(tc.amount), 0)) * 100.0 / SUM(o.price), 2)
          ELSE 0 
        END as profit_margin
      FROM orders o
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN trip_costs tc ON o.id = tc.order_id
      WHERE o.status = 'completed' AND v.plate_number IS NOT NULL
    `;
    
    const params = [];
    if (from_date) {
      query += ' AND o.order_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND o.order_date <= ?';
      params.push(to_date);
    }
    
    query += ' GROUP BY v.plate_number ORDER BY profit DESC';
    
    const report = await dbAll(query, params);
    res.json(report);
  } catch (error) {
    console.error('Error generating profit report:', error);
    res.status(500).json({ error: 'Lỗi tạo báo cáo lợi nhuận' });
  }
});

// ====================
// PAYMENTS APIs
// ====================

app.get('/api/orders/:orderId/payments', authenticateToken, async (req, res) => {
  try {
    const payments = await dbAll('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC', [req.params.orderId]);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Lỗi lấy thanh toán' });
  }
});

app.post('/api/orders/:orderId/payments', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { payment_date, amount, payment_method, reference_number, notes } = req.body;

    if (!payment_date) {
      return res.status(400).json({ error: 'Thiếu ngày thanh toán' });
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ error: 'Số tiền phải lớn hơn 0' });
    }

    // Always derive customer_id from the order to keep debt consistent.
    const order = await dbGet('SELECT id, customer_id FROM orders WHERE id = ?', [req.params.orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    }
    const customer_id = order.customer_id;

    const result = await dbRun(
      `INSERT INTO payments (order_id, customer_id, payment_date, amount, payment_method, reference_number, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.orderId, customer_id, payment_date, amt, payment_method, reference_number, notes, req.user.id]
    );

    // Cập nhật công nợ khách hàng
    await dbRun(
      'UPDATE customers SET current_debt = COALESCE(current_debt, 0) - ? WHERE id = ?',
      [amt, customer_id]
    );

    const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'payments',
      result.lastID,
      null,
      payment,
      req.ip
    );
    
    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Lỗi tạo thanh toán' });
  }
});

app.delete('/api/payments/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Lấy thông tin thanh toán trước khi xóa để hoàn trả công nợ
    const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    
    if (payment) {
      await dbRun(
        'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
        [payment.amount, payment.customer_id]
      );
    }

    await dbRun('DELETE FROM payments WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'payments',
      req.params.id,
      payment,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa thanh toán thành công' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Lỗi xóa thanh toán' });
  }
});

// ====================
// DRIVER ADVANCES APIs - Tạm ứng tài xế
// ====================

// Lấy danh sách tạm ứng của một đơn hàng
app.get('/api/orders/:orderId/advances', authenticateToken, async (req, res) => {
  try {
    const advances = await dbAll(`
      SELECT da.*, d.name as driver_name
      FROM driver_advances da
      LEFT JOIN drivers d ON da.driver_id = d.id
      WHERE da.order_id = ?
      ORDER BY da.advance_date DESC
    `, [req.params.orderId]);
    res.json(advances);
  } catch (error) {
    console.error('Error fetching advances:', error);
    res.status(500).json({ error: 'Lỗi lấy tạm ứng' });
  }
});

// Lấy danh sách tạm ứng của một tài xế
app.get('/api/drivers/:driverId/advances', authenticateToken, async (req, res) => {
  try {
    const { settled } = req.query;
    let query = `
      SELECT da.*, o.order_code
      FROM driver_advances da
      LEFT JOIN orders o ON da.order_id = o.id
      WHERE da.driver_id = ?
    `;
    
    if (settled !== undefined) {
      query += ` AND da.settled = ${settled === 'true' ? 1 : 0}`;
    }
    
    query += ' ORDER BY da.advance_date DESC';
    
    const advances = await dbAll(query, [req.params.driverId]);
    res.json(advances);
  } catch (error) {
    console.error('Error fetching driver advances:', error);
    res.status(500).json({ error: 'Lỗi lấy tạm ứng tài xế' });
  }
});

// Tạo tạm ứng mới
app.post('/api/orders/:orderId/advances', authenticateToken, requireRole('admin', 'dispatcher', 'accountant'), async (req, res) => {
  try {
    const { driver_id, advance_date, amount, purpose, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO driver_advances (order_id, driver_id, advance_date, amount, purpose, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.orderId, driver_id, advance_date, amount, purpose || null, notes, req.user.id]
    );

    const advance = await dbGet('SELECT * FROM driver_advances WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'advances',
      result.lastID,
      null,
      advance,
      req.ip
    );
    
    res.status(201).json(advance);
  } catch (error) {
    console.error('Error creating advance:', error);
    res.status(500).json({ error: 'Lỗi tạo tạm ứng' });
  }
});

// Quyết toán tạm ứng
app.put('/api/advances/:id/settle', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { settlement_date } = req.body;
    
    // Get old data
    const oldAdvance = await dbGet('SELECT * FROM driver_advances WHERE id = ?', [req.params.id]);
    
    await dbRun(
      `UPDATE driver_advances 
       SET settled = 1, settlement_date = ?
       WHERE id = ?`,
      [settlement_date || new Date().toISOString().split('T')[0], req.params.id]
    );

    const advance = await dbGet('SELECT * FROM driver_advances WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'advances',
      req.params.id,
      oldAdvance,
      advance,
      req.ip
    );
    
    res.json(advance);
  } catch (error) {
    console.error('Error settling advance:', error);
    res.status(500).json({ error: 'Lỗi quyết toán tạm ứng' });
  }
});

// Xóa tạm ứng
app.delete('/api/advances/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old data
    const oldAdvance = await dbGet('SELECT * FROM driver_advances WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM driver_advances WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'advances',
      req.params.id,
      oldAdvance,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa tạm ứng thành công' });
  } catch (error) {
    console.error('Error deleting advance:', error);
    res.status(500).json({ error: 'Lỗi xóa tạm ứng' });
  }
});

// Thống kê tạm ứng chưa quyết toán
app.get('/api/reports/unsettled-advances', authenticateToken, async (req, res) => {
  try {
    const advances = await dbAll(`
      SELECT 
        d.name as driver_name,
        COUNT(*) as advance_count,
        SUM(da.amount) as total_amount
      FROM driver_advances da
      JOIN drivers d ON da.driver_id = d.id
      WHERE da.settled = 0
      GROUP BY da.driver_id, d.name
      ORDER BY total_amount DESC
    `);
    res.json(advances);
  } catch (error) {
    console.error('Error fetching unsettled advances:', error);
    res.status(500).json({ error: 'Lỗi lấy thống kê tạm ứng' });
  }
});

// ====================
// DOCUMENTS / POD APIs - Upload Proof of Delivery
// ====================

// Lấy documents của đơn hàng
app.get('/api/orders/:orderId/documents', authenticateToken, async (req, res) => {
  try {
    const documents = await dbAll(
      'SELECT * FROM documents WHERE order_id = ? ORDER BY uploaded_at DESC',
      [req.params.orderId]
    );
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Lỗi lấy tài liệu' });
  }
});

// Upload document (base64)
app.post('/api/orders/:orderId/documents', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { document_type, file_name, file_data } = req.body;
    
    // Store as base64 in database (simple approach, no file system)
    const result = await dbRun(
      `INSERT INTO documents (order_id, document_type, file_name, file_url, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.orderId, document_type, file_name, file_data, req.user.id]
    );

    const document = await dbGet('SELECT id, order_id, document_type, file_name, uploaded_at FROM documents WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'documents',
      result.lastID,
      null,
      document,
      req.ip
    );
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Lỗi upload tài liệu' });
  }
});

// Xóa document
app.delete('/api/documents/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Get old data
    const oldDocument = await dbGet('SELECT id, order_id, document_type, file_name, uploaded_at FROM documents WHERE id = ?', [req.params.id]);
    
    await dbRun('DELETE FROM documents WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'documents',
      req.params.id,
      oldDocument,
      null,
      req.ip
    );
    
    res.json({ message: 'Xóa tài liệu thành công' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Lỗi xóa tài liệu' });
  }
});

// Lấy file content (base64)
app.get('/api/documents/:id/download', authenticateToken, async (req, res) => {
  try {
    const doc = await dbGet('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    }
    res.json({ file_data: doc.file_url, file_name: doc.file_name });
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Lỗi tải tài liệu' });
  }
});

// ====================
// CONTAINERS APIs - Quản lý container (có thể thêm/xóa/sửa)
// ====================

// Thêm API để tạo container mới
app.post('/api/containers', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { container_number, container_type, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO containers (container_number, container_type, notes)
       VALUES (?, ?, ?)`,
      [container_number, container_type || '40ft', notes]
    );

    const container = await dbGet('SELECT * FROM containers WHERE id = ?', [result.lastID]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'containers',
      result.lastID,
      null,
      container,
      req.ip
    );
    
    res.status(201).json(container);
  } catch (error) {
    console.error('Error creating container:', error);
    if (error.message.includes('UNIQUE constraint')) {
      res.status(400).json({ error: 'Số container đã tồn tại' });
    } else {
      res.status(500).json({ error: 'Lỗi tạo container' });
    }
  }
});

// Xóa container (chỉ xóa được nếu chưa có đơn hàng)
app.delete('/api/containers/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Kiểm tra xem container có đơn hàng không
    const orders = await dbGet(
      'SELECT COUNT(*) as count FROM orders WHERE container_id = ?',
      [req.params.id]
    );

    if (orders.count > 0) {
      return res.status(400).json({ error: 'Không thể xóa container đã có đơn hàng' });
    }

    await dbRun('DELETE FROM containers WHERE id = ?', [req.params.id]);
    res.json({ message: 'Xóa container thành công' });
  } catch (error) {
    console.error('Error deleting container:', error);
    res.status(500).json({ error: 'Lỗi xóa container' });
  }
});

// ====================
// REPORTS APIs
// ====================

// Báo cáo tổng quan
app.get('/api/reports/overview', authenticateToken, async (req, res) => {
  try {
    const { from_date, to_date, from, to } = req.query;

    const fromDate = from_date || from || null;
    const toDate = to_date || to || null;

    const buildDateRange = (columnName, params) => {
      const clauses = [];
      if (fromDate) {
        clauses.push(`${columnName} >= ?`);
        params.push(fromDate);
      }
      if (toDate) {
        clauses.push(`${columnName} <= ?`);
        params.push(toDate);
      }
      return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
    };

    // Orders (revenue) filter uses order_date
    const orderParams = [];
    const orderFilter = fromDate || toDate ? `WHERE 1=1${buildDateRange('o.order_date', orderParams)}` : '';

    const totalOrders = await dbGet(
      `SELECT COUNT(*) as count FROM orders o ${orderFilter}`,
      orderParams
    );

    const totalRevenue = await dbGet(
      `SELECT SUM(COALESCE(o.final_amount, o.price, 0)) as total FROM orders o ${orderFilter}`,
      orderParams
    );

    // Operational costs are not only trip_costs. Sum across key expense sources by their own dates.
    const tripCostParams = [];
    const tripCostFilter = `WHERE 1=1${buildDateRange('tc.cost_date', tripCostParams)}`;
    const tripCosts = await dbGet(
      `SELECT SUM(COALESCE(tc.amount, 0)) as total FROM trip_costs tc ${tripCostFilter}`,
      tripCostParams
    );

    const fuelParams = [];
    const fuelFilter = `WHERE 1=1${buildDateRange('fr.fuel_date', fuelParams)}`;
    const fuelCosts = await dbGet(
      `SELECT SUM(COALESCE(fr.total_cost, 0)) as total FROM fuel_records fr ${fuelFilter}`,
      fuelParams
    );

    const maintenanceParams = [];
    const maintenanceFilter = `WHERE 1=1${buildDateRange('m.maintenance_date', maintenanceParams)}`;
    const maintenanceCosts = await dbGet(
      `SELECT SUM(COALESCE(m.cost, 0)) as total FROM vehicle_maintenance m ${maintenanceFilter}`,
      maintenanceParams
    );

    const feeParams = [];
    const feeDateExpr = `COALESCE(f.paid_date, substr(f.created_at, 1, 10))`;
    const feeFilter = `WHERE 1=1${buildDateRange(feeDateExpr, feeParams)}`;
    const feeCosts = await dbGet(
      `SELECT SUM(COALESCE(f.amount, 0)) as total FROM vehicle_fees f ${feeFilter}`,
      feeParams
    );

    const salaryParams = [];
    const salaryFilter = `WHERE ds.status = 'paid'${buildDateRange('ds.paid_date', salaryParams)}`;
    const salaryCosts = await dbGet(
      `SELECT SUM(COALESCE(ds.total_salary, 0)) as total FROM driver_salaries ds ${salaryFilter}`,
      salaryParams
    );

    // Total payments: keep historical behavior (filter by orders' order_date)
    const totalPayments = await dbGet(
      `
        SELECT SUM(COALESCE(p.amount, 0)) as total
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        ${orderFilter}
      `,
      orderParams
    );

    const totalCostsValue =
      (tripCosts?.total || 0) +
      (fuelCosts?.total || 0) +
      (maintenanceCosts?.total || 0) +
      (feeCosts?.total || 0) +
      (salaryCosts?.total || 0);

    res.json({
      totalOrders: totalOrders?.count || 0,
      totalRevenue: totalRevenue?.total || 0,
      totalCosts: totalCostsValue,
      totalPayments: totalPayments?.total || 0,
      profit: (totalRevenue?.total || 0) - totalCostsValue
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Lỗi lấy báo cáo tổng quan' });
  }
});

// Báo cáo theo khách hàng
app.get('/api/reports/customers', authenticateToken, async (req, res) => {
  try {
    // Avoid double-counting orders when there are multiple payments.
    const report = await dbAll(`
      WITH order_totals AS (
        SELECT customer_id,
               COUNT(*) as total_orders,
               SUM(COALESCE(final_amount, 0)) as total_revenue
        FROM orders
        GROUP BY customer_id
      ),
      payment_totals AS (
        SELECT o.customer_id as customer_id,
               SUM(COALESCE(p.amount, 0)) as total_paid
        FROM payments p
        JOIN orders o ON p.order_id = o.id
        GROUP BY o.customer_id
      )
      SELECT
        c.id,
        c.name,
        COALESCE(ot.total_orders, 0) as total_orders,
        COALESCE(ot.total_revenue, 0) as total_revenue,
        COALESCE(pt.total_paid, 0) as total_paid,
        COALESCE(ot.total_revenue, 0) - COALESCE(pt.total_paid, 0) as current_debt
      FROM customers c
      LEFT JOIN order_totals ot ON c.id = ot.customer_id
      LEFT JOIN payment_totals pt ON c.id = pt.customer_id
      ORDER BY total_revenue DESC
    `);
    res.json(report);
  } catch (error) {
    console.error('Error fetching customer report:', error);
    res.status(500).json({ error: 'Lỗi lấy báo cáo khách hàng' });
  }
});

// Báo cáo theo container
app.get('/api/reports/containers', authenticateToken, async (req, res) => {
  try {
    const report = await dbAll(`
      SELECT 
        c.id,
        c.container_number,
        COUNT(o.id) as total_trips,
        SUM(o.price) as total_revenue,
        SUM(COALESCE(tc.cost, 0)) as total_cost
      FROM containers c
      LEFT JOIN orders o ON c.id = o.container_id
      LEFT JOIN (
        SELECT order_id, SUM(amount) as cost
        FROM trip_costs
        GROUP BY order_id
      ) tc ON o.id = tc.order_id
      GROUP BY c.id
      ORDER BY total_trips DESC
    `);
    res.json(report);
  } catch (error) {
    console.error('Error fetching container report:', error);
    res.status(500).json({ error: 'Lỗi lấy báo cáo container' });
  }
});

// ====================
// Audit Logs
// ====================
app.get('/api/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from_date, to_date, user_id, action, entity } = req.query;
    
    let query = `
      SELECT 
        al.*,
        u.username,
        u.fullname,
        u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (from_date) {
      query += ' AND al.created_at >= ?';
      params.push(from_date);
    }
    
    if (to_date) {
      query += ' AND al.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }
    
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    
    if (entity) {
      query += ' AND al.entity = ?';
      params.push(entity);
    }
    
    query += ' ORDER BY al.created_at DESC LIMIT 500';
    
    const logs = await dbAll(query, params);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Lỗi lấy nhật ký hoạt động' });
  }
});

// Get single audit log (admin only)
app.get('/api/audit-logs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const log = await dbGet(
      `
      SELECT 
        al.*,
        u.username,
        u.fullname,
        u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
      `,
      [req.params.id]
    );

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy nhật ký' });
    }

    res.json(log);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết nhật ký' });
  }
});

// ====================
// PHASE 1: SALARY MANAGEMENT APIs
// ====================

// Get all salaries
app.get('/api/salaries', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { month, driver_id } = req.query;
    let query = `
      SELECT 
        s.*,
        d.name as driver_name,
        u.fullname as created_by_name
      FROM driver_salaries s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (month) {
      query += ' AND s.salary_month = ?';
      params.push(month);
    }
    
    if (driver_id) {
      query += ' AND s.driver_id = ?';
      params.push(driver_id);
    }
    
    query += ' ORDER BY s.salary_month DESC, d.name ASC';
    
    const salaries = await dbAll(query, params);
    res.json(salaries);
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách lương' });
  }
});

// Calculate monthly salary for driver
app.post('/api/salaries/calculate', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { driver_id, salary_month, base_salary } = req.body;
    
    // Đếm số chuyến hoàn thành trong tháng
    const tripCountResult = await dbGet(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE driver_id = ?
        AND status = 'completed'
        AND strftime('%Y-%m', delivery_date) = ?
    `, [driver_id, salary_month]);
    
    const trip_count = tripCountResult.count || 0;
    
    // Lấy tổng thưởng/phạt trong tháng
    const bonusPenalty = await dbGet(`
      SELECT 
        SUM(CASE WHEN type = 'bonus' THEN amount ELSE 0 END) as total_bonus,
        SUM(CASE WHEN type = 'penalty' THEN amount ELSE 0 END) as total_penalty
      FROM driver_bonuses_penalties
      WHERE driver_id = ?
        AND strftime('%Y-%m', date) = ?
    `, [driver_id, salary_month]);
    
    const trip_bonus = bonusPenalty?.total_bonus || 0;
    const deductions = bonusPenalty?.total_penalty || 0;
    
    // Lấy tổng tạm ứng chưa quyết toán
    const advanceResult = await dbGet(`
      SELECT SUM(amount) as total_advance
      FROM driver_advances
      WHERE driver_id = ?
        AND settled = 0
        AND strftime('%Y-%m', advance_date) <= ?
    `, [driver_id, salary_month]);
    
    const advances_deducted = advanceResult?.total_advance || 0;
    
    // Tính lương
    const total_salary = (base_salary || 0) + trip_bonus - deductions - advances_deducted;
    
    res.json({
      driver_id,
      salary_month,
      base_salary: base_salary || 0,
      trip_count,
      trip_bonus,
      deductions,
      advances_deducted,
      total_salary,
      status: 'draft'
    });
  } catch (error) {
    console.error('Error calculating salary:', error);
    res.status(500).json({ error: 'Lỗi tính lương' });
  }
});

// Create salary record
app.post('/api/salaries', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { 
      driver_id, 
      salary_month, 
      base_salary, 
      overtime_hours, 
      overtime_pay, 
      notes 
    } = req.body;

    // Recompute to ensure consistency (client values can be stale)
    const tripCountResult = await dbGet(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE driver_id = ?
        AND status = 'completed'
        AND strftime('%Y-%m', delivery_date) = ?
    `, [driver_id, salary_month]);
    const computedTripCount = tripCountResult?.count || 0;

    const bonusPenalty = await dbGet(`
      SELECT 
        SUM(CASE WHEN type = 'bonus' THEN amount ELSE 0 END) as total_bonus,
        SUM(CASE WHEN type = 'penalty' THEN amount ELSE 0 END) as total_penalty
      FROM driver_bonuses_penalties
      WHERE driver_id = ?
        AND strftime('%Y-%m', date) = ?
    `, [driver_id, salary_month]);
    const computedTripBonus = bonusPenalty?.total_bonus || 0;
    const computedDeductions = bonusPenalty?.total_penalty || 0;

    const advanceResult = await dbGet(`
      SELECT SUM(amount) as total_advance
      FROM driver_advances
      WHERE driver_id = ?
        AND settled = 0
        AND strftime('%Y-%m', advance_date) <= ?
    `, [driver_id, salary_month]);
    const computedAdvancesDeducted = advanceResult?.total_advance || 0;

    const base = Number(base_salary) || 0;
    const overtimePay = Number(overtime_pay) || 0;
    const computedTotalSalary = base + computedTripBonus + overtimePay - computedDeductions - computedAdvancesDeducted;
    
    const result = await dbRun(`
      INSERT INTO driver_salaries 
      (driver_id, salary_month, base_salary, trip_count, trip_bonus, overtime_hours, overtime_pay, deductions, advances_deducted, total_salary, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `, [
      driver_id,
      salary_month,
      base,
      computedTripCount,
      computedTripBonus,
      Number(overtime_hours) || 0,
      overtimePay,
      computedDeductions,
      computedAdvancesDeducted,
      computedTotalSalary,
      notes,
      req.user.id
    ]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'salaries',
      result.lastID,
      null,
      { driver_id, salary_month, total_salary: computedTotalSalary },
      req.ip
    );
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating salary:', error);
    res.status(500).json({ error: 'Lỗi tạo bản lương' });
  }
});

// Update salary status (approve/pay)
app.put('/api/salaries/:id', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { status, paid_date, payment_method, notes } = req.body;
    
    const oldSalary = await dbGet('SELECT * FROM driver_salaries WHERE id = ?', [req.params.id]);
    if (!oldSalary) {
      return res.status(404).json({ error: 'Không tìm thấy bản lương' });
    }

    // Prevent rolling back after paid to avoid inconsistent settlements
    if (oldSalary.status === 'paid' && status !== 'paid') {
      return res.status(400).json({ error: 'Không thể đổi trạng thái sau khi đã trả lương' });
    }

    if (status === 'paid' && !paid_date) {
      return res.status(400).json({ error: 'Thiếu ngày trả lương (paid_date)' });
    }
    
    await dbRun(`
      UPDATE driver_salaries 
      SET status = ?, paid_date = ?, payment_method = ?, notes = ?
      WHERE id = ?
    `, [status, paid_date, payment_method, notes, req.params.id]);
    
    // Nếu đã trả lương, đánh dấu các tạm ứng là đã quyết toán (luôn chạy để không bỏ sót tạm ứng phát sinh sau khi tạo bản lương)
    if (status === 'paid') {
      await dbRun(`
        UPDATE driver_advances 
        SET settled = 1, settlement_date = ?, salary_id = ?
        WHERE driver_id = ? AND settled = 0 AND strftime('%Y-%m', advance_date) <= ?
      `, [paid_date, req.params.id, oldSalary.driver_id, oldSalary.salary_month]);
    }
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'salaries',
      req.params.id,
      { status: oldSalary.status },
      { status, paid_date },
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating salary:', error);
    res.status(500).json({ error: 'Lỗi cập nhật bản lương' });
  }
});

// Update salary details (base_salary, overtime, notes)
app.put('/api/salaries/:id/update-details', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { base_salary, overtime_hours, overtime_pay, notes } = req.body;
    
    const oldSalary = await dbGet('SELECT * FROM driver_salaries WHERE id = ?', [req.params.id]);
    if (!oldSalary) {
      return res.status(404).json({ error: 'Không tìm thấy bản lương' });
    }
    
    // Chỉ cho phép sửa khi ở trạng thái draft
    if (oldSalary.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ có thể sửa bản lương ở trạng thái nháp' });
    }
    
    // Tính lại tổng lương
    const new_total = (base_salary || oldSalary.base_salary) + 
                     (oldSalary.trip_bonus || 0) + 
                     (overtime_pay || 0) - 
                     (oldSalary.deductions || 0) - 
                     (oldSalary.advances_deducted || 0);
    
    await dbRun(`
      UPDATE driver_salaries 
      SET base_salary = ?, overtime_hours = ?, overtime_pay = ?, notes = ?, total_salary = ?
      WHERE id = ?
    `, [base_salary, overtime_hours || 0, overtime_pay || 0, notes, new_total, req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'salaries',
      req.params.id,
      oldSalary,
      { base_salary, overtime_hours, overtime_pay, total_salary: new_total },
      req.ip
    );
    
    res.json({ success: true, total_salary: new_total });
  } catch (error) {
    console.error('Error updating salary details:', error);
    res.status(500).json({ error: 'Lỗi cập nhật chi tiết lương' });
  }
});

// Delete salary
app.delete('/api/salaries/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const salary = await dbGet('SELECT * FROM driver_salaries WHERE id = ?', [req.params.id]);
    if (!salary) {
      return res.status(404).json({ error: 'Không tìm thấy bản lương' });
    }
    
    // Chỉ cho phép xóa khi ở trạng thái draft
    if (salary.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ có thể xóa bản lương ở trạng thái nháp' });
    }
    
    await dbRun('DELETE FROM driver_salaries WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'salaries',
      req.params.id,
      salary,
      null,
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting salary:', error);
    res.status(500).json({ error: 'Lỗi xóa bản lương' });
  }
});

// Get single salary (for edit)
app.get('/api/salaries/:id', authenticateToken, async (req, res) => {
  try {
    const salary = await dbGet(`
      SELECT 
        s.*,
        d.name as driver_name,
        d.phone as driver_phone
      FROM driver_salaries s
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE s.id = ?
    `, [req.params.id]);
    
    if (!salary) {
      return res.status(404).json({ error: 'Không tìm thấy bản lương' });
    }
    
    res.json(salary);
  } catch (error) {
    console.error('Error getting salary:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin lương' });
  }
});

// Get bonuses/penalties
app.get('/api/bonuses-penalties', authenticateToken, async (req, res) => {
  try {
    const { driver_id, month } = req.query;
    let query = `
      SELECT 
        bp.*,
        d.name as driver_name,
        o.order_code,
        u.fullname as approved_by_name
      FROM driver_bonuses_penalties bp
      LEFT JOIN drivers d ON bp.driver_id = d.id
      LEFT JOIN orders o ON bp.order_id = o.id
      LEFT JOIN users u ON bp.approved_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (driver_id) {
      query += ' AND bp.driver_id = ?';
      params.push(driver_id);
    }
    
    if (month) {
      query += ' AND strftime("%Y-%m", bp.date) = ?';
      params.push(month);
    }
    
    query += ' ORDER BY bp.date DESC';
    
    const records = await dbAll(query, params);
    res.json(records);
  } catch (error) {
    console.error('Error fetching bonuses/penalties:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách thưởng/phạt' });
  }
});

// Get single bonus/penalty
app.get('/api/bonuses-penalties/:id', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet(
      `
      SELECT 
        bp.*,
        d.name as driver_name,
        o.order_code,
        u.fullname as approved_by_name
      FROM driver_bonuses_penalties bp
      LEFT JOIN drivers d ON bp.driver_id = d.id
      LEFT JOIN orders o ON bp.order_id = o.id
      LEFT JOIN users u ON bp.approved_by = u.id
      WHERE bp.id = ?
      `,
      [req.params.id]
    );

    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }

    res.json(record);
  } catch (error) {
    console.error('Error fetching bonus/penalty:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết thưởng/phạt' });
  }
});

// Create bonus/penalty
app.post('/api/bonuses-penalties', authenticateToken, requireRole('admin', 'accountant', 'dispatcher'), async (req, res) => {
  try {
    const { driver_id, date, type, reason, amount, order_id, notes } = req.body;
    
    const result = await dbRun(`
      INSERT INTO driver_bonuses_penalties 
      (driver_id, date, type, reason, amount, order_id, approved_by, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [driver_id, date, type, reason, amount, order_id, req.user.id, notes, req.user.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'bonuses_penalties',
      result.lastID,
      null,
      { driver_id, type, amount, reason },
      req.ip
    );
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating bonus/penalty:', error);
    res.status(500).json({ error: 'Lỗi tạo thưởng/phạt' });
  }
});

// Delete bonus/penalty
app.delete('/api/bonuses-penalties/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM driver_bonuses_penalties WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    
    await dbRun('DELETE FROM driver_bonuses_penalties WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'bonuses_penalties',
      req.params.id,
      record,
      null,
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bonus/penalty:', error);
    res.status(500).json({ error: 'Lỗi xóa thưởng/phạt' });
  }
});

// ====================
// PHASE 1: VEHICLE MAINTENANCE APIs
// ====================

// Get all maintenance records
app.get('/api/maintenance', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        m.*,
        v.plate_number,
        u.fullname as created_by_name
      FROM vehicle_maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (vehicle_id) {
      query += ' AND m.vehicle_id = ?';
      params.push(vehicle_id);
    }
    
    query += ' ORDER BY m.maintenance_date DESC';
    
    const records = await dbAll(query, params);
    res.json(records);
  } catch (error) {
    console.error('Error fetching maintenance:', error);
    res.status(500).json({ error: 'Lỗi lấy lịch sử bảo dưỡng' });
  }
});

// Get single maintenance record
app.get('/api/maintenance/:id', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet(
      `
        SELECT
          m.*, v.plate_number, u.fullname as created_by_name
        FROM vehicle_maintenance m
        LEFT JOIN vehicles v ON m.vehicle_id = v.id
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.id = ?
      `,
      [req.params.id]
    );
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    res.json(record);
  } catch (error) {
    console.error('Error fetching maintenance detail:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết bảo dưỡng' });
  }
});

// Create maintenance record
app.post('/api/maintenance', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      vehicle_id, 
      maintenance_type, 
      maintenance_date, 
      odometer_reading, 
      cost, 
      next_due_date, 
      next_due_odometer, 
      garage, 
      invoice_number, 
      description, 
      notes 
    } = req.body;
    
    const result = await dbRun(`
      INSERT INTO vehicle_maintenance 
      (vehicle_id, maintenance_type, maintenance_date, odometer_reading, cost, next_due_date, next_due_odometer, garage, invoice_number, description, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [vehicle_id, maintenance_type, maintenance_date, odometer_reading, cost, next_due_date, next_due_odometer, garage, invoice_number, description, notes, req.user.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'maintenance',
      result.lastID,
      null,
      { vehicle_id, maintenance_type, cost },
      req.ip
    );
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating maintenance:', error);
    res.status(500).json({ error: 'Lỗi tạo bảo dưỡng' });
  }
});

// Update maintenance record
app.put('/api/maintenance/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
  try {
    const { 
      maintenance_type,
      maintenance_date, 
      odometer_reading, 
      cost, 
      next_due_date, 
      next_due_odometer, 
      garage, 
      invoice_number, 
      description, 
      notes 
    } = req.body;
    
    const oldRecord = await dbGet('SELECT * FROM vehicle_maintenance WHERE id = ?', [req.params.id]);
    if (!oldRecord) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    
    await dbRun(`
      UPDATE vehicle_maintenance 
      SET maintenance_type = COALESCE(?, maintenance_type),
          maintenance_date = ?,
          odometer_reading = ?,
          cost = ?,
          next_due_date = ?,
          next_due_odometer = ?,
          garage = ?,
          invoice_number = ?,
          description = ?,
          notes = ?
      WHERE id = ?
    `, [maintenance_type, maintenance_date, odometer_reading, cost, next_due_date, next_due_odometer, garage, invoice_number, description, notes, req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'maintenance',
      req.params.id,
      oldRecord,
      { maintenance_type, maintenance_date, cost },
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating maintenance:', error);
    res.status(500).json({ error: 'Lỗi cập nhật bảo dưỡng' });
  }
});

// Delete maintenance record
app.delete('/api/maintenance/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM vehicle_maintenance WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }
    
    await dbRun('DELETE FROM vehicle_maintenance WHERE id = ?', [req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'maintenance',
      req.params.id,
      record,
      null,
      req.ip
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting maintenance:', error);
    res.status(500).json({ error: 'Lỗi xóa bảo dưỡng' });
  }
});

// Get vehicle fees
app.get('/api/vehicle-fees', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    let query = `
      SELECT 
        f.*,
        v.plate_number,
        u.fullname as created_by_name
      FROM vehicle_fees f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (vehicle_id) {
      query += ' AND f.vehicle_id = ?';
      params.push(vehicle_id);
    }
    
    query += ' ORDER BY f.paid_date DESC';
    
    const fees = await dbAll(query, params);
    res.json(fees);
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({ error: 'Lỗi lấy danh sách phí' });
  }
});

// Get single vehicle fee
app.get('/api/vehicle-fees/:id', authenticateToken, async (req, res) => {
  try {
    const fee = await dbGet(
      `
      SELECT 
        f.*,
        v.plate_number,
        u.fullname as created_by_name
      FROM vehicle_fees f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
      `,
      [req.params.id]
    );

    if (!fee) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }

    res.json(fee);
  } catch (error) {
    console.error('Error fetching fee:', error);
    res.status(500).json({ error: 'Lỗi lấy chi tiết phí xe' });
  }
});

// Create vehicle fee
app.post('/api/vehicle-fees', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { vehicle_id, fee_type, amount, paid_date, valid_from, valid_to, receipt_number, notes } = req.body;
    
    const result = await dbRun(`
      INSERT INTO vehicle_fees 
      (vehicle_id, fee_type, amount, paid_date, valid_from, valid_to, receipt_number, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [vehicle_id, fee_type, amount, paid_date, valid_from, valid_to, receipt_number, notes, req.user.id]);
    
    // Cập nhật expiry trong bảng vehicles nếu là registration hoặc insurance
    if (fee_type === 'registration' && valid_to) {
      await dbRun('UPDATE vehicles SET registration_expiry = ? WHERE id = ?', [valid_to, vehicle_id]);
    } else if (fee_type === 'insurance' && valid_to) {
      await dbRun('UPDATE vehicles SET insurance_expiry = ? WHERE id = ?', [valid_to, vehicle_id]);
    }
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'vehicle_fees',
      result.lastID,
      null,
      { vehicle_id, fee_type, amount },
      req.ip
    );
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating fee:', error);
    res.status(500).json({ error: 'Lỗi tạo phí' });
  }
});

// Update vehicle fee
app.put('/api/vehicle-fees/:id', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { fee_type, amount, paid_date, valid_from, valid_to, receipt_number, notes } = req.body;

    const oldRecord = await dbGet('SELECT * FROM vehicle_fees WHERE id = ?', [req.params.id]);
    if (!oldRecord) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }

    await dbRun(
      `
        UPDATE vehicle_fees
        SET fee_type = ?,
            amount = ?,
            paid_date = ?,
            valid_from = ?,
            valid_to = ?,
            receipt_number = ?,
            notes = ?
        WHERE id = ?
      `,
      [fee_type, amount, paid_date, valid_from, valid_to, receipt_number, notes, req.params.id]
    );

    // Update expiry snapshot on vehicles (best-effort)
    if (fee_type === 'registration') {
      const maxValidTo = await dbGet(
        "SELECT MAX(valid_to) as max_valid_to FROM vehicle_fees WHERE vehicle_id = ? AND fee_type = 'registration' AND valid_to IS NOT NULL",
        [oldRecord.vehicle_id]
      );
      await dbRun('UPDATE vehicles SET registration_expiry = ? WHERE id = ?', [maxValidTo?.max_valid_to || null, oldRecord.vehicle_id]);
    } else if (fee_type === 'insurance') {
      const maxValidTo = await dbGet(
        "SELECT MAX(valid_to) as max_valid_to FROM vehicle_fees WHERE vehicle_id = ? AND fee_type = 'insurance' AND valid_to IS NOT NULL",
        [oldRecord.vehicle_id]
      );
      await dbRun('UPDATE vehicles SET insurance_expiry = ? WHERE id = ?', [maxValidTo?.max_valid_to || null, oldRecord.vehicle_id]);
    }

    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'vehicle_fees',
      req.params.id,
      oldRecord,
      { fee_type, amount, paid_date, valid_to },
      req.ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fee:', error);
    res.status(500).json({ error: 'Lỗi cập nhật phí' });
  }
});

// Delete vehicle fee
app.delete('/api/vehicle-fees/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM vehicle_fees WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy' });
    }

    await dbRun('DELETE FROM vehicle_fees WHERE id = ?', [req.params.id]);

    // Recompute expiry snapshot for the vehicle after delete (best-effort)
    const maxReg = await dbGet(
      "SELECT MAX(valid_to) as max_valid_to FROM vehicle_fees WHERE vehicle_id = ? AND fee_type = 'registration' AND valid_to IS NOT NULL",
      [record.vehicle_id]
    );
    const maxIns = await dbGet(
      "SELECT MAX(valid_to) as max_valid_to FROM vehicle_fees WHERE vehicle_id = ? AND fee_type = 'insurance' AND valid_to IS NOT NULL",
      [record.vehicle_id]
    );

    await dbRun('UPDATE vehicles SET registration_expiry = ?, insurance_expiry = ? WHERE id = ?', [
      maxReg?.max_valid_to || null,
      maxIns?.max_valid_to || null,
      record.vehicle_id
    ]);

    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'delete',
      'vehicle_fees',
      req.params.id,
      record,
      null,
      req.ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fee:', error);
    res.status(500).json({ error: 'Lỗi xóa phí' });
  }
});

// Get alerts for expiring registrations, insurance, and maintenance
app.get('/api/alerts/vehicle-expiry', authenticateToken, async (req, res) => {
  try {
    const alerts = [];
    
    // Kiểm tra đăng kiểm sắp hết hạn (30 ngày)
    const registrationExpiry = await dbAll(`
      SELECT id, plate_number, registration_expiry,
        julianday(registration_expiry) - julianday('now') as days_remaining
      FROM vehicles
      WHERE registration_expiry IS NOT NULL
        AND julianday(registration_expiry) - julianday('now') <= 30
        AND julianday(registration_expiry) - julianday('now') >= 0
      ORDER BY registration_expiry ASC
    `);
    
    registrationExpiry.forEach(v => {
      alerts.push({
        type: 'registration',
        severity: v.days_remaining <= 7 ? 'critical' : 'warning',
        vehicle_id: v.id,
        plate_number: v.plate_number,
        expiry_date: v.registration_expiry,
        days_remaining: Math.floor(v.days_remaining),
        message: `Đăng kiểm xe ${v.plate_number} sắp hết hạn (${Math.floor(v.days_remaining)} ngày)`
      });
    });
    
    // Kiểm tra bảo hiểm sắp hết hạn (30 ngày)
    const insuranceExpiry = await dbAll(`
      SELECT id, plate_number, insurance_expiry,
        julianday(insurance_expiry) - julianday('now') as days_remaining
      FROM vehicles
      WHERE insurance_expiry IS NOT NULL
        AND julianday(insurance_expiry) - julianday('now') <= 30
        AND julianday(insurance_expiry) - julianday('now') >= 0
      ORDER BY insurance_expiry ASC
    `);
    
    insuranceExpiry.forEach(v => {
      alerts.push({
        type: 'insurance',
        severity: v.days_remaining <= 7 ? 'critical' : 'warning',
        vehicle_id: v.id,
        plate_number: v.plate_number,
        expiry_date: v.insurance_expiry,
        days_remaining: Math.floor(v.days_remaining),
        message: `Bảo hiểm xe ${v.plate_number} sắp hết hạn (${Math.floor(v.days_remaining)} ngày)`
      });
    });
    
    // Kiểm tra bảo dưỡng sắp tới (15 ngày)
    const maintenanceDue = await dbAll(`
      SELECT 
        m.id,
        m.vehicle_id,
        m.maintenance_type,
        m.next_due_date,
        v.plate_number,
        julianday(m.next_due_date) - julianday('now') as days_remaining
      FROM vehicle_maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.next_due_date IS NOT NULL
        AND julianday(m.next_due_date) - julianday('now') <= 15
        AND julianday(m.next_due_date) - julianday('now') >= 0
      ORDER BY m.next_due_date ASC
    `);
    
    maintenanceDue.forEach(m => {
      alerts.push({
        type: 'maintenance',
        severity: m.days_remaining <= 3 ? 'warning' : 'info',
        vehicle_id: m.vehicle_id,
        plate_number: m.plate_number,
        maintenance_type: m.maintenance_type,
        due_date: m.next_due_date,
        days_remaining: Math.floor(m.days_remaining),
        message: `Xe ${m.plate_number} cần ${m.maintenance_type} (${Math.floor(m.days_remaining)} ngày)`
      });
    });
    
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Lỗi lấy cảnh báo' });
  }
});

// ===== PHASE 2 & 3: ADVANCED FEATURES =====

// ===== FUEL MANAGEMENT =====

// Get fuel records
app.get('/api/fuel-records', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, month } = req.query;
    let query = `
      SELECT 
        f.*,
        v.plate_number
      FROM fuel_records f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    
    if (vehicle_id) {
      query += ' AND f.vehicle_id = ?';
      params.push(vehicle_id);
    }
    
    if (month) {
      query += ' AND strftime("%Y-%m", f.fuel_date) = ?';
      params.push(month);
    }
    
    query += ' ORDER BY f.fuel_date DESC, f.id DESC';
    
    const records = await dbAll(query, params);
    res.json(records);
  } catch (error) {
    console.error('Error getting fuel records:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu nhiên liệu' });
  }
});

// Get fuel statistics
app.get('/api/fuel-records/stats', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, month } = req.query;
    let query = `
      SELECT 
        v.id as vehicle_id,
        v.plate_number,
        COUNT(f.id) as refuel_count,
        SUM(f.liters) as total_liters,
        SUM(f.total_cost) as total_cost,
        AVG(f.liters) as avg_liters_per_refuel,
        AVG(f.price_per_liter) as avg_price_per_liter,
        MAX(f.odometer_reading) - MIN(f.odometer_reading) as distance_traveled
      FROM fuel_records f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    
    if (vehicle_id) {
      query += ' AND f.vehicle_id = ?';
      params.push(vehicle_id);
    }
    
    if (month) {
      query += ' AND strftime("%Y-%m", f.fuel_date) = ?';
      params.push(month);
    }
    
    query += ' GROUP BY v.id, v.plate_number';
    
    const stats = await dbAll(query, params);
    
    // Tính tiêu hao nhiên liệu (L/100km)
    stats.forEach(s => {
      if (s.distance_traveled && s.distance_traveled > 0) {
        s.consumption_rate = (s.total_liters / s.distance_traveled) * 100;
      }
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting fuel stats:', error);
    res.status(500).json({ error: 'Lỗi lấy thống kê nhiên liệu' });
  }
});

// Get single fuel record
app.get('/api/fuel-records/:id', authenticateToken, async (req, res) => {
  try {
    const fuel = await dbGet('SELECT * FROM fuel_records WHERE id = ?', [req.params.id]);
    if (!fuel) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    res.json(fuel);
  } catch (error) {
    console.error('Error getting fuel record:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin' });
  }
});

// Create fuel record
app.post('/api/fuel-records', authenticateToken, requireRole('admin', 'dispatcher', 'accountant'), async (req, res) => {
  try {
    const { 
      vehicle_id, fuel_date, fuel_type, liters, price_per_liter, 
      total_cost, odometer_reading, station_name, receipt_number, notes 
    } = req.body;
    
    const result = await dbRun(`
      INSERT INTO fuel_records 
      (vehicle_id, fuel_date, fuel_type, liters, price_per_liter, total_cost, 
       odometer_reading, station_name, receipt_number, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [vehicle_id, fuel_date, fuel_type, liters, price_per_liter, total_cost,
        odometer_reading, station_name, receipt_number, notes, req.user.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'create', 'fuel_records',
      result.lastID, null, { vehicle_id, fuel_date, total_cost }, req.ip);
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating fuel record:', error);
    res.status(500).json({ error: 'Lỗi tạo bản ghi' });
  }
});

// Update fuel record
app.put('/api/fuel-records/:id', authenticateToken, requireRole('admin', 'dispatcher', 'accountant'), async (req, res) => {
  try {
    const { 
      vehicle_id, fuel_date, fuel_type, liters, price_per_liter, 
      total_cost, odometer_reading, station_name, receipt_number, notes 
    } = req.body;
    
    const oldRecord = await dbGet('SELECT * FROM fuel_records WHERE id = ?', [req.params.id]);
    if (!oldRecord) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    
    await dbRun(`
      UPDATE fuel_records 
      SET vehicle_id = ?, fuel_date = ?, fuel_type = ?, liters = ?, 
          price_per_liter = ?, total_cost = ?, odometer_reading = ?,
          station_name = ?, receipt_number = ?, notes = ?
      WHERE id = ?
    `, [vehicle_id, fuel_date, fuel_type, liters, price_per_liter, total_cost,
        odometer_reading, station_name, receipt_number, notes, req.params.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'update', 'fuel_records',
      req.params.id, oldRecord, { total_cost }, req.ip);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating fuel record:', error);
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Delete fuel record
app.delete('/api/fuel-records/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM fuel_records WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    
    await dbRun('DELETE FROM fuel_records WHERE id = ?', [req.params.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'delete', 'fuel_records',
      req.params.id, record, null, req.ip);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fuel record:', error);
    res.status(500).json({ error: 'Lỗi xóa bản ghi' });
  }
});

// ===== CASH FLOW =====

async function getConsolidatedCashFlow({ from, to }) {
  const buildDateFilter = (columnName) => {
    let clause = '';
    const params = [];
    if (from) {
      clause += ` AND ${columnName} >= ?`;
      params.push(from);
    }
    if (to) {
      clause += ` AND ${columnName} <= ?`;
      params.push(to);
    }
    return { clause, params };
  };

  const consolidated = [];

  // ========== THU (TIỀN THỰC TẾ NHẬN ĐƯỢC) ==========
  // 1. Thanh toán từ khách hàng (payments)
  try {
    const df = buildDateFilter('p.payment_date');
    const payments = await dbAll(`
      SELECT 
        'income' as type,
        'Thanh toán từ khách' as category,
        c.name || ' - ' || o.order_code || CASE 
          WHEN p.payment_method THEN ' (' || p.payment_method || ')'
          ELSE ''
        END as description,
        p.amount,
        p.payment_date as transaction_date,
        'PAY-' || p.id as reference,
        'payment' as source
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      WHERE p.payment_date IS NOT NULL
        ${df.clause}
      ORDER BY p.payment_date DESC
    `, df.params);
    if (payments && payments.length > 0) consolidated.push(...payments);
  } catch (e) { console.log('Skip payments:', e.message); }

  // ========== CHI (TẤT CẢ CHI PHÍ THỰC TẾ) ==========
  // 2. Lương tài xế đã trả
  try {
    const df = buildDateFilter('s.paid_date');
    const salaries = await dbAll(`
      SELECT 
        'expense' as type,
        'Lương tài xế' as category,
        d.name || ' - Tháng ' || s.salary_month as description,
        s.total_salary as amount,
        s.paid_date as transaction_date,
        'SALARY-' || s.id as reference,
        'salary' as source
      FROM driver_salaries s
      JOIN drivers d ON s.driver_id = d.id
      WHERE s.status = 'paid' AND s.paid_date IS NOT NULL
        ${df.clause}
      ORDER BY s.paid_date DESC
    `, df.params);
    if (salaries && salaries.length > 0) consolidated.push(...salaries);
  } catch (e) { console.log('Skip salaries:', e.message); }

  // 3. Nhiên liệu
  try {
    const df = buildDateFilter('fr.fuel_date');
    const fuel = await dbAll(`
      SELECT 
        'expense' as type,
        'Nhiên liệu' as category,
        v.plate_number || ' - ' || fr.liters || 'L @ ' || fr.price_per_liter || 'đ/L' as description,
        fr.total_cost as amount,
        fr.fuel_date as transaction_date,
        'FUEL-' || fr.id as reference,
        'fuel' as source
      FROM fuel_records fr
      JOIN vehicles v ON fr.vehicle_id = v.id
      WHERE fr.fuel_date IS NOT NULL
        ${df.clause}
      ORDER BY fr.fuel_date DESC
    `, df.params);
    if (fuel && fuel.length > 0) consolidated.push(...fuel);
  } catch (e) { console.log('Skip fuel:', e.message); }

  // 4. Bảo dưỡng xe
  try {
    const df = buildDateFilter('m.maintenance_date');
    const maintenance = await dbAll(`
      SELECT 
        'expense' as type,
        'Bảo dưỡng xe' as category,
        v.plate_number || ' - ' || m.maintenance_type as description,
        m.cost as amount,
        m.maintenance_date as transaction_date,
        'MAINT-' || m.id as reference,
        'maintenance' as source
      FROM vehicle_maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.maintenance_date IS NOT NULL
        ${df.clause}
      ORDER BY m.maintenance_date DESC
    `, df.params);
    if (maintenance && maintenance.length > 0) consolidated.push(...maintenance);
  } catch (e) { console.log('Skip maintenance:', e.message); }

  // 4b. Phí xe (đăng kiểm/bảo hiểm/...) đã trả
  try {
    const df = buildDateFilter('f.paid_date');
    const vehicleFees = await dbAll(`
      SELECT
        'expense' as type,
        'Phí xe' as category,
        v.plate_number || ' - ' || f.fee_type as description,
        f.amount as amount,
        f.paid_date as transaction_date,
        'VFE-' || f.id as reference,
        'vehicle_fee' as source
      FROM vehicle_fees f
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.paid_date IS NOT NULL
        ${df.clause}
      ORDER BY f.paid_date DESC
    `, df.params);
    if (vehicleFees && vehicleFees.length > 0) consolidated.push(...vehicleFees);
  } catch (e) { console.log('Skip vehicle fees:', e.message); }

  // 5. Chi phí chuyến (trip_costs)
  try {
    const dateExpr = `COALESCE(tc.cost_date, o.delivery_date, o.order_date)`;
    const df = buildDateFilter(dateExpr);
    const tripCosts = await dbAll(`
      SELECT 
        'expense' as type,
        tc.cost_type as category,
        o.order_code || ' - ' || COALESCE(tc.notes, tc.receipt_number, tc.cost_type) as description,
        tc.amount,
        ${dateExpr} as transaction_date,
        'COST-' || tc.id as reference,
        'trip_cost' as source
      FROM trip_costs tc
      JOIN orders o ON tc.order_id = o.id
      WHERE 1=1
        ${df.clause}
      ORDER BY transaction_date DESC
    `, df.params);
    if (tripCosts && tripCosts.length > 0) consolidated.push(...tripCosts);
  } catch (e) { console.log('Skip trip_costs:', e.message); }

  // 6. Tạm ứng cho tài xế
  try {
    const df = buildDateFilter('da.advance_date');
    const advances = await dbAll(`
      SELECT 
        'expense' as type,
        'Tạm ứng tài xế' as category,
        d.name || ' - ' || COALESCE(da.purpose, da.notes, 'Tạm ứng') as description,
        da.amount,
        da.advance_date as transaction_date,
        'ADV-' || da.id as reference,
        'advance' as source
      FROM driver_advances da
      JOIN drivers d ON da.driver_id = d.id
      WHERE da.advance_date IS NOT NULL
        ${df.clause}
      ORDER BY da.advance_date DESC
    `, df.params);
    if (advances && advances.length > 0) consolidated.push(...advances);
  } catch (e) { console.log('Skip advances:', e.message); }

  // 7. Thu/Chi thủ công khác (ngoài hệ thống)
  try {
    const df = buildDateFilter('transaction_date');
    const manual = await dbAll(`
      SELECT 
        type,
        category,
        description,
        amount,
        transaction_date,
        'MANUAL-' || id as reference,
        'manual' as source
      FROM cash_flow
      WHERE 1=1
        ${df.clause}
      ORDER BY transaction_date DESC
    `, df.params);
    if (manual && manual.length > 0) consolidated.push(...manual);
  } catch (e) { console.log('Skip cash_flow:', e.message); }

  consolidated.sort((a, b) => {
    const dateA = new Date(a.transaction_date || '1970-01-01');
    const dateB = new Date(b.transaction_date || '1970-01-01');
    return dateB - dateA;
  });

  return consolidated;
}

// Get consolidated cash flow (TỰ ĐỘNG tổng hợp từ tất cả nguồn)
app.get('/api/cash-flow/consolidated', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const consolidated = await getConsolidatedCashFlow({ from, to });
    res.json(consolidated);
  } catch (error) {
    console.error('Error getting consolidated cash flow:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu dòng tiền tổng hợp: ' + error.message });
  }
});

// Get manual cash flow records (chỉ các khoản nhập thủ công)
app.get('/api/cash-flow', authenticateToken, async (req, res) => {
  try {
    const { type, from, to } = req.query;
    let query = `
      SELECT 
        cf.*,
        o.order_code,
        d.name as driver_name,
        v.plate_number
      FROM cash_flow cf
      LEFT JOIN orders o ON cf.order_id = o.id
      LEFT JOIN drivers d ON cf.driver_id = d.id
      LEFT JOIN vehicles v ON cf.vehicle_id = v.id
      WHERE 1=1
    `;
    const params = [];
    
    if (type) {
      query += ' AND cf.type = ?';
      params.push(type);
    }
    
    if (from) {
      query += ' AND cf.transaction_date >= ?';
      params.push(from);
    }
    
    if (to) {
      query += ' AND cf.transaction_date <= ?';
      params.push(to);
    }
    
    query += ' ORDER BY cf.transaction_date DESC, cf.id DESC';
    
    const records = await dbAll(query, params);
    res.json(records);
  } catch (error) {
    console.error('Error getting cash flow:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu dòng tiền' });
  }
});

// Get single cash flow record
app.get('/api/cash-flow/:id', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM cash_flow WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    res.json(record);
  } catch (error) {
    console.error('Error getting cash flow record:', error);
    res.status(500).json({ error: 'Lỗi lấy thông tin' });
  }
});

// Create cash flow record
app.post('/api/cash-flow', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { 
      transaction_date, type, category, amount, description,
      payment_method, reference_number, order_id, driver_id, vehicle_id, notes,
      transaction_group, category_details
    } = req.body;
    
    const result = await dbRun(`
      INSERT INTO cash_flow 
      (transaction_date, type, category, amount, description, payment_method,
       reference_number, order_id, driver_id, vehicle_id, notes, transaction_group, 
       category_details, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [transaction_date, type, category, amount, description, payment_method,
        reference_number, order_id, driver_id, vehicle_id, notes, transaction_group,
        category_details, req.user.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'create', 'cash_flow',
      result.lastID, null, { type, category, amount }, req.ip);
    
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    console.error('Error creating cash flow:', error);
    res.status(500).json({ error: 'Lỗi tạo bản ghi' });
  }
});

// Update cash flow record
app.put('/api/cash-flow/:id', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { 
      transaction_date, type, category, amount, description,
      payment_method, reference_number, order_id, driver_id, vehicle_id, notes,
      transaction_group, category_details
    } = req.body;
    
    const oldRecord = await dbGet('SELECT * FROM cash_flow WHERE id = ?', [req.params.id]);
    if (!oldRecord) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    
    await dbRun(`
      UPDATE cash_flow 
      SET transaction_date = ?, type = ?, category = ?, amount = ?,
          description = ?, payment_method = ?, reference_number = ?,
          order_id = ?, driver_id = ?, vehicle_id = ?, notes = ?,
          transaction_group = ?, category_details = ?
      WHERE id = ?
    `, [transaction_date, type, category, amount, description, payment_method,
        reference_number, order_id, driver_id, vehicle_id, notes, transaction_group,
        category_details, req.params.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'update', 'cash_flow',
      req.params.id, oldRecord, { amount }, req.ip);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating cash flow:', error);
    res.status(500).json({ error: 'Lỗi cập nhật' });
  }
});

// Delete cash flow record
app.delete('/api/cash-flow/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const record = await dbGet('SELECT * FROM cash_flow WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi' });
    }
    
    await dbRun('DELETE FROM cash_flow WHERE id = ?', [req.params.id]);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'delete', 'cash_flow',
      req.params.id, record, null, req.ip);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting cash flow:', error);
    res.status(500).json({ error: 'Lỗi xóa bản ghi' });
  }
});

// ====================
// PHASE 2.3: EXPENSE REPORTS
// ====================

app.get('/api/expense-reports', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, from, to } = req.query;
    const normalizeMonthToDate = (value, isEnd) => {
      if (!value) return null;
      const str = String(value);
      if (/^\d{4}-\d{2}$/.test(str)) {
        if (!isEnd) return `${str}-01`;
        const [y, m] = str.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return `${str}-${String(lastDay).padStart(2, '0')}`;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      return str;
    };

    const fromDate = normalizeMonthToDate(from, false);
    const toDate = normalizeMonthToDate(to, true);

    const buildRange = (columnName, params) => {
      const clauses = [];
      if (fromDate) {
        clauses.push(`${columnName} >= ?`);
        params.push(fromDate);
      }
      if (toDate) {
        clauses.push(`${columnName} <= ?`);
        params.push(toDate);
      }
      return clauses.length ? ` AND ${clauses.join(' AND ')}` : '';
    };

    const fuelParams = [];
    const maintenanceParams = [];
    const feeParams = [];

    const fuelSubquery = `
      SELECT vehicle_id, COALESCE(SUM(total_cost), 0) AS fuel_cost
      FROM fuel_records
      WHERE fuel_date IS NOT NULL
      ${buildRange('fuel_date', fuelParams)}
      GROUP BY vehicle_id
    `;

    const maintenanceSubquery = `
      SELECT vehicle_id, COALESCE(SUM(cost), 0) AS maintenance_cost
      FROM vehicle_maintenance
      WHERE maintenance_date IS NOT NULL
      ${buildRange('maintenance_date', maintenanceParams)}
      GROUP BY vehicle_id
    `;

    const feeDateExpr = `COALESCE(paid_date, substr(created_at, 1, 10))`;
    const feeSubquery = `
      SELECT vehicle_id, COALESCE(SUM(amount), 0) AS fee_cost
      FROM vehicle_fees
      WHERE ${feeDateExpr} IS NOT NULL
      ${buildRange(feeDateExpr, feeParams)}
      GROUP BY vehicle_id
    `;

    let query = `
      SELECT
        v.id as vehicle_id,
        v.plate_number,
        COALESCE(fr.fuel_cost, 0) as fuel_cost,
        COALESCE(vm.maintenance_cost, 0) as maintenance_cost,
        COALESCE(vf.fee_cost, 0) as fee_cost,
        (COALESCE(fr.fuel_cost, 0) + COALESCE(vm.maintenance_cost, 0) + COALESCE(vf.fee_cost, 0)) as total_expenses
      FROM vehicles v
      LEFT JOIN (${fuelSubquery}) fr ON v.id = fr.vehicle_id
      LEFT JOIN (${maintenanceSubquery}) vm ON v.id = vm.vehicle_id
      LEFT JOIN (${feeSubquery}) vf ON v.id = vf.vehicle_id
      WHERE 1=1
    `;

    const params = [...fuelParams, ...maintenanceParams, ...feeParams];
    if (vehicle_id) {
      query += ' AND v.id = ?';
      params.push(vehicle_id);
    }

    query += ' ORDER BY total_expenses DESC';
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        console.error('Lỗi query expense reports:', err);
        return res.status(500).json({ error: 'Lỗi lấy báo cáo chi phí' });
      }
      
      // Tính lương tài xế cho mỗi xe dựa trên các đơn hàng
      const salaryFrom = from ? String(from).substring(0, 7) : null;
      const salaryTo = to ? String(to).substring(0, 7) : null;
      for (let row of rows) {
        let salaryQuery = `
          SELECT COALESCE(SUM(ds.total_salary), 0) as salary_cost
          FROM driver_salaries ds
          WHERE ds.driver_id IN (
            SELECT DISTINCT driver_id 
            FROM orders 
            WHERE vehicle_id = ?
          )
        `;
        const salaryParams = [row.vehicle_id];
        
        if (salaryFrom) {
          salaryQuery += ` AND ds.salary_month >= ?`;
          salaryParams.push(salaryFrom);
        }
        if (salaryTo) {
          salaryQuery += ` AND ds.salary_month <= ?`;
          salaryParams.push(salaryTo);
        }
        
        const salaryResult = await new Promise((resolve, reject) => {
          db.get(salaryQuery, salaryParams, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        row.salary_cost = salaryResult?.salary_cost || 0;
        row.total_expenses = row.total_expenses + row.salary_cost;
      }
      
      // Sắp xếp lại theo tổng chi phí
      rows.sort((a, b) => b.total_expenses - a.total_expenses);
      
      res.json(rows);
    });
  } catch (error) {
    console.error('Lỗi expense reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================
// EXPORT EXCEL APIs
// ====================

const {
  exportFuelReport,
  exportCashFlowReport,
  exportCashFlowConsolidatedReport,
  exportExpenseReport,
  exportQuoteReport,
  exportTableWorkbook,
  exportMultiSheetWorkbook
} = require('./excel-export');

function sendExcelBuffer(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// Export báo cáo nhiên liệu
app.get('/api/export/fuel-records', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, month } = req.query;
    
    // Lấy tên xe nếu có vehicle_id
    let vehicle_name = '';
    if (vehicle_id) {
      const vehicle = await new Promise((resolve, reject) => {
        db.get('SELECT plate_number FROM vehicles WHERE id = ?', [vehicle_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      vehicle_name = vehicle?.plate_number || '';
    }
    
    const buffer = await exportFuelReport(db, { vehicle_id, month, vehicle_name });
    
    const filename = `BaoCaoNhienLieu_${month || 'TatCa'}_${Date.now()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'fuel_records', 
      null, null, { filters: { vehicle_id, month } }, req.ip);
  } catch (error) {
    console.error('Lỗi export fuel records:', error);
    res.status(500).json({ error: 'Lỗi xuất báo cáo' });
  }
});

// Export báo cáo dòng tiền
app.get('/api/export/cash-flow', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { type, from, to } = req.query;

    const consolidated = await getConsolidatedCashFlow({ from, to });
    const buffer = await exportCashFlowConsolidatedReport(consolidated, { type, from, to });
    
    const filename = `BaoCaoDongTien_${from || 'Dau'}_${to || 'Cuoi'}_${Date.now()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'cash_flow',
      null, null, { filters: { type, from, to } }, req.ip);
  } catch (error) {
    console.error('Lỗi export cash flow:', error);
    res.status(500).json({ error: 'Lỗi xuất báo cáo' });
  }
});

// Export báo cáo chi phí vận hành
app.get('/api/export/expense-reports', authenticateToken, requireRole('admin', 'accountant', 'dispatcher'), async (req, res) => {
  try {
    const { vehicle_id, from, to } = req.query;
    
    const buffer = await exportExpenseReport(db, { vehicle_id, from, to });
    
    const filename = `BaoCaoChiPhiVanHanh_${from || 'Dau'}_${to || 'Cuoi'}_${Date.now()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'expense_reports',
      null, null, { filters: { vehicle_id, from, to } }, req.ip);
  } catch (error) {
    console.error('Lỗi export expense reports:', error);
    res.status(500).json({ error: 'Lỗi xuất báo cáo' });
  }
});

// Export báo giá (Excel)
app.get('/api/export/quotes/:id/excel', authenticateToken, async (req, res) => {
  try {
    const { company_name, director_name } = req.query;
    const buffer = await exportQuoteReport(db, req.params.id, { company_name, director_name });

    const filename = `BaoGia_${req.params.id}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'quotes',
      req.params.id, null, { type: 'excel' }, req.ip);
  } catch (error) {
    console.error('Lỗi export quote:', error);
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Không tìm thấy báo giá' });
    }
    res.status(500).json({ error: 'Lỗi xuất báo giá' });
  }
});

// ====================
// EXPORT EXCEL: MASTER DATA + MODULE LIST/DETAIL
// ====================

// Drivers (list)
app.get('/api/export/drivers', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, name, phone, license_number, license_type, license_expiry, id_number, status, notes, created_at
      FROM drivers
      ORDER BY created_at DESC
    `);

    const buffer = await exportTableWorkbook({
      sheetName: 'Tài xế',
      title: 'DANH SÁCH TÀI XẾ',
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Họ tên', key: 'name', width: 22 },
        { header: 'Điện thoại', key: 'phone', width: 14 },
        { header: 'GPLX', key: 'license_number', width: 16 },
        { header: 'Loại', key: 'license_type', width: 8 },
        { header: 'Hạn GPLX', key: 'license_expiry', width: 12 },
        { header: 'CMND/CCCD', key: 'id_number', width: 14 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 28 }
      ],
      rows
    });

    sendExcelBuffer(res, `DanhSachTaiXe_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'drivers', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export drivers error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel tài xế' });
  }
});

// Drivers (detail)
app.get('/api/export/drivers/:id/excel', authenticateToken, async (req, res) => {
  try {
    const driver = await dbGet('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) return res.status(404).json({ error: 'Không tìm thấy tài xế' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Tài xế',
      title: `CHI TIẾT TÀI XẾ - ${driver.name || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Họ tên', key: 'name', width: 22 },
        { header: 'Điện thoại', key: 'phone', width: 14 },
        { header: 'CMND/CCCD', key: 'id_number', width: 14 },
        { header: 'GPLX', key: 'license_number', width: 16 },
        { header: 'Loại', key: 'license_type', width: 8 },
        { header: 'Hạn GPLX', key: 'license_expiry', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 28 }
      ],
      rows: [driver]
    });

    sendExcelBuffer(res, `TaiXe_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'drivers', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export driver detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết tài xế' });
  }
});

// Vehicles (list)
app.get('/api/export/vehicles', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, plate_number, vehicle_type, status, registration_expiry, insurance_expiry, created_at
      FROM vehicles
      ORDER BY created_at DESC
    `);

    const buffer = await exportTableWorkbook({
      sheetName: 'Xe',
      title: 'DANH SÁCH XE ĐẦU KÉO',
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Biển số', key: 'plate_number', width: 14 },
        { header: 'Loại xe', key: 'vehicle_type', width: 16 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Hạn đăng kiểm', key: 'registration_expiry', width: 14 },
        { header: 'Hạn bảo hiểm', key: 'insurance_expiry', width: 14 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows
    });

    sendExcelBuffer(res, `DanhSachXe_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'vehicles', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export vehicles error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel xe' });
  }
});

// Vehicles (detail)
app.get('/api/export/vehicles/:id/excel', authenticateToken, async (req, res) => {
  try {
    const vehicle = await dbGet('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (!vehicle) return res.status(404).json({ error: 'Không tìm thấy xe' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Xe',
      title: `CHI TIẾT XE - ${vehicle.plate_number || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Biển số', key: 'plate_number', width: 14 },
        { header: 'Loại xe', key: 'vehicle_type', width: 16 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Hạn đăng kiểm', key: 'registration_expiry', width: 14 },
        { header: 'Hạn bảo hiểm', key: 'insurance_expiry', width: 14 },
        { header: 'Ghi chú', key: 'notes', width: 28 }
      ],
      rows: [vehicle]
    });

    sendExcelBuffer(res, `Xe_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'vehicles', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export vehicle detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết xe' });
  }
});

// Containers (list)
app.get('/api/export/containers', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id, container_number, container_type, status, notes, created_at
      FROM containers
      ORDER BY created_at DESC
    `);

    const buffer = await exportTableWorkbook({
      sheetName: 'Container',
      title: 'DANH SÁCH CONTAINER',
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Số container', key: 'container_number', width: 16 },
        { header: 'Loại', key: 'container_type', width: 10 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 28 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows
    });

    sendExcelBuffer(res, `DanhSachContainer_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'containers', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export containers error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel container' });
  }
});

// Containers (detail)
app.get('/api/export/containers/:id/excel', authenticateToken, async (req, res) => {
  try {
    const container = await dbGet('SELECT * FROM containers WHERE id = ?', [req.params.id]);
    if (!container) return res.status(404).json({ error: 'Không tìm thấy container' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Container',
      title: `CHI TIẾT CONTAINER - ${container.container_number || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Số container', key: 'container_number', width: 16 },
        { header: 'Loại', key: 'container_type', width: 10 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 28 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows: [container]
    });

    sendExcelBuffer(res, `Container_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'containers', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export container detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết container' });
  }
});

// Routes (list)
app.get('/api/export/routes', authenticateToken, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT id,
        COALESCE(route_name, TRIM(COALESCE(origin, '') || ' - ' || COALESCE(destination, ''))) AS route_name,
        origin, destination, distance_km, estimated_hours, created_at
      FROM routes
      ORDER BY created_at DESC
    `);

    const buffer = await exportTableWorkbook({
      sheetName: 'Tuyến',
      title: 'DANH SÁCH TUYẾN ĐƯỜNG',
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Tên tuyến', key: 'route_name', width: 28 },
        { header: 'Điểm đi', key: 'origin', width: 18 },
        { header: 'Điểm đến', key: 'destination', width: 18 },
        { header: 'Khoảng cách (km)', key: 'distance_km', width: 16, numFmt: '#,##0' },
        { header: 'Giờ dự kiến', key: 'estimated_hours', width: 12 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows
    });

    sendExcelBuffer(res, `DanhSachTuyen_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'routes', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export routes error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel tuyến đường' });
  }
});

// Routes (detail)
app.get('/api/export/routes/:id/excel', authenticateToken, async (req, res) => {
  try {
    const route = await dbGet('SELECT * FROM routes WHERE id = ?', [req.params.id]);
    if (!route) return res.status(404).json({ error: 'Không tìm thấy tuyến' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Tuyến',
      title: `CHI TIẾT TUYẾN - ${route.route_name || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Tên tuyến', key: 'route_name', width: 28 },
        { header: 'Điểm đi', key: 'origin', width: 18 },
        { header: 'Điểm đến', key: 'destination', width: 18 },
        { header: 'Khoảng cách (km)', key: 'distance_km', width: 16, numFmt: '#,##0' },
        { header: 'Giờ dự kiến', key: 'estimated_hours', width: 12 }
      ],
      rows: [route]
    });

    sendExcelBuffer(res, `Tuyen_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'routes', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export route detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết tuyến' });
  }
});

// Customers (list)
app.get('/api/export/customers', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let q = 'SELECT id, name, contact_person, phone, email, tax_code, address, status, credit_limit, current_debt, created_at FROM customers WHERE 1=1';
    if (status) {
      q += ' AND status = ?';
      params.push(status);
    }
    q += ' ORDER BY created_at DESC';

    const rows = await dbAll(q, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Khách hàng',
      title: 'DANH SÁCH KHÁCH HÀNG',
      metaLines: status ? [`Trạng thái: ${status}`] : [],
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Tên công ty', key: 'name', width: 26 },
        { header: 'Người liên hệ', key: 'contact_person', width: 18 },
        { header: 'Điện thoại', key: 'phone', width: 14 },
        { header: 'Email', key: 'email', width: 22 },
        { header: 'MST', key: 'tax_code', width: 14 },
        { header: 'Hạn mức', key: 'credit_limit', width: 14, numFmt: '#,##0' },
        { header: 'Công nợ', key: 'current_debt', width: 14, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 12 }
      ],
      rows
    });
    sendExcelBuffer(res, `DanhSachKhachHang_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'customers', null, null, { scope: 'list', status }, req.ip);
  } catch (error) {
    console.error('Export customers error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel khách hàng' });
  }
});

// Customers (detail)
app.get('/api/export/customers/:id/excel', authenticateToken, async (req, res) => {
  try {
    const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Khách hàng',
      title: `CHI TIẾT KHÁCH HÀNG - ${customer.name || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Tên công ty', key: 'name', width: 26 },
        { header: 'Người liên hệ', key: 'contact_person', width: 18 },
        { header: 'Điện thoại', key: 'phone', width: 14 },
        { header: 'Email', key: 'email', width: 22 },
        { header: 'MST', key: 'tax_code', width: 14 },
        { header: 'Địa chỉ', key: 'address', width: 30 },
        { header: 'Hạn mức', key: 'credit_limit', width: 14, numFmt: '#,##0' },
        { header: 'Công nợ', key: 'current_debt', width: 14, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 28 }
      ],
      rows: [customer]
    });
    sendExcelBuffer(res, `KhachHang_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'customers', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export customer detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết khách hàng' });
  }
});

// Orders (list)
app.get('/api/export/orders', authenticateToken, async (req, res) => {
  try {
    const { customer_id, from_date, to_date, status } = req.query;
    const params = [];
    let query = `
      SELECT o.*, 
        c.name as customer_name,
        d.name as driver_name,
        v.plate_number as vehicle_plate,
        cn.container_number,
        COALESCE(r.route_name, TRIM(COALESCE(r.origin, '') || ' - ' || COALESCE(r.destination, ''))) AS route_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN containers cn ON o.container_id = cn.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE 1=1
    `;
    if (customer_id) {
      query += ' AND o.customer_id = ?';
      params.push(customer_id);
    }
    if (from_date) {
      query += ' AND o.order_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND o.order_date <= ?';
      params.push(to_date);
    }
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    query += ' ORDER BY o.order_date DESC';

    const rows = await dbAll(query, params);
    const metaLines = [];
    if (from_date || to_date) metaLines.push(`Từ ngày: ${from_date || ''}  Đến ngày: ${to_date || ''}`.trim());
    if (status) metaLines.push(`Trạng thái: ${status}`);
    if (customer_id) metaLines.push(`Customer ID: ${customer_id}`);

    const buffer = await exportTableWorkbook({
      sheetName: 'Đơn hàng',
      title: 'DANH SÁCH ĐƠN HÀNG',
      metaLines,
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Mã đơn', key: 'order_code', width: 14 },
        { header: 'Khách hàng', key: 'customer_name', width: 22 },
        { header: 'Tuyến', key: 'route_name', width: 22 },
        { header: 'Container', key: 'container_number', width: 14 },
        { header: 'Xe', key: 'vehicle_plate', width: 12 },
        { header: 'Tài xế', key: 'driver_name', width: 18 },
        { header: 'Ngày', key: 'order_date', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Cước', key: 'price', width: 14, numFmt: '#,##0' },
        { header: 'Tổng (VAT)', key: 'final_amount', width: 14, numFmt: '#,##0' }
      ],
      rows
    });

    sendExcelBuffer(res, `DanhSachDonHang_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'orders', null, null, { scope: 'list', filters: { customer_id, from_date, to_date, status } }, req.ip);
  } catch (error) {
    console.error('Export orders error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel đơn hàng' });
  }
});

// Orders (detail) - multi sheets
app.get('/api/export/orders/:id/excel', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await dbGet(`
      SELECT o.*, 
        c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
        d.name as driver_name, d.phone as driver_phone,
        v.plate_number as vehicle_plate,
        cn.container_number,
        COALESCE(r.route_name, TRIM(COALESCE(r.origin, '') || ' - ' || COALESCE(r.destination, ''))) AS route_name,
        r.origin, r.destination
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN drivers d ON o.driver_id = d.id
      LEFT JOIN vehicles v ON o.vehicle_id = v.id
      LEFT JOIN containers cn ON o.container_id = cn.id
      LEFT JOIN routes r ON o.route_id = r.id
      WHERE o.id = ?
    `, [orderId]);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

    const costs = await dbAll('SELECT * FROM trip_costs WHERE order_id = ? ORDER BY id ASC', [orderId]);
    const payments = await dbAll('SELECT * FROM payments WHERE order_id = ? ORDER BY payment_date DESC, id DESC', [orderId]);
    const advances = await dbAll('SELECT * FROM driver_advances WHERE order_id = ? ORDER BY advance_date DESC, id DESC', [orderId]);
    const documents = await dbAll('SELECT * FROM documents WHERE order_id = ? ORDER BY uploaded_at DESC, id DESC', [orderId]);

    const buffer = await exportMultiSheetWorkbook({
      title: `CHI TIẾT ĐƠN HÀNG - ${order.order_code}`,
      metaLines: [
        `Mã đơn: ${order.order_code}`,
        `Khách hàng: ${order.customer_name || ''}`,
        `Ngày: ${order.order_date || ''}`
      ],
      sheets: [
        {
          name: 'Đơn hàng',
          title: `THÔNG TIN ĐƠN HÀNG - ${order.order_code}`,
          columns: [
            { header: 'Mã đơn', key: 'order_code', width: 14 },
            { header: 'Khách hàng', key: 'customer_name', width: 24 },
            { header: 'Tuyến', key: 'route_name', width: 24 },
            { header: 'Container', key: 'container_number', width: 14 },
            { header: 'Xe', key: 'vehicle_plate', width: 12 },
            { header: 'Tài xế', key: 'driver_name', width: 18 },
            { header: 'Ngày', key: 'order_date', width: 12 },
            { header: 'Trạng thái', key: 'status', width: 12 },
            { header: 'Cước', key: 'price', width: 14, numFmt: '#,##0' },
            { header: 'Néo xe', key: 'neo_xe', width: 14, numFmt: '#,##0' },
            { header: 'Chi hộ', key: 'chi_ho', width: 14, numFmt: '#,##0' },
            { header: 'Tổng (VAT)', key: 'final_amount', width: 14, numFmt: '#,##0' }
          ],
          rows: [order]
        },
        {
          name: 'Chi phí',
          title: `CHI PHÍ CHUYẾN - ${order.order_code}`,
          columns: [
            { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
            { header: 'Loại', key: 'cost_type', width: 14 },
            { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
            { header: 'Ngày', key: 'cost_date', width: 12 },
            { header: 'Mô tả', key: 'description', width: 30 }
          ],
          rows: costs
        },
        {
          name: 'Thanh toán',
          title: `THANH TOÁN - ${order.order_code}`,
          columns: [
            { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
            { header: 'Ngày', key: 'payment_date', width: 12 },
            { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
            { header: 'Phương thức', key: 'payment_method', width: 14 },
            { header: 'Ghi chú', key: 'notes', width: 30 }
          ],
          rows: payments
        },
        {
          name: 'Tạm ứng',
          title: `TẠM ỨNG - ${order.order_code}`,
          columns: [
            { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
            { header: 'Ngày', key: 'advance_date', width: 12 },
            { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
            { header: 'Đã QT', key: 'settled', width: 10 },
            { header: 'Ghi chú', key: 'notes', width: 30 }
          ],
          rows: advances
        },
        {
          name: 'Chứng từ',
          title: `CHỨNG TỪ - ${order.order_code}`,
          columns: [
            { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
            { header: 'Loại', key: 'document_type', width: 14 },
            { header: 'Tên file', key: 'file_name', width: 30 },
            { header: 'Ngày upload', key: 'uploaded_at', width: 18 }
          ],
          rows: documents
        }
      ]
    });

    sendExcelBuffer(res, `DonHang_${order.order_code}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'orders', orderId, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export order detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết đơn hàng' });
  }
});

// Maintenance (list)
app.get('/api/export/maintenance', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    const params = [];
    let query = `
      SELECT m.*, v.plate_number
      FROM vehicle_maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE 1=1
    `;
    if (vehicle_id) {
      query += ' AND m.vehicle_id = ?';
      params.push(vehicle_id);
    }
    query += ' ORDER BY m.maintenance_date DESC';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Bảo dưỡng',
      title: 'DANH SÁCH BẢO DƯỠNG XE',
      metaLines: vehicle_id ? [`Xe ID: ${vehicle_id}`] : [],
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Ngày', key: 'maintenance_date', width: 12 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Loại', key: 'maintenance_type', width: 18 },
        { header: 'Số Km', key: 'odometer_reading', width: 12, numFmt: '#,##0' },
        { header: 'Chi phí', key: 'cost', width: 14, numFmt: '#,##0' },
        { header: 'Garage', key: 'garage', width: 18 },
        { header: 'HĐ', key: 'invoice_number', width: 14 },
        { header: 'Mô tả', key: 'description', width: 26 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows
    });
    sendExcelBuffer(res, `BaoDuong_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'maintenance', null, null, { scope: 'list', vehicle_id }, req.ip);
  } catch (error) {
    console.error('Export maintenance error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel bảo dưỡng' });
  }
});

// Maintenance (detail)
app.get('/api/export/maintenance/:id/excel', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet(`
      SELECT m.*, v.plate_number
      FROM vehicle_maintenance m
      LEFT JOIN vehicles v ON m.vehicle_id = v.id
      WHERE m.id = ?
    `, [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Không tìm thấy bảo dưỡng' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Bảo dưỡng',
      title: `CHI TIẾT BẢO DƯỠNG - ${record.plate_number || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Ngày', key: 'maintenance_date', width: 12 },
        { header: 'Loại', key: 'maintenance_type', width: 18 },
        { header: 'Số Km', key: 'odometer_reading', width: 12, numFmt: '#,##0' },
        { header: 'Chi phí', key: 'cost', width: 14, numFmt: '#,##0' },
        { header: 'Hẹn lại', key: 'next_due_date', width: 12 },
        { header: 'Km hẹn', key: 'next_due_odometer', width: 12, numFmt: '#,##0' },
        { header: 'Garage', key: 'garage', width: 18 },
        { header: 'HĐ', key: 'invoice_number', width: 14 },
        { header: 'Mô tả', key: 'description', width: 26 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [record]
    });
    sendExcelBuffer(res, `BaoDuong_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'maintenance', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export maintenance detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết bảo dưỡng' });
  }
});

// Vehicle fees (list)
app.get('/api/export/vehicle-fees', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    const params = [];
    let query = `
      SELECT f.*, v.plate_number
      FROM vehicle_fees f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      WHERE 1=1
    `;
    if (vehicle_id) {
      query += ' AND f.vehicle_id = ?';
      params.push(vehicle_id);
    }
    query += ' ORDER BY f.paid_date DESC';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Phí xe',
      title: 'DANH SÁCH PHÍ XE',
      metaLines: vehicle_id ? [`Xe ID: ${vehicle_id}`] : [],
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Ngày trả', key: 'paid_date', width: 12 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Loại phí', key: 'fee_type', width: 14 },
        { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
        { header: 'Từ', key: 'valid_from', width: 12 },
        { header: 'Đến', key: 'valid_to', width: 12 },
        { header: 'Số biên lai', key: 'receipt_number', width: 16 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows
    });
    sendExcelBuffer(res, `PhiXe_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'vehicle_fees', null, null, { scope: 'list', vehicle_id }, req.ip);
  } catch (error) {
    console.error('Export vehicle fees error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel phí xe' });
  }
});

// Vehicle fees (detail)
app.get('/api/export/vehicle-fees/:id/excel', authenticateToken, async (req, res) => {
  try {
    const fee = await dbGet(`
      SELECT f.*, v.plate_number
      FROM vehicle_fees f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.id = ?
    `, [req.params.id]);
    if (!fee) return res.status(404).json({ error: 'Không tìm thấy phí xe' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Phí xe',
      title: `CHI TIẾT PHÍ XE - ${fee.plate_number || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Loại phí', key: 'fee_type', width: 14 },
        { header: 'Ngày trả', key: 'paid_date', width: 12 },
        { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
        { header: 'Từ', key: 'valid_from', width: 12 },
        { header: 'Đến', key: 'valid_to', width: 12 },
        { header: 'Số biên lai', key: 'receipt_number', width: 16 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [fee]
    });
    sendExcelBuffer(res, `PhiXe_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'vehicle_fees', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export vehicle fee detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết phí xe' });
  }
});

// Fuel records (detail)
app.get('/api/export/fuel-records/:id/excel', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet(`
      SELECT fr.*, v.plate_number
      FROM fuel_records fr
      LEFT JOIN vehicles v ON fr.vehicle_id = v.id
      WHERE fr.id = ?
    `, [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Không tìm thấy phiếu nhiên liệu' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Nhiên liệu',
      title: `CHI TIẾT NHIÊN LIỆU - ${record.plate_number || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Ngày', key: 'fuel_date', width: 12 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Loại nhiên liệu', key: 'fuel_type', width: 14 },
        { header: 'Số lít', key: 'liters', width: 10, numFmt: '#,##0.00' },
        { header: 'Giá/lít', key: 'price_per_liter', width: 12, numFmt: '#,##0' },
        { header: 'Tổng tiền', key: 'total_cost', width: 14, numFmt: '#,##0' },
        { header: 'Số Km', key: 'odometer_reading', width: 12, numFmt: '#,##0' },
        { header: 'Trạm xăng', key: 'station_name', width: 18 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [record]
    });
    sendExcelBuffer(res, `NhienLieu_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'fuel_records', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export fuel detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết nhiên liệu' });
  }
});

// Cash flow manual entry (detail)
app.get('/api/export/cash-flow/:id/excel', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const cf = await dbGet(`
      SELECT cf.*, o.order_code, d.name as driver_name, v.plate_number
      FROM cash_flow cf
      LEFT JOIN orders o ON cf.order_id = o.id
      LEFT JOIN drivers d ON cf.driver_id = d.id
      LEFT JOIN vehicles v ON cf.vehicle_id = v.id
      WHERE cf.id = ?
    `, [req.params.id]);
    if (!cf) return res.status(404).json({ error: 'Không tìm thấy giao dịch thu/chi' });

    const buffer = await exportTableWorkbook({
      sheetName: 'ThuChi',
      title: 'CHI TIẾT THU/CHI (NHẬP TAY)',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Ngày', key: 'transaction_date', width: 12 },
        { header: 'Loại', key: 'type', width: 10 },
        { header: 'Danh mục', key: 'category', width: 16 },
        { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
        { header: 'Mô tả', key: 'description', width: 28 },
        { header: 'Đơn hàng', key: 'order_code', width: 14 },
        { header: 'Tài xế', key: 'driver_name', width: 18 },
        { header: 'Xe', key: 'plate_number', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [cf]
    });
    sendExcelBuffer(res, `ThuChi_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'cash_flow', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export cash flow detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết thu/chi' });
  }
});

// Salaries (list)
app.get('/api/export/salaries', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const { month, driver_id } = req.query;
    const params = [];
    let query = `
      SELECT s.*, d.name as driver_name
      FROM driver_salaries s
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE 1=1
    `;
    if (month) {
      query += ' AND s.salary_month = ?';
      params.push(month);
    }
    if (driver_id) {
      query += ' AND s.driver_id = ?';
      params.push(driver_id);
    }
    query += ' ORDER BY s.salary_month DESC, d.name ASC';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Lương',
      title: 'DANH SÁCH LƯƠNG TÀI XẾ',
      metaLines: [
        month ? `Tháng: ${month}` : null,
        driver_id ? `Tài xế ID: ${driver_id}` : null
      ].filter(Boolean),
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Tháng', key: 'salary_month', width: 10 },
        { header: 'Tài xế', key: 'driver_name', width: 20 },
        { header: 'Số chuyến', key: 'trip_count', width: 10, numFmt: '#,##0' },
        { header: 'Lương cơ bản', key: 'base_salary', width: 14, numFmt: '#,##0' },
        { header: 'Thưởng', key: 'trip_bonus', width: 12, numFmt: '#,##0' },
        { header: 'Tăng ca', key: 'overtime_pay', width: 12, numFmt: '#,##0' },
        { header: 'Phạt', key: 'deductions', width: 12, numFmt: '#,##0' },
        { header: 'Trừ tạm ứng', key: 'advances_deducted', width: 14, numFmt: '#,##0' },
        { header: 'Thực nhận', key: 'total_salary', width: 14, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 10 },
        { header: 'Ngày trả', key: 'paid_date', width: 12 }
      ],
      rows
    });
    sendExcelBuffer(res, `Luong_${month || 'TatCa'}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'salaries', null, null, { scope: 'list', month, driver_id }, req.ip);
  } catch (error) {
    console.error('Export salaries error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel lương' });
  }
});

// Salaries (detail)
app.get('/api/export/salaries/:id/excel', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    const salary = await dbGet(`
      SELECT s.*, d.name as driver_name, d.phone as driver_phone
      FROM driver_salaries s
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE s.id = ?
    `, [req.params.id]);
    if (!salary) return res.status(404).json({ error: 'Không tìm thấy bản lương' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Lương',
      title: `CHI TIẾT LƯƠNG - ${salary.driver_name || ''} (${salary.salary_month || ''})`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Tháng', key: 'salary_month', width: 10 },
        { header: 'Tài xế', key: 'driver_name', width: 20 },
        { header: 'Số chuyến', key: 'trip_count', width: 10, numFmt: '#,##0' },
        { header: 'Lương cơ bản', key: 'base_salary', width: 14, numFmt: '#,##0' },
        { header: 'Thưởng', key: 'trip_bonus', width: 12, numFmt: '#,##0' },
        { header: 'Tăng ca', key: 'overtime_pay', width: 12, numFmt: '#,##0' },
        { header: 'Phạt', key: 'deductions', width: 12, numFmt: '#,##0' },
        { header: 'Trừ tạm ứng', key: 'advances_deducted', width: 14, numFmt: '#,##0' },
        { header: 'Thực nhận', key: 'total_salary', width: 14, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 10 },
        { header: 'Ngày trả', key: 'paid_date', width: 12 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [salary]
    });
    sendExcelBuffer(res, `Luong_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'salaries', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export salary detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết lương' });
  }
});

// Bonuses & penalties (list)
app.get('/api/export/bonuses-penalties', authenticateToken, async (req, res) => {
  try {
    const { driver_id, month } = req.query;
    let query = `
      SELECT bp.*, d.name as driver_name, o.order_code
      FROM driver_bonuses_penalties bp
      LEFT JOIN drivers d ON bp.driver_id = d.id
      LEFT JOIN orders o ON bp.order_id = o.id
      WHERE 1=1
    `;
    const params = [];
    if (driver_id) {
      query += ' AND bp.driver_id = ?';
      params.push(driver_id);
    }
    if (month) {
      query += ' AND strftime("%Y-%m", bp.date) = ?';
      params.push(month);
    }
    query += ' ORDER BY bp.date DESC';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'ThưởngPhạt',
      title: 'DANH SÁCH THƯỞNG / PHẠT',
      metaLines: [
        month ? `Tháng: ${month}` : null,
        driver_id ? `Tài xế ID: ${driver_id}` : null
      ].filter(Boolean),
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Ngày', key: 'date', width: 12 },
        { header: 'Tài xế', key: 'driver_name', width: 20 },
        { header: 'Loại', key: 'type', width: 10 },
        { header: 'Lý do', key: 'reason', width: 26 },
        { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
        { header: 'Đơn hàng', key: 'order_code', width: 14 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows
    });
    sendExcelBuffer(res, `ThuongPhat_${month || 'TatCa'}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'bonuses_penalties', null, null, { scope: 'list', month, driver_id }, req.ip);
  } catch (error) {
    console.error('Export bonuses penalties error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel thưởng/phạt' });
  }
});

// Bonuses & penalties (detail)
app.get('/api/export/bonuses-penalties/:id/excel', authenticateToken, async (req, res) => {
  try {
    const record = await dbGet(`
      SELECT bp.*, d.name as driver_name, o.order_code
      FROM driver_bonuses_penalties bp
      LEFT JOIN drivers d ON bp.driver_id = d.id
      LEFT JOIN orders o ON bp.order_id = o.id
      WHERE bp.id = ?
    `, [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Không tìm thấy thưởng/phạt' });

    const buffer = await exportTableWorkbook({
      sheetName: 'ThưởngPhạt',
      title: `CHI TIẾT THƯỞNG/PHẠT - ${record.driver_name || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Ngày', key: 'date', width: 12 },
        { header: 'Tài xế', key: 'driver_name', width: 20 },
        { header: 'Loại', key: 'type', width: 10 },
        { header: 'Lý do', key: 'reason', width: 26 },
        { header: 'Số tiền', key: 'amount', width: 14, numFmt: '#,##0' },
        { header: 'Đơn hàng', key: 'order_code', width: 14 },
        { header: 'Ghi chú', key: 'notes', width: 26 }
      ],
      rows: [record]
    });
    sendExcelBuffer(res, `ThuongPhat_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'bonuses_penalties', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export bonus/penalty detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết thưởng/phạt' });
  }
});

// Quotes (list)
app.get('/api/export/quotes', authenticateToken, async (req, res) => {
  try {
    // Check if quotes table exists
    const tableRow = await dbGet("SELECT name FROM sqlite_master WHERE type='table' AND name='quotes'");
    if (!tableRow) {
      const buffer = await exportTableWorkbook({
        sheetName: 'Báo giá',
        title: 'DANH SÁCH BÁO GIÁ',
        columns: [
          { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
          { header: 'Số báo giá', key: 'quote_number', width: 14 }
        ],
        rows: []
      });
      return sendExcelBuffer(res, `DanhSachBaoGia_${Date.now()}.xlsx`, buffer);
    }

    const { status, customer_id } = req.query;
    const params = [];
    let query = `
      SELECT q.*, c.name as customer_name
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    if (status) {
      query += ' AND q.status = ?';
      params.push(status);
    }
    if (customer_id) {
      query += ' AND q.customer_id = ?';
      params.push(customer_id);
    }
    query += ' ORDER BY q.quote_date DESC';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Báo giá',
      title: 'DANH SÁCH BÁO GIÁ',
      metaLines: [
        status ? `Trạng thái: ${status}` : null,
        customer_id ? `Khách hàng ID: ${customer_id}` : null
      ].filter(Boolean),
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Số báo giá', key: 'quote_number', width: 14 },
        { header: 'Khách hàng', key: 'customer_name', width: 24 },
        { header: 'Ngày báo giá', key: 'quote_date', width: 12 },
        { header: 'Hiệu lực', key: 'valid_until', width: 12 },
        { header: 'Tuyến', key: 'route_from', width: 16 },
        { header: 'Đến', key: 'route_to', width: 16 },
        { header: 'Loại cont', key: 'container_type', width: 10 },
        { header: 'Đơn giá', key: 'unit_price', width: 14, numFmt: '#,##0' },
        { header: 'Tổng (VAT)', key: 'final_amount', width: 14, numFmt: '#,##0' },
        { header: 'Trạng thái', key: 'status', width: 10 }
      ],
      rows
    });
    sendExcelBuffer(res, `DanhSachBaoGia_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'quotes', null, null, { scope: 'list', status, customer_id }, req.ip);
  } catch (error) {
    console.error('Export quotes list error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel danh sách báo giá' });
  }
});

// Users (admin only)
app.get('/api/export/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, username, fullname, role, status, created_at FROM users ORDER BY created_at DESC');
    const buffer = await exportTableWorkbook({
      sheetName: 'Users',
      title: 'DANH SÁCH USER',
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Username', key: 'username', width: 16 },
        { header: 'Họ tên', key: 'fullname', width: 20 },
        { header: 'Vai trò', key: 'role', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows
    });
    sendExcelBuffer(res, `Users_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'users', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel users' });
  }
});

// Users (detail)
app.get('/api/export/users/:id/excel', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, fullname, role, status, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Users',
      title: `CHI TIẾT USER - ${user.username || ''}`.trim(),
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Username', key: 'username', width: 16 },
        { header: 'Họ tên', key: 'fullname', width: 20 },
        { header: 'Vai trò', key: 'role', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 12 },
        { header: 'Ngày tạo', key: 'created_at', width: 18 }
      ],
      rows: [user]
    });
    sendExcelBuffer(res, `User_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'users', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export user detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết user' });
  }
});

// Audit logs (admin only)
app.get('/api/export/audit-logs', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { from_date, to_date, user_id, action, entity } = req.query;
    let query = `
      SELECT 
        al.*, u.username, u.fullname, u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (from_date) {
      query += ' AND al.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND al.created_at <= ?';
      params.push(to_date + ' 23:59:59');
    }
    if (user_id) {
      query += ' AND al.user_id = ?';
      params.push(user_id);
    }
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    if (entity) {
      query += ' AND al.entity = ?';
      params.push(entity);
    }
    query += ' ORDER BY al.created_at DESC LIMIT 500';

    const rows = await dbAll(query, params);
    const buffer = await exportTableWorkbook({
      sheetName: 'Audit',
      title: 'NHẬT KÝ HOẠT ĐỘNG',
      metaLines: [
        from_date || to_date ? `Từ: ${from_date || ''}  Đến: ${to_date || ''}`.trim() : null,
        user_id ? `User ID: ${user_id}` : null,
        action ? `Hành động: ${action}` : null,
        entity ? `Đối tượng: ${entity}` : null
      ].filter(Boolean),
      columns: [
        { header: 'STT', key: 'stt', width: 6, value: (_r, idx) => idx + 1 },
        { header: 'Thời gian', key: 'created_at', width: 18 },
        { header: 'User', key: 'username', width: 14 },
        { header: 'Họ tên', key: 'fullname', width: 18 },
        { header: 'Vai trò', key: 'role', width: 12 },
        { header: 'Hành động', key: 'action', width: 14 },
        { header: 'Đối tượng', key: 'entity', width: 14 },
        { header: 'Entity ID', key: 'entity_id', width: 10 },
        { header: 'IP', key: 'ip_address', width: 16 }
      ],
      rows
    });
    sendExcelBuffer(res, `AuditLogs_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'audit_logs', null, null, { scope: 'list' }, req.ip);
  } catch (error) {
    console.error('Export audit logs error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel audit logs' });
  }
});

// Audit logs (detail)
app.get('/api/export/audit-logs/:id/excel', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const row = await dbGet(`
      SELECT al.*, u.username, u.fullname, u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Không tìm thấy log' });

    const buffer = await exportTableWorkbook({
      sheetName: 'Audit',
      title: `CHI TIẾT NHẬT KÝ #${row.id}`,
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Thời gian', key: 'created_at', width: 18 },
        { header: 'User', key: 'username', width: 14 },
        { header: 'Họ tên', key: 'fullname', width: 18 },
        { header: 'Vai trò', key: 'role', width: 12 },
        { header: 'Hành động', key: 'action', width: 14 },
        { header: 'Đối tượng', key: 'entity', width: 14 },
        { header: 'Entity ID', key: 'entity_id', width: 10 },
        { header: 'IP', key: 'ip_address', width: 16 },
        { header: 'Old', key: 'old_value', width: 30 },
        { header: 'New', key: 'new_value', width: 30 }
      ],
      rows: [row]
    });
    sendExcelBuffer(res, `AuditLog_${req.params.id}_${Date.now()}.xlsx`, buffer);
    logAudit(req.user.id, req.user.username, req.user.role, 'export', 'audit_logs', req.params.id, null, { scope: 'detail' }, req.ip);
  } catch (error) {
    console.error('Export audit log detail error:', error);
    res.status(500).json({ error: 'Lỗi xuất Excel chi tiết audit log' });
  }
});

// ====================
// PHASE 3.1: CRM - CUSTOMERS
// ====================

// List customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Lỗi query customers:', err);
        return res.status(500).json({ error: 'Lỗi lấy danh sách khách hàng' });
      }
      res.json(rows);
    });
  } catch (error) {
    console.error('Lỗi customers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single customer
app.get('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Lỗi query customer:', err);
        return res.status(500).json({ error: 'Lỗi lấy thông tin khách hàng' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
      }
      res.json(row);
    });
  } catch (error) {
    console.error('Lỗi customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer
app.post('/api/customers', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const {
      name, tax_code, contact_person, phone, email, address,
      customer_type, credit_limit, payment_terms, status, notes
    } = req.body;
    
    // Debug logging
    console.log('📥 POST /api/customers - Received data:', {
      name,
      name_type: typeof name,
      name_length: name ? name.length : 0,
      all_fields: Object.keys(req.body)
    });
    
    // Trim và validate name
    const trimmedName = (name || '').trim();
    console.log('✂️ Trimmed name:', trimmedName, '| isEmpty:', !trimmedName);
    
    if (!trimmedName) {
      console.log('❌ Validation failed: empty name');
      return res.status(400).json({ error: 'Tên công ty là bắt buộc' });
    }
    
    const result = await dbRun(
      `INSERT INTO customers (
        name, tax_code, contact_person, phone, email, address,
        customer_type, credit_limit, payment_terms, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trimmedName, tax_code, contact_person, phone, email, address,
        customer_type || 'individual', credit_limit || 0, payment_terms || 'COD',
        status || 'active', notes, req.user.id
      ]
    );

    const created = await dbGet('SELECT * FROM customers WHERE id = ?', [result.lastID]);
    logAudit(req.user.id, req.user.username, req.user.role, 'create', 'customers', result.lastID, null, created, req.ip);
    res.json({ id: result.lastID, message: 'Đã tạo khách hàng' });
  } catch (error) {
    console.error('Lỗi customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const {
      name, tax_code, contact_person, phone, email, address,
      customer_type, credit_limit, payment_terms, status, notes
    } = req.body;
    
    // Debug logging
    console.log('📥 PUT /api/customers/:id - Received data:', {
      id: req.params.id,
      name,
      name_type: typeof name,
      name_length: name ? name.length : 0
    });
    
    // Trim và validate name
    const trimmedName = (name || '').trim();
    console.log('✂️ Trimmed name:', trimmedName, '| isEmpty:', !trimmedName);
    
    if (!trimmedName) {
      console.log('❌ Validation failed: empty name');
      return res.status(400).json({ error: 'Tên công ty là bắt buộc' });
    }
    
    const oldCustomer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!oldCustomer) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const result = await dbRun(
      `UPDATE customers SET
        name = ?, tax_code = ?, contact_person = ?, phone = ?,
        email = ?, address = ?, customer_type = ?, credit_limit = ?,
        payment_terms = ?, status = ?, notes = ?
      WHERE id = ?`,
      [
        trimmedName, tax_code, contact_person, phone, email, address,
        customer_type, credit_limit, payment_terms, status, notes,
        req.params.id
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    }

    const updated = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    logAudit(req.user.id, req.user.username, req.user.role, 'update', 'customers', req.params.id, oldCustomer, updated, req.ip);
    res.json({ message: 'Đã cập nhật khách hàng' });
  } catch (error) {
    console.error('Lỗi customer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================
// PHASE 3.1: CRM - QUOTES
// ====================
// ====================
// QUOTES APIs
// ====================

// List quotes
app.get('/api/quotes', authenticateToken, async (req, res) => {
  try {
    // Check if quotes table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='quotes'", [], (err, row) => {
      if (err || !row) {
        // Table doesn't exist yet - return empty array
        return res.json([]);
      }
      
      const { status, customer_id } = req.query;
      
      let query = `
        SELECT q.*, c.name as customer_name, c.contact_person, c.phone as customer_phone
        FROM quotes q
        LEFT JOIN customers c ON q.customer_id = c.id
        WHERE 1=1
      `;
      const params = [];
      
      if (status) {
        query += ' AND q.status = ?';
        params.push(status);
      }
      
      if (customer_id) {
        query += ' AND q.customer_id = ?';
        params.push(customer_id);
      }
      
      query += ' ORDER BY q.quote_date DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Lỗi query quotes:', err);
          return res.status(500).json({ error: 'Lỗi lấy danh sách báo giá' });
        }
        res.json(rows);
      });
    });
  } catch (error) {
    console.error('Error in /api/quotes:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Get single quote
app.get('/api/quotes/:id', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT q.*, c.name as customer_name, c.contact_person, c.phone as customer_phone
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `;
    
    db.get(query, [req.params.id], (err, row) => {
      if (err) {
        console.error('Lỗi query quote:', err);
        return res.status(500).json({ error: 'Lỗi lấy thông tin báo giá' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Không tìm thấy báo giá' });
      }
      res.json(row);
    });
  } catch (error) {
    console.error('Lỗi quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create quote
app.post('/api/quotes', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const {
      quote_number, customer_id, quote_date, valid_until, route_from, route_to,
      container_type, cargo_description, quantity, unit_price, total_amount,
      discount_amount, tax_amount, final_amount, notes
    } = req.body;
    
    if (!quote_number || !customer_id || !quote_date || !route_from || !route_to) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    
    const query = `
      INSERT INTO quotes (
        quote_number, customer_id, quote_date, valid_until, route_from, route_to,
        container_type, cargo_description, quantity, unit_price, total_amount,
        discount_amount, tax_amount, final_amount, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
    `;
    
    db.run(query, [
      quote_number, customer_id, quote_date, valid_until, route_from, route_to,
      container_type, cargo_description, quantity || 1, unit_price, total_amount,
      discount_amount || 0, tax_amount || 0, final_amount, notes, req.user.id
    ], function(err) {
      if (err) {
        console.error('Lỗi tạo quote:', err);
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Số báo giá đã tồn tại' });
        }
        return res.status(500).json({ error: 'Lỗi tạo báo giá' });
      }
      
      logAudit(req.user.id, req.user.username, req.user.role, 'create', 'quotes', this.lastID, null, { quote_number }, req.ip);
      res.json({ id: this.lastID, message: 'Đã tạo báo giá' });
    });
  } catch (error) {
    console.error('Lỗi quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quote
app.put('/api/quotes/:id', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    // Check if quote is draft
    db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        console.error('Lỗi query quote:', err);
        return res.status(500).json({ error: 'Lỗi kiểm tra báo giá' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Không tìm thấy báo giá' });
      }
      if (row.status !== 'draft') {
        return res.status(400).json({ error: 'Chỉ có thể sửa báo giá ở trạng thái Nháp' });
      }

      const oldQuote = row;
      
      const {
        customer_id, quote_date, valid_until, route_from, route_to,
        container_type, cargo_description, quantity, unit_price, total_amount,
        discount_amount, tax_amount, final_amount, notes
      } = req.body;
      
      const query = `
        UPDATE quotes SET
          customer_id = ?, quote_date = ?, valid_until = ?, route_from = ?, route_to = ?,
          container_type = ?, cargo_description = ?, quantity = ?, unit_price = ?,
          total_amount = ?, discount_amount = ?, tax_amount = ?, final_amount = ?, notes = ?
        WHERE id = ?
      `;
      
      db.run(query, [
        customer_id, quote_date, valid_until, route_from, route_to,
        container_type, cargo_description, quantity, unit_price, total_amount,
        discount_amount, tax_amount, final_amount, notes, req.params.id
      ], function(err) {
        if (err) {
          console.error('Lỗi update quote:', err);
          return res.status(500).json({ error: 'Lỗi cập nhật báo giá' });
        }

        const newQuote = {
          ...oldQuote,
          customer_id, quote_date, valid_until, route_from, route_to,
          container_type, cargo_description, quantity, unit_price, total_amount,
          discount_amount, tax_amount, final_amount, notes
        };
        logAudit(req.user.id, req.user.username, req.user.role, 'update', 'quotes', req.params.id, oldQuote, newQuote, req.ip);
        res.json({ message: 'Đã cập nhật báo giá' });
      });
    });
  } catch (error) {
    console.error('Lỗi quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve quote
app.put('/api/quotes/:id/approve', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    const oldQuote = await dbGet('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
    if (!oldQuote) {
      return res.status(404).json({ error: 'Không tìm thấy báo giá' });
    }

    db.run(
      'UPDATE quotes SET status = ? WHERE id = ?',
      ['approved', req.params.id],
      function(err) {
        if (err) {
          console.error('Lỗi approve quote:', err);
          return res.status(500).json({ error: 'Lỗi duyệt báo giá' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Không tìm thấy báo giá' });
        }
        
        logAudit(req.user.id, req.user.username, req.user.role, 'approve', 'quotes', req.params.id, oldQuote, { ...oldQuote, status: 'approved' }, req.ip);
        res.json({ message: 'Đã duyệt báo giá' });
      }
    );
  } catch (error) {
    console.error('Lỗi quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convert quote to order
app.post('/api/quotes/:id/convert', authenticateToken, requireRole('admin', 'sales'), async (req, res) => {
  try {
    // Get quote info
    db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id], (err, quote) => {
      if (err) {
        console.error('Lỗi query quote:', err);
        return res.status(500).json({ error: 'Lỗi lấy thông tin báo giá' });
      }
      if (!quote) {
        return res.status(404).json({ error: 'Không tìm thấy báo giá' });
      }
      if (quote.status !== 'approved') {
        return res.status(400).json({ error: 'Chỉ có thể chuyển báo giá đã duyệt' });
      }
      if (quote.converted_order_id) {
        return res.status(400).json({ error: 'Báo giá đã được chuyển thành đơn hàng' });
      }
      
      // Create order using the real "orders" schema used by the rest of the system
      const orderCode = 'ORD' + Date.now().toString().slice(-8);
      const orderDate = (quote.quote_date || new Date().toISOString().split('T')[0]);

      // Quote: total_amount = quantity*unit_price; discount_amount applied before VAT.
      const priceAfterDiscount = (quote.total_amount || 0) - (quote.discount_amount || 0);
      const finalAmount = quote.final_amount || Math.round((priceAfterDiscount || 0) * 1.1);

      const orderQuery = `
        INSERT INTO orders (
          order_code, customer_id,
          order_date,
          pickup_location, delivery_location,
          cargo_description, quantity,
          price, neo_xe, chi_ho, final_amount,
          status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(
        orderQuery,
        [
          orderCode,
          quote.customer_id,
          orderDate,
          quote.route_from,
          quote.route_to,
          quote.cargo_description,
          quote.quantity || 1,
          priceAfterDiscount,
          0,
          0,
          finalAmount,
          'pending',
          `Từ báo giá ${quote.quote_number}`,
          req.user.id
        ],
        async function(err) {
          if (err) {
            console.error('Lỗi tạo order:', err);
            return res.status(500).json({ error: 'Lỗi tạo đơn hàng' });
          }

          const orderId = this.lastID;

          try {
            // Update quote converted id
            await dbRun('UPDATE quotes SET converted_order_id = ? WHERE id = ?', [orderId, req.params.id]);
            // Update customer debt (like normal order create)
            await dbRun(
              'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
              [finalAmount, quote.customer_id]
            );

            logAudit(
              req.user.id,
              req.user.username,
              req.user.role,
              'convert',
              'quotes',
              req.params.id,
              quote,
              { order_id: orderId, order_code: orderCode },
              req.ip
            );

            res.json({
              order_id: orderId,
              order_code: orderCode,
              message: 'Đã chuyển báo giá thành đơn hàng'
            });
          } catch (e) {
            console.error('Lỗi sau khi tạo order từ quote:', e);
            res.status(500).json({ error: 'Tạo đơn thành công nhưng lỗi cập nhật liên quan' });
          }
        }
      );
    });
  } catch (error) {
    console.error('Lỗi quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====================
// Start Server
// ====================

function startServerInstance() {
  return new Promise((resolve, reject) => {
    initDatabase()
      .then(() => {
        const server = app.listen(PORT, 'localhost', (err) => {
          if (err) {
            console.error('❌ Lỗi khởi động server:', err);
            reject(err);
          } else {
            console.log(`✅ Server đã khởi động tại http://localhost:${PORT}`);
            resolve(server);
          }
        });
        
        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} đã được sử dụng!`);
          }
          reject(err);
        });
      })
      .catch((error) => {
        console.error('❌ Lỗi khởi tạo database:', error);
        reject(error);
      });
  });
}

// Chỉ khởi động server nếu file này được chạy trực tiếp (không phải import)
if (require.main === module) {
  startServerInstance()
    .then(() => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║  PHẦN MỀM QUẢN LÝ VẬN CHUYỂN HÀNG HÓA                  ║
╠════════════════════════════════════════════════════════╣
║  Server đang chạy tại: http://localhost:${PORT}         ║
║  Tài khoản admin: admin / admin123                     ║
╚════════════════════════════════════════════════════════╝
      `);
    })
    .catch((error) => {
      console.error('❌ Không thể khởi động:', error);
      process.exit(1);
    });
}

// Export để Electron có thể dùng
module.exports = { app, startServerInstance };
