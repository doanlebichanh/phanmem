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
        r.route_name
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
        r.route_name, r.origin, r.destination
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
      booking_number, bill_of_lading, seal_number, cargo_type
    } = req.body;

    // Tạo mã đơn hàng tự động
    const orderCode = 'ORD' + Date.now().toString().slice(-8);
    
    // Tính final_amount (bao gồm VAT 10%)
    const subtotal = (price || 0) + (neo_xe || 0) + (chi_ho || 0);
    const final_amount = req.body.final_amount || Math.round(subtotal * 1.1);

    const result = await dbRun(
      `INSERT INTO orders (
        order_code, customer_id, route_id, container_id, vehicle_id, driver_id,
        order_date, pickup_date, delivery_date,
        pickup_location, intermediate_point, delivery_location,
        cargo_description, quantity, weight, price, neo_xe, chi_ho, final_amount, status, notes, created_by,
        booking_number, bill_of_lading, seal_number, cargo_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderCode, customer_id, route_id, container_id, vehicle_id, driver_id,
        order_date, pickup_date, delivery_date,
        pickup_location, intermediate_point, delivery_location,
        cargo_description, quantity, weight, price, neo_xe || 0, chi_ho || 0, final_amount, status || 'pending', notes, req.user.id,
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
    
    // Nếu có thay đổi giá, tính lại final_amount và cập nhật công nợ
    if (req.body.price || req.body.neo_xe || req.body.chi_ho || req.body.final_amount) {
      const newPrice = req.body.price !== undefined ? req.body.price : oldOrder.price;
      const newNeoXe = req.body.neo_xe !== undefined ? req.body.neo_xe : (oldOrder.neo_xe || 0);
      const newChiHo = req.body.chi_ho !== undefined ? req.body.chi_ho : (oldOrder.chi_ho || 0);
      
      if (!req.body.final_amount) {
        const subtotal = newPrice + newNeoXe + newChiHo;
        req.body.final_amount = Math.round(subtotal * 1.1);
      }
      
      // Cập nhật công nợ: Trừ số cũ, cộng số mới
      const oldFinalAmount = oldOrder.final_amount || 0;
      const newFinalAmount = req.body.final_amount;
      const debtDiff = newFinalAmount - oldFinalAmount;
      
      if (debtDiff !== 0) {
        await dbRun(
          'UPDATE customers SET current_debt = COALESCE(current_debt, 0) + ? WHERE id = ?',
          [debtDiff, oldOrder.customer_id]
        );
      }
    }
    
    // Build dynamic UPDATE query based on fields provided
    const allowedFields = [
      'customer_id', 'route_id', 'container_id', 'vehicle_id', 'driver_id',
      'order_date', 'pickup_date', 'delivery_date',
      'pickup_location', 'intermediate_point', 'delivery_location',
      'cargo_description', 'quantity', 'weight', 'price', 'neo_xe', 'chi_ho', 'final_amount', 'status', 'notes',
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

app.delete('/api/costs/:id', authenticateToken, requireRole('admin', 'dispatcher'), async (req, res) => {
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
    const { customer_id, payment_date, amount, payment_method, reference_number, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO payments (order_id, customer_id, payment_date, amount, payment_method, reference_number, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.orderId, customer_id, payment_date, amount, payment_method, reference_number, notes, req.user.id]
    );

    // Cập nhật công nợ khách hàng
    await dbRun(
      'UPDATE customers SET current_debt = current_debt - ? WHERE id = ?',
      [amount, customer_id]
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

app.delete('/api/payments/:id', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
  try {
    // Lấy thông tin thanh toán trước khi xóa để hoàn trả công nợ
    const payment = await dbGet('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    
    if (payment) {
      await dbRun(
        'UPDATE customers SET current_debt = current_debt + ? WHERE id = ?',
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
    const { driver_id, advance_date, amount, notes } = req.body;

    const result = await dbRun(
      `INSERT INTO driver_advances (order_id, driver_id, advance_date, amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.orderId, driver_id, advance_date, amount, notes, req.user.id]
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
    const { from_date, to_date } = req.query;
    
    let dateFilter = '';
    let params = [];
    if (from_date && to_date) {
      dateFilter = 'WHERE order_date BETWEEN ? AND ?';
      params = [from_date, to_date];
    }

    const totalOrders = await dbGet(`SELECT COUNT(*) as count FROM orders ${dateFilter}`, params);
    const totalRevenue = await dbGet(`SELECT SUM(price) as total FROM orders ${dateFilter}`, params);
    const totalCosts = await dbGet(`
      SELECT SUM(tc.amount) as total 
      FROM trip_costs tc
      JOIN orders o ON tc.order_id = o.id
      ${dateFilter}
    `, params);
    const totalPayments = await dbGet(`
      SELECT SUM(p.amount) as total 
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      ${dateFilter}
    `, params);

    res.json({
      totalOrders: totalOrders.count || 0,
      totalRevenue: totalRevenue.total || 0,
      totalCosts: totalCosts.total || 0,
      totalPayments: totalPayments.total || 0,
      profit: (totalRevenue.total || 0) - (totalCosts.total || 0)
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Lỗi lấy báo cáo tổng quan' });
  }
});

// Báo cáo theo khách hàng
app.get('/api/reports/customers', authenticateToken, async (req, res) => {
  try {
    const report = await dbAll(`
      SELECT 
        c.id,
        c.name,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM((o.price + COALESCE(o.neo_xe, 0) + COALESCE(o.chi_ho, 0)) * 1.1), 0) as total_revenue,
        COALESCE(SUM(p.amount), 0) as total_paid,
        COALESCE(SUM((o.price + COALESCE(o.neo_xe, 0) + COALESCE(o.chi_ho, 0)) * 1.1), 0) - COALESCE(SUM(p.amount), 0) as current_debt
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      LEFT JOIN payments p ON o.id = p.order_id
      GROUP BY c.id
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
      trip_count, 
      trip_bonus, 
      overtime_hours, 
      overtime_pay, 
      deductions, 
      advances_deducted, 
      total_salary, 
      notes 
    } = req.body;
    
    const result = await dbRun(`
      INSERT INTO driver_salaries 
      (driver_id, salary_month, base_salary, trip_count, trip_bonus, overtime_hours, overtime_pay, deductions, advances_deducted, total_salary, notes, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `, [driver_id, salary_month, base_salary, trip_count, trip_bonus, overtime_hours || 0, overtime_pay || 0, deductions, advances_deducted, total_salary, notes, req.user.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'create',
      'salaries',
      result.lastID,
      null,
      { driver_id, salary_month, total_salary },
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
    
    await dbRun(`
      UPDATE driver_salaries 
      SET status = ?, paid_date = ?, payment_method = ?, notes = ?
      WHERE id = ?
    `, [status, paid_date, payment_method, notes, req.params.id]);
    
    // Nếu đã trả lương, đánh dấu các tạm ứng là đã quyết toán
    if (status === 'paid' && oldSalary.advances_deducted > 0) {
      await dbRun(`
        UPDATE driver_advances 
        SET settled = 1, settlement_date = ?
        WHERE driver_id = ? AND settled = 0 AND strftime('%Y-%m', advance_date) <= ?
      `, [paid_date, oldSalary.driver_id, oldSalary.salary_month]);
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
      SET maintenance_date = ?, odometer_reading = ?, cost = ?, next_due_date = ?, next_due_odometer = ?, garage = ?, invoice_number = ?, description = ?, notes = ?
      WHERE id = ?
    `, [maintenance_date, odometer_reading, cost, next_due_date, next_due_odometer, garage, invoice_number, description, notes, req.params.id]);
    
    // Log audit
    logAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'update',
      'maintenance',
      req.params.id,
      oldRecord,
      { maintenance_date, cost },
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
app.delete('/api/fuel-records/:id', authenticateToken, requireRole('admin', 'accountant'), async (req, res) => {
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

// Get consolidated cash flow (TỰ ĐỘNG tổng hợp từ tất cả nguồn)
app.get('/api/cash-flow/consolidated', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = from && to ? `AND date BETWEEN '${from}' AND '${to}'` : '';
    
    const consolidated = [];
    
    // ========== THU (TIỀN THỰC TẾ NHẬN ĐƯỢC) ==========
    // 1. Thanh toán từ khách hàng (payments)
    try {
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
          ${dateFilter.replace('date', 'p.payment_date')}
        ORDER BY p.payment_date DESC
      `);
      if (payments && payments.length > 0) consolidated.push(...payments);
    } catch (e) { console.log('Skip payments:', e.message); }
    
    // ========== CHI (TẤT CẢ CHI PHÍ THỰC TẾ) ==========
    // 2. Lương tài xế đã trả
    try {
      const salaries = await dbAll(`
        SELECT 
          'expense' as type,
          'Lương tài xế' as category,
          d.name || ' - Tháng ' || s.salary_month as description,
          s.total_salary as amount,
          s.payment_date as transaction_date,
          'SALARY-' || s.id as reference,
          'salary' as source
        FROM salaries s
        JOIN drivers d ON s.driver_id = d.id
        WHERE s.status = 'paid' AND s.payment_date IS NOT NULL
          ${dateFilter.replace('date', 's.payment_date')}
        ORDER BY s.payment_date DESC
      `);
      if (salaries && salaries.length > 0) consolidated.push(...salaries);
    } catch (e) { console.log('Skip salaries:', e.message); }
    
    // 3. Nhiên liệu
    try {
      const fuel = await dbAll(`
        SELECT 
          'expense' as type,
          'Nhiên liệu' as category,
          v.plate_number || ' - ' || fr.liters || 'L @ ' || fr.price_per_liter || 'đ/L' as description,
          fr.total_cost as amount,
          fr.refuel_date as transaction_date,
          'FUEL-' || fr.id as reference,
          'fuel' as source
        FROM fuel_records fr
        JOIN vehicles v ON fr.vehicle_id = v.id
        WHERE fr.refuel_date IS NOT NULL
          ${dateFilter.replace('date', 'fr.refuel_date')}
        ORDER BY fr.refuel_date DESC
      `);
      if (fuel && fuel.length > 0) consolidated.push(...fuel);
    } catch (e) { console.log('Skip fuel:', e.message); }
    
    // 4. Bảo dưỡng xe
    try {
      const maintenance = await dbAll(`
        SELECT 
          'expense' as type,
          'Bảo dưỡng xe' as category,
          v.plate_number || ' - ' || m.maintenance_type as description,
          m.cost as amount,
          m.maintenance_date as transaction_date,
          'MAINT-' || m.id as reference,
          'maintenance' as source
        FROM maintenance m
        JOIN vehicles v ON m.vehicle_id = v.id
        WHERE m.maintenance_date IS NOT NULL
          ${dateFilter.replace('date', 'm.maintenance_date')}
        ORDER BY m.maintenance_date DESC
      `);
      if (maintenance && maintenance.length > 0) consolidated.push(...maintenance);
    } catch (e) { console.log('Skip maintenance:', e.message); }
    
    // 5. Chi phí chuyến (trip_costs)
    try {
      const tripCosts = await dbAll(`
        SELECT 
          'expense' as type,
          tc.cost_type as category,
          o.order_code || ' - ' || COALESCE(tc.description, tc.cost_type) as description,
          tc.amount,
          COALESCE(tc.date, o.delivery_date, o.order_date) as transaction_date,
          'COST-' || tc.id as reference,
          'trip_cost' as source
        FROM trip_costs tc
        JOIN orders o ON tc.order_id = o.id
        WHERE 1=1
          ${dateFilter.replace('date', 'COALESCE(tc.date, o.delivery_date, o.order_date)')}
        ORDER BY transaction_date DESC
      `);
      if (tripCosts && tripCosts.length > 0) consolidated.push(...tripCosts);
    } catch (e) { console.log('Skip trip_costs:', e.message); }
    
    // 6. Tạm ứng cho tài xế
    try {
      const advances = await dbAll(`
        SELECT 
          'expense' as type,
          'Tạm ứng tài xế' as category,
          d.name || ' - ' || COALESCE(da.reason, 'Tạm ứng') as description,
          da.amount,
          da.advance_date as transaction_date,
          'ADV-' || da.id as reference,
          'advance' as source
        FROM driver_advances da
        JOIN drivers d ON da.driver_id = d.id
        WHERE da.advance_date IS NOT NULL
          ${dateFilter.replace('date', 'da.advance_date')}
        ORDER BY da.advance_date DESC
      `);
      if (advances && advances.length > 0) consolidated.push(...advances);
    } catch (e) { console.log('Skip advances:', e.message); }
    
    // 7. Chi hồ, nẹo xe từ orders (đã trả thực tế)
    try {
      const orderFees = await dbAll(`
        SELECT 
          'expense' as type,
          CASE 
            WHEN chi_ho > 0 AND neo_xe > 0 THEN 'Chi hồ + Nẹo xe'
            WHEN chi_ho > 0 THEN 'Chi hồ'
            WHEN neo_xe > 0 THEN 'Nẹo xe'
          END as category,
          order_code || ' - ' || COALESCE(pickup_location, '') as description,
          (COALESCE(chi_ho, 0) + COALESCE(neo_xe, 0)) as amount,
          COALESCE(delivery_date, order_date) as transaction_date,
          'FEE-' || id as reference,
          'order_fee' as source
        FROM orders
        WHERE (chi_ho > 0 OR neo_xe > 0)
          ${dateFilter.replace('date', 'COALESCE(delivery_date, order_date)')}
        ORDER BY transaction_date DESC
      `);
      if (orderFees && orderFees.length > 0) consolidated.push(...orderFees);
    } catch (e) { console.log('Skip order fees:', e.message); }
    
    // 8. Thu/Chi thủ công khác (ngoài hệ thống)
    try {
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
          ${dateFilter.replace('date', 'transaction_date')}
        ORDER BY transaction_date DESC
      `);
      if (manual && manual.length > 0) consolidated.push(...manual);
    } catch (e) { console.log('Skip cash_flow:', e.message); }
    
    // Sắp xếp theo ngày
    consolidated.sort((a, b) => {
      const dateA = new Date(a.transaction_date || '1970-01-01');
      const dateB = new Date(b.transaction_date || '1970-01-01');
      return dateB - dateA;
    });
    
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
    
    // Query đơn giản hơn - tính chi phí trực tiếp từ các bảng liên quan đến xe
    // Lương tài xế được tính riêng vì không có liên kết trực tiếp với xe
    let query = `
      SELECT 
        v.id as vehicle_id,
        v.plate_number,
        COALESCE(SUM(fr.total_cost), 0) as fuel_cost,
        COALESCE(SUM(vm.cost), 0) as maintenance_cost,
        COALESCE(SUM(vf.amount), 0) as fee_cost,
        (COALESCE(SUM(fr.total_cost), 0) + COALESCE(SUM(vm.cost), 0) + 
         COALESCE(SUM(vf.amount), 0)) as total_expenses
      FROM vehicles v
      LEFT JOIN fuel_records fr ON v.id = fr.vehicle_id
      LEFT JOIN vehicle_maintenance vm ON v.id = vm.vehicle_id
      LEFT JOIN vehicle_fees vf ON v.id = vf.vehicle_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (vehicle_id) {
      query += ` AND v.id = ?`;
      params.push(vehicle_id);
    }
    
    if (from) {
      query += ` AND (
        (fr.fuel_date >= ? OR fr.fuel_date IS NULL) AND
        (vm.maintenance_date >= ? OR vm.maintenance_date IS NULL) AND
        (vf.created_at >= ? OR vf.created_at IS NULL)
      )`;
      params.push(from, from, from);
    }
    
    if (to) {
      query += ` AND (
        (fr.fuel_date <= ? OR fr.fuel_date IS NULL) AND
        (vm.maintenance_date <= ? OR vm.maintenance_date IS NULL) AND
        (vf.created_at <= ? OR vf.created_at IS NULL)
      )`;
      params.push(to, to, to);
    }
    
    query += ` GROUP BY v.id, v.plate_number`;
    
    db.all(query, params, async (err, rows) => {
      if (err) {
        console.error('Lỗi query expense reports:', err);
        return res.status(500).json({ error: 'Lỗi lấy báo cáo chi phí' });
      }
      
      // Tính lương tài xế cho mỗi xe dựa trên các đơn hàng
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
        
        if (from) {
          salaryQuery += ` AND ds.salary_month >= ?`;
          salaryParams.push(from);
        }
        if (to) {
          salaryQuery += ` AND ds.salary_month <= ?`;
          salaryParams.push(to);
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

const { exportFuelReport, exportCashFlowReport, exportExpenseReport } = require('./excel-export');

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
    
    const buffer = await exportCashFlowReport(db, { type, from, to });
    
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
    
    const query = `
      INSERT INTO customers (
        name, tax_code, contact_person, phone, email, address,
        customer_type, credit_limit, payment_terms, status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      trimmedName, tax_code, contact_person, phone, email, address,
      customer_type || 'individual', credit_limit || 0, payment_terms || 'COD',
      status || 'active', notes, req.user.userId
    ], function(err) {
      if (err) {
        console.error('Lỗi tạo customer:', err);
        return res.status(500).json({ error: 'Lỗi tạo khách hàng' });
      }
      
      logAudit(req.user.userId, 'create', 'customers', this.lastID, { name });
      res.json({ id: this.lastID, message: 'Đã tạo khách hàng' });
    });
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
    
    const query = `
      UPDATE customers SET
        name = ?, tax_code = ?, contact_person = ?, phone = ?,
        email = ?, address = ?, customer_type = ?, credit_limit = ?,
        payment_terms = ?, status = ?, notes = ?
      WHERE id = ?
    `;
    
    db.run(query, [
      trimmedName, tax_code, contact_person, phone, email, address,
      customer_type, credit_limit, payment_terms, status, notes,
      req.params.id
    ], function(err) {
      if (err) {
        console.error('Lỗi update customer:', err);
        return res.status(500).json({ error: 'Lỗi cập nhật khách hàng' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
      }
      
      logAudit(req.user.userId, 'update', 'customers', req.params.id, { name });
      res.json({ message: 'Đã cập nhật khách hàng' });
    });
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
      discount_amount || 0, tax_amount || 0, final_amount, notes, req.user.userId
    ], function(err) {
      if (err) {
        console.error('Lỗi tạo quote:', err);
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Số báo giá đã tồn tại' });
        }
        return res.status(500).json({ error: 'Lỗi tạo báo giá' });
      }
      
      logAudit(req.user.userId, 'create', 'quotes', this.lastID, { quote_number });
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
    db.get('SELECT status FROM quotes WHERE id = ?', [req.params.id], (err, row) => {
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
        
        logAudit(req.user.userId, 'update', 'quotes', req.params.id);
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
        
        logAudit(req.user.userId, 'approve', 'quotes', req.params.id);
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
      
      // Get customer info
      db.get('SELECT * FROM customers WHERE id = ?', [quote.customer_id], (err, customer) => {
        if (err || !customer) {
          return res.status(500).json({ error: 'Lỗi lấy thông tin khách hàng' });
        }
        
        // Create order
        const orderCode = `DH${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;
        const orderQuery = `
          INSERT INTO orders (
            order_code, customer_name, customer_phone, order_date, pickup_location,
            delivery_location, cargo_description, container_type, quantity, unit_price,
            total_amount, notes, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `;
        
        db.run(orderQuery, [
          orderCode, customer.company_name, customer.phone, new Date().toISOString().split('T')[0],
          quote.route_from, quote.delivery_location, quote.cargo_description,
          quote.container_type, quote.quantity, quote.unit_price, quote.final_amount,
          `Từ báo giá ${quote.quote_number}`, req.user.userId
        ], function(err) {
          if (err) {
            console.error('Lỗi tạo order:', err);
            return res.status(500).json({ error: 'Lỗi tạo đơn hàng' });
          }
          
          const orderId = this.lastID;
          
          // Update quote
          db.run(
            'UPDATE quotes SET converted_order_id = ? WHERE id = ?',
            [orderId, req.params.id],
            (err) => {
              if (err) {
                console.error('Lỗi update quote:', err);
              }
              
              logAudit(req.user.userId, 'convert', 'quotes', req.params.id, { order_id: orderId });
              res.json({ 
                order_id: orderId, 
                order_code: orderCode,
                message: 'Đã chuyển báo giá thành đơn hàng' 
              });
            }
          );
        });
      });
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
