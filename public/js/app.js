// ==================== CONFIGURATION ====================
const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let token = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Kiểm tra đăng nhập
  token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    window.location.href = 'login.html';
    return;
  }
  
  currentUser = JSON.parse(userStr);
  document.getElementById('userName').textContent = currentUser.fullname;
  
  // Show/hide menu based on role
  if (currentUser.role !== 'admin') {
    const menuUsers = document.getElementById('menuUsers');
    const menuAuditLogs = document.getElementById('menuAuditLogs');
    if (menuUsers) menuUsers.style.display = 'none';
    if (menuAuditLogs) menuAuditLogs.style.display = 'none';
  }
  
  // Hide salary menu for staff
  if (currentUser.role === 'staff') {
    const menuSalaries = document.getElementById('menuSalaries');
    if (menuSalaries) menuSalaries.style.display = 'none';
  }
  
  // Hide maintenance menu for accountant and staff
  if (currentUser.role === 'accountant' || currentUser.role === 'staff') {
    const menuMaintenance = document.getElementById('menuMaintenance');
    if (menuMaintenance) menuMaintenance.style.display = 'none';
  }
  
  // Setup navigation
  setupNavigation();
  
  // Load dashboard mặc định
  loadPage('dashboard');
});

// ==================== NAVIGATION ====================
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      // Update active state
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      // Load page
      loadPage(page);
    });
  });
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// ==================== API HELPER ====================
async function apiCall(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  };
  
  try {
    // Thêm timeout 30 giây cho fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...config,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          // Chỉ logout khi token không hợp lệ
          logout();
          return;
        }
        if (response.status === 403) {
          // 403 Forbidden - không có quyền, hiển thị thông báo chi tiết
          const errorMsg = data.error || 'Bạn không có quyền thực hiện thao tác này';
          throw new Error('🔐 ' + errorMsg);
        }
        throw new Error(data.error || 'Có lỗi xảy ra');
      }
      
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Yêu cầu timeout sau 30 giây. Vui lòng thử lại.');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Helper function để chuyển FormData sang object
function formDataToObject(formData) {
  const data = {};
  for (let [key, value] of formData.entries()) {
    // Trim string values but keep empty string instead of null
    if (typeof value === 'string') {
      data[key] = value.trim();
    } else {
      data[key] = value;
    }
  }
  return data;
}

// Helper function để upload ảnh thành base64
function handleImageUpload(inputId, targetFieldName) {
  const input = document.getElementById(inputId);
  const file = input.files[0];
  
  if (!file) return;
  
  // Kiểm tra file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('File quá lớn! Vui lòng chọn ảnh dưới 5MB');
    input.value = '';
    return;
  }
  
  // Kiểm tra file type
  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn file ảnh!');
    input.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64String = e.target.result;
    // Lưu vào hidden input
    const hiddenInput = document.querySelector(`input[name="${targetFieldName}"]`);
    if (hiddenInput) {
      hiddenInput.value = base64String;
      console.log(`✅ Đã upload ảnh cho ${targetFieldName}`);
    }
  };
  reader.readAsDataURL(file);
}

// Helper function để đóng modal
function closeModal(event) {
  // Nếu có event và không phải click vào overlay thì return
  if (event && event.target.className !== 'modal-overlay') return;
  
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.remove();
  }
}

// ==================== PAGE LOADER ====================
function loadPage(page) {
  const content = document.getElementById('pageContent');
  
  switch(page) {
    case 'dashboard':
      renderDashboard(content);
      break;
    case 'orders':
      renderOrders(content);
      break;
    case 'customers':
      renderCustomers(content);
      break;
    case 'drivers':
      renderDrivers(content);
      break;
    case 'vehicles':
      renderVehicles(content);
      break;
    case 'containers':
      renderContainers(content);
      break;
    case 'routes':
      renderRoutes(content);
      break;
    case 'reports':
      renderReports(content);
      break;
    case 'accounting':
      renderAccounting(content);
      break;
    case 'salaries':
      if (typeof window.renderSalaries === 'function') {
        window.renderSalaries(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module Lương chưa tải xong</p>';
      }
      break;
    case 'maintenance':
      if (typeof window.renderMaintenance === 'function') {
        window.renderMaintenance(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module Bảo dưỡng chưa tải xong</p>';
      }
      break;
    case 'fuel':
      if (typeof window.renderFuelManagement === 'function') {
        window.renderFuelManagement(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module Quản lý nhiên liệu chưa tải xong</p>';
      }
      break;
    case 'cashflow':
      if (typeof window.renderCashFlow === 'function') {
        window.renderCashFlow(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module Thu chi chưa tải xong</p>';
      }
      break;
    case 'expense-reports':
      if (typeof window.renderExpenseReports === 'function') {
        window.renderExpenseReports(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module Báo cáo chi phí chưa tải xong</p>';
      }
      break;
    case 'crm':
      if (typeof window.renderCRM === 'function') {
        window.renderCRM(content);
      } else {
        content.innerHTML = '<p class="error">⚠️ Module CRM chưa tải xong</p>';
      }
      break;
    case 'users':
      renderUsers(content);
      break;
    case 'audit-logs':
      renderAuditLogs(content);
      break;
    default:
      content.innerHTML = '<h1>Trang không tồn tại</h1>';
  }
}

// ==================== DASHBOARD ====================
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Dashboard</h1>
    </div>
    <div class="loading">
      <div class="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>
  `;
  
  try {
    const [overview, orders, customers, vehicles, drivers] = await Promise.all([
      apiCall('/reports/overview'),
      apiCall('/orders'),
      apiCall('/customers'),
      apiCall('/vehicles'),
      apiCall('/drivers')
    ]);
    
    const recentOrders = orders.slice(0, 10);
    
    // Thống kê trạng thái đơn hàng
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const inTransitOrders = orders.filter(o => o.status === 'in-transit').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    
    // Thống kê xe
    const availableVehicles = vehicles.filter(v => v.status === 'available').length;
    const inUseVehicles = vehicles.filter(v => v.status === 'in-use').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    
    // Top 5 khách hàng theo doanh thu
    const customerRevenue = {};
    orders.forEach(o => {
      if (!customerRevenue[o.customer_id]) {
        customerRevenue[o.customer_id] = {
          name: o.customer_name,
          revenue: 0,
          orders: 0
        };
      }
      customerRevenue[o.customer_id].revenue += (o.final_amount || o.price || 0);
      customerRevenue[o.customer_id].orders += 1;
    });
    const topCustomers = Object.values(customerRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Khách hàng có công nợ cao
    const debtCustomers = customers
      .filter(c => c.current_debt > 0)
      .sort((a, b) => b.current_debt - a.current_debt)
      .slice(0, 5);
    
    // Tài xế đang hoạt động
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const inactiveDrivers = drivers.filter(d => d.status === 'inactive').length;
    
    // Load alerts for admin/dispatcher
    let alertsHTML = '';
    if (currentUser.role === 'admin' || currentUser.role === 'dispatcher') {
      try {
        const alerts = await apiCall('/alerts/vehicle-expiry');
        if (alerts && alerts.length > 0) {
          const criticalAlerts = alerts.filter(a => a.severity === 'critical');
          const warningAlerts = alerts.filter(a => a.severity === 'warning');
          
          if (criticalAlerts.length > 0) {
            alertsHTML += `<div class="alert alert-danger">
              <strong>⚠️ KHẨN CẤP (${criticalAlerts.length}):</strong><br>
              ${criticalAlerts.slice(0, 5).map(a => `• ${a.message}`).join('<br>')}
              ${criticalAlerts.length > 5 ? '<br>...' : ''}
            </div>`;
          }
          
          if (warningAlerts.length > 0) {
            alertsHTML += `<div class="alert alert-warning">
              <strong>⚠️ CẢNH BÁO (${warningAlerts.length}):</strong><br>
              ${warningAlerts.slice(0, 3).map(a => `• ${a.message}`).join('<br>')}
              ${warningAlerts.length > 3 ? '<br>...' : ''}
            </div>`;
          }
        }
      } catch (e) {
        console.error('Error loading alerts:', e);
      }
    }
    
    container.innerHTML = `
      <div class="page-header">
        <h1>📊 Dashboard - Tổng quan hệ thống</h1>
      </div>
      
      ${alertsHTML}
      
      <h3 style="margin-top: 20px;">💰 Tài chính</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Tổng đơn hàng</div>
          <div class="stat-value">${overview.totalOrders}</div>
          <div class="stat-footer">
            <span class="badge badge-info">${pendingOrders} chờ</span>
            <span class="badge badge-warning">${inTransitOrders} vận chuyển</span>
            <span class="badge badge-success">${completedOrders} hoàn thành</span>
          </div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Tổng doanh thu</div>
          <div class="stat-value">${formatMoney(overview.totalRevenue)}</div>
          <div class="stat-footer">Doanh thu từ ${overview.totalOrders} đơn</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Tổng chi phí</div>
          <div class="stat-value">${formatMoney(overview.totalCosts)}</div>
          <div class="stat-footer">Chi phí vận hành</div>
        </div>
        <div class="stat-card ${overview.profit >= 0 ? 'success' : 'danger'}">
          <div class="stat-label">Lợi nhuận</div>
          <div class="stat-value">${formatMoney(overview.profit)}</div>
          <div class="stat-footer">
            Tỷ suất: ${overview.totalRevenue > 0 ? ((overview.profit / overview.totalRevenue) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>
      
      <h3 style="margin-top: 30px;">🚛 Tài nguyên</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Xe đầu kéo</div>
          <div class="stat-value">${vehicles.length}</div>
          <div class="stat-footer">
            <span style="color: #4caf50;">${availableVehicles} sẵn sàng</span> • 
            <span style="color: #ff9800;">${inUseVehicles} đang chạy</span> • 
            <span style="color: #f44336;">${maintenanceVehicles} bảo trì</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tài xế</div>
          <div class="stat-value">${drivers.length}</div>
          <div class="stat-footer">
            <span style="color: #4caf50;">${activeDrivers} đang làm</span> • 
            <span style="color: #999;">${inactiveDrivers} nghỉ việc</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Khách hàng</div>
          <div class="stat-value">${customers.length}</div>
          <div class="stat-footer">
            <span style="color: #f44336;">${debtCustomers.length} có công nợ</span>
          </div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Tổng công nợ</div>
          <div class="stat-value">${formatMoney(customers.reduce((sum, c) => sum + (c.current_debt || 0), 0))}</div>
          <div class="stat-footer">Từ ${debtCustomers.length} khách hàng</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
        <div class="card">
          <div class="card-header">
            <h3>🏆 Top 5 khách hàng</h3>
          </div>
          <div class="card-body">
            ${topCustomers.length > 0 ? `
              <table style="width: 100%;">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th class="text-center">Số đơn</th>
                    <th class="text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  ${topCustomers.map((c, idx) => `
                    <tr>
                      <td><strong>${idx + 1}. ${c.name}</strong></td>
                      <td class="text-center">${c.orders}</td>
                      <td class="text-right" style="color: #4caf50; font-weight: bold;">
                        ${formatMoney(c.revenue)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><p>Chưa có dữ liệu</p></div>'}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>⚠️ Công nợ cần theo dõi</h3>
          </div>
          <div class="card-body">
            ${debtCustomers.length > 0 ? `
              <table style="width: 100%;">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th class="text-right">Công nợ</th>
                    <th class="text-right">Hạn mức</th>
                  </tr>
                </thead>
                <tbody>
                  ${debtCustomers.map(c => {
                    const debtPercent = c.credit_limit > 0 ? (c.current_debt / c.credit_limit * 100) : 0;
                    const isOverLimit = debtPercent > 100;
                    return `
                      <tr>
                        <td><strong>${c.name}</strong></td>
                        <td class="text-right" style="color: ${isOverLimit ? '#f44336' : '#ff9800'}; font-weight: bold;">
                          ${formatMoney(c.current_debt)}
                        </td>
                        <td class="text-right">
                          ${formatMoney(c.credit_limit)}
                          ${isOverLimit ? '<br><span class="badge badge-danger">Vượt hạn mức</span>' : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><p style="color: #4caf50;">✓ Không có công nợ</p></div>'}
          </div>
        </div>
      </div>
      
      <div class="card" style="margin-top: 20px;">
        <div class="card-header">
          <h3>📦 Đơn hàng gần đây</h3>
          <button class="btn btn-primary btn-sm" onclick="loadPage('orders')">Xem tất cả</button>
        </div>
        <div class="card-body">
          ${recentOrders.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Container</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                    <th>Giá cước</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentOrders.map(order => `
                    <tr onclick="viewOrderDetail(${order.id})" style="cursor: pointer;">
                      <td><strong>${order.order_code}</strong></td>
                      <td>${order.customer_name}</td>
                      <td>${order.container_number || '-'}</td>
                      <td>${formatDate(order.order_date)}</td>
                      <td>${getStatusBadge(order.status)}</td>
                      <td class="text-right">${formatMoney(order.price)}</td>
                      <td class="text-right" style="font-weight: bold; color: #4caf50;">
                        ${formatMoney(order.final_amount || order.price)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><p>Chưa có đơn hàng nào</p></div>'}
        </div>
      </div>
    `;
  } catch (error) {
    showError(container, 'Lỗi tải dashboard: ' + error.message);
  }
}

// ==================== ORDERS ====================
async function renderOrders(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const orders = await apiCall('/orders');
    const customers = await apiCall('/customers');
    const containers = await apiCall('/containers');
    const drivers = await apiCall('/drivers');
    const vehicles = await apiCall('/vehicles');
    const routes = await apiCall('/routes');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>📦 Quản lý đơn hàng</h1>
        ${['admin', 'dispatcher'].includes(currentUser.role) ? `
        <button class="btn btn-primary" onclick="showOrderModal()">
          ➕ Tạo đơn mới
        </button>
        ` : ''}
      </div>
      
      <div class="filters">
        <div class="form-row">
          <div class="form-group">
            <label>Khách hàng</label>
            <select id="filterCustomer" onchange="filterOrders()">
              <option value="">Tất cả</option>
              ${customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select id="filterStatus" onchange="filterOrders()">
              <option value="">Tất cả</option>
              <option value="pending">Chờ xử lý</option>
              <option value="in-transit">Đang vận chuyển</option>
              <option value="completed">Hoàn thành</option>
            </select>
          </div>
          <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="filterFromDate" onchange="filterOrders()">
          </div>
          <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="filterToDate" onchange="filterOrders()">
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body">
          <div class="table-container" id="ordersTable">
            ${orders.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách hàng</th>
                    <th>Tuyến</th>
                    <th>Container</th>
                    <th>Tài xế</th>
                    <th>Ngày đặt</th>
                    <th>Từ - Đến</th>
                    <th>Hàng hóa</th>
                    <th>Trạng thái</th>
                    <th>Giá cước</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.map(order => `
                    <tr data-order-id="${order.id}">
                      <td><strong>${order.order_code}</strong></td>
                      <td>${order.customer_name}</td>
                      <td>${order.route_name || '-'}</td>
                      <td>${order.container_number || '-'}</td>
                      <td>${order.driver_name || '-'}</td>
                      <td>${formatDate(order.order_date)}</td>
                      <td><small>${order.pickup_location ? order.pickup_location.substring(0, 15) + '...' : '-'} → ${order.delivery_location ? order.delivery_location.substring(0, 15) + '...' : '-'}</small></td>
                      <td><small>${order.cargo_description ? order.cargo_description.substring(0, 20) + '...' : '-'}</small></td>
                      <td>${getStatusBadge(order.status)}</td>
                      <td class="text-right"><strong>${formatMoney(order.price)}</strong></td>
                      <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="viewOrderDetail(${order.id})">Chi tiết</button>
                        ${currentUser.role === 'admin' || currentUser.role === 'dispatcher' ? `<button class="btn btn-sm btn-warning" onclick="showOrderModal(${order.id})">Sửa</button>` : ''}
                        ${currentUser.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteOrder(${order.id})">Xóa</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><div class="empty-state-icon">📦</div><p>Chưa có đơn hàng nào</p></div>'}
          </div>
        </div>
      </div>
    `;
    
    // Store data for modal
    window.ordersData = { customers, containers, drivers, vehicles, routes, orders };
  } catch (error) {
    showError(container, 'Lỗi tải đơn hàng: ' + error.message);
  }
}

function showOrderModal(orderId = null) {
  const { customers, containers, drivers, vehicles, routes, orders } = window.ordersData;
  const order = orderId ? orders.find(o => o.id === orderId) : null;
  const isEdit = !!order;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${isEdit ? 'Sửa đơn hàng' : 'Tạo đơn hàng mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="orderForm" class="modal-body" onsubmit="saveOrder(event, ${orderId})">
          <div class="form-row">
            <div class="form-group">
              <label>Khách hàng *</label>
              <select name="customer_id" id="orderCustomerId" required>
                <option value="">-- Chọn khách hàng --</option>
                ${customers.map(c => `
                  <option value="${c.id}" ${order && order.customer_id == c.id ? 'selected' : ''}>
                    ${c.name}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Ngày vận chuyển *</label>
              <input type="date" name="order_date" value="${order ? formatDateForInput(order.order_date) : ''}" required>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Tuyến đường</label>
              <select name="route_id">
                <option value="">-- Chọn tuyến --</option>
                ${routes.map(r => `
                  <option value="${r.id}" ${order && order.route_id === r.id ? 'selected' : ''}>
                    ${r.route_name}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Container *</label>
              <select name="container_id" required>
                <option value="">-- Chọn container --</option>
                ${containers.map(c => `
                  <option value="${c.id}" ${order && order.container_id === c.id ? 'selected' : ''}>
                    ${c.container_number}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Xe đầu kéo</label>
              <select name="vehicle_id">
                <option value="">-- Chọn xe --</option>
                ${vehicles.map(v => `
                  <option value="${v.id}" ${order && order.vehicle_id === v.id ? 'selected' : ''}>
                    ${v.plate_number}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Tài xế</label>
              <select name="driver_id">
                <option value="">-- Chọn tài xế --</option>
                ${drivers.filter(d => d.status === 'active').map(d => `
                  <option value="${d.id}" ${order && order.driver_id === d.id ? 'selected' : ''}>
                    ${d.name}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Ngày nhận hàng</label>
              <input type="date" name="pickup_date" value="${order ? formatDateForInput(order.pickup_date) : ''}">
            </div>
            <div class="form-group">
              <label>Ngày giao hàng</label>
              <input type="date" name="delivery_date" value="${order ? formatDateForInput(order.delivery_date) : ''}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Nơi đóng hàng</label>
              <input type="text" name="pickup_location" value="${order ? (order.pickup_location || '') : ''}" placeholder="Vd: Cát Lái, HCM">
            </div>
            <div class="form-group">
              <label>Điểm trung</label>
              <input type="text" name="intermediate_point" value="${order ? (order.intermediate_point || '') : ''}" placeholder="Vd: Phnom Penh, Cambodia">
            </div>
            <div class="form-group">
              <label>Nơi trả hàng</label>
              <input type="text" name="delivery_location" value="${order ? (order.delivery_location || '') : ''}" placeholder="Vd: Cát Lái, HCM">
            </div>
          </div>
          
          <div class="form-group">
            <label>Mô tả hàng hóa</label>
            <textarea name="cargo_description" rows="2">${order ? (order.cargo_description || '') : ''}</textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Booking Number</label>
              <input type="text" name="booking_number" value="${order ? (order.booking_number || '') : ''}" placeholder="Mã booking">
            </div>
            <div class="form-group">
              <label>Bill of Lading (B/L)</label>
              <input type="text" name="bill_of_lading" value="${order ? (order.bill_of_lading || '') : ''}" placeholder="Số vận đơn">
            </div>
            <div class="form-group">
              <label>Seal Number</label>
              <input type="text" name="seal_number" value="${order ? (order.seal_number || '') : ''}" placeholder="Số seal">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Loại hàng hóa</label>
              <select name="cargo_type">
                <option value="">-- Chọn loại --</option>
                <option value="Nguyên liệu" ${order && order.cargo_type === 'Nguyên liệu' ? 'selected' : ''}>Nguyên liệu</option>
                <option value="Thành phẩm" ${order && order.cargo_type === 'Thành phẩm' ? 'selected' : ''}>Thành phẩm</option>
                <option value="Hàng nguy hiểm" ${order && order.cargo_type === 'Hàng nguy hiểm' ? 'selected' : ''}>Hàng nguy hiểm</option>
                <option value="Khác" ${order && order.cargo_type === 'Khác' ? 'selected' : ''}>Khác</option>
              </select>
            </div>
            <div class="form-group">
              <label>Số lượng</label>
              <input type="number" name="quantity" step="0.01" value="${order ? (order.quantity || '') : ''}">
            </div>
            <div class="form-group">
              <label>Trọng lượng (tấn)</label>
              <input type="number" name="weight" step="0.01" value="${order ? (order.weight || '') : ''}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Cước vận chuyển (VND) *</label>
              <input type="number" id="orderPrice" name="price" step="1000" value="${order ? order.price : ''}" required onchange="calculateOrderTotal()">
            </div>
            <div class="form-group">
              <label>Néo xe (VND)</label>
              <input type="number" id="orderNeoXe" name="neo_xe" step="1000" value="${order ? (order.neo_xe || 0) : 0}" onchange="calculateOrderTotal()">
            </div>
            <div class="form-group">
              <label>Chi hộ (VND)</label>
              <input type="number" id="orderChiHo" name="chi_ho" step="1000" value="${order ? (order.chi_ho || 0) : 0}" onchange="calculateOrderTotal()">
            </div>
          </div>
          
          <div class="form-row" style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 10px;">
            <div class="form-group">
              <label>Tổng trước VAT</label>
              <input type="text" id="orderSubtotal" readonly style="background: #e8f4f8; font-weight: bold;" value="0">
            </div>
            <div class="form-group">
              <label>VAT (10%)</label>
              <input type="text" id="orderVAT" readonly style="background: #e8f4f8; font-weight: bold;" value="0">
            </div>
            <div class="form-group">
              <label style="color: #d32f2f;">Tổng cuối cùng</label>
              <input type="number" id="orderFinalAmount" name="final_amount" readonly style="background: #fff3e0; font-weight: bold; color: #d32f2f; font-size: 16px;" value="${order ? order.final_amount || 0 : 0}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Trạng thái</label>
              <select name="status">
                <option value="pending" ${order && order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                <option value="in-transit" ${order && order.status === 'in-transit' ? 'selected' : ''}>Đang vận chuyển</option>
                <option value="completed" ${order && order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${order ? (order.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="orderForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
  
  // Tính tổng nếu đang edit order có sẵn giá trị
  if (order && order.price) {
    setTimeout(() => calculateOrderTotal(), 100);
  }
}

// Tính tổng đơn hàng với VAT
function calculateOrderTotal() {
  const price = parseFloat(document.getElementById('orderPrice')?.value || 0);
  const neoXe = parseFloat(document.getElementById('orderNeoXe')?.value || 0);
  const chiHo = parseFloat(document.getElementById('orderChiHo')?.value || 0);
  
  const subtotal = price + neoXe + chiHo;
  const vat = Math.round(subtotal * 0.1);
  const finalAmount = subtotal + vat;
  
  document.getElementById('orderSubtotal').value = formatMoney(subtotal);
  document.getElementById('orderVAT').value = formatMoney(vat);
  document.getElementById('orderFinalAmount').value = finalAmount;
}

async function saveOrder(event, orderId) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  
  // Convert empty strings to null for optional fields only
  const optionalFields = ['route_id', 'vehicle_id', 'driver_id', 'pickup_date', 'delivery_date', 
                          'pickup_location', 'intermediate_point', 'delivery_location', 
                          'cargo_description', 'quantity', 'weight', 'notes',
                          'booking_number', 'bill_of_lading', 'seal_number', 'cargo_type'];
  
  optionalFields.forEach(field => {
    if (data[field] === '') data[field] = null;
  });
  
  // Ensure numeric fields are numbers or 0
  if (!data.neo_xe || data.neo_xe === '') data.neo_xe = 0;
  if (!data.chi_ho || data.chi_ho === '') data.chi_ho = 0;
  
  // Validate required fields
  if (!data.customer_id) {
    alert('Vui lòng chọn khách hàng');
    return;
  }
  if (!data.container_id) {
    alert('Vui lòng chọn container');
    return;
  }
  if (!data.order_date) {
    alert('Vui lòng chọn ngày vận chuyển');
    return;
  }
  if (!data.price) {
    alert('Vui lòng nhập cước vận chuyển');
    return;
  }
  
  // Kiểm tra hạn mức công nợ khi tạo đơn mới
  if (!orderId && data.customer_id && data.final_amount) {
    try {
      const customer = await apiCall(`/customers/${data.customer_id}`);
      const currentDebt = customer.current_debt || 0;
      const creditLimit = customer.credit_limit || 0;
      const newTotalDebt = currentDebt + parseFloat(data.final_amount);
      
      if (creditLimit > 0 && newTotalDebt > creditLimit) {
        const exceed = newTotalDebt - creditLimit;
        const confirmMsg = `⚠️ CẢNH BÁO VƯỢT HẠN MỨC CÔNG NỢ!\n\n` +
                          `Khách hàng: ${customer.name}\n` +
                          `Công nợ hiện tại: ${formatMoney(currentDebt)} VND\n` +
                          `Hạn mức: ${formatMoney(creditLimit)} VND\n` +
                          `Đơn hàng này: ${formatMoney(data.final_amount)} VND\n` +
                          `Tổng công nợ sau: ${formatMoney(newTotalDebt)} VND\n` +
                          `Vượt hạn mức: ${formatMoney(exceed)} VND\n\n` +
                          `Bạn có chắc chắn muốn tiếp tục tạo đơn?`;
        
        if (!confirm(confirmMsg)) {
          return;
        }
      }
    } catch (err) {
      console.error('Error checking credit limit:', err);
      // Tiếp tục tạo đơn nếu không check được
    }
  }
  
  console.log('Saving order data:', data);
  
  try {
    if (orderId) {
      await apiCall(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/orders', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    loadPage('orders');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function viewOrderDetail(orderId) {
  try {
    const order = await apiCall(`/orders/${orderId}`);
    order.advances = await apiCall(`/orders/${orderId}/advances`);
    order.documents = await apiCall(`/orders/${orderId}/documents`);
    
    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()" style="max-width: 1000px;">
          <div class="modal-header">
            <h2>Chi tiết đơn hàng: ${order.order_code}</h2>
            <span class="badge ${order.status === 'completed' ? 'badge-active' : order.status === 'in-transit' ? 'badge-warning' : 'badge-pending'}">${getStatusBadge(order.status)}</span>
            <button class="btn btn-sm btn-primary" onclick="editOrderFromDetail(${orderId})">✏️ Chỉnh sửa</button>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <!-- QUICK STATUS UPDATE -->
            <div class="status-update-section">
              <h4>⚡ Cập nhật trạng thái nhanh</h4>
              <div class="form-row">
                <div class="form-group">
                  <label>Ngày nhận hàng</label>
                  <input type="date" id="quickPickupDate" value="${order.pickup_date || ''}" 
                    onchange="quickUpdateOrder(${orderId}, 'pickup_date', this.value, 'in-transit')">
                </div>
                <div class="form-group">
                  <label>Ngày giao hàng</label>
                  <input type="date" id="quickDeliveryDate" value="${order.delivery_date || ''}"
                    onchange="quickUpdateOrder(${orderId}, 'delivery_date', this.value, 'completed')">
                </div>
                <div class="form-group">
                  <label>Trạng thái</label>
                  <select id="quickStatus" onchange="quickUpdateOrder(${orderId}, 'status', this.value)">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                    <option value="in-transit" ${order.status === 'in-transit' ? 'selected' : ''}>Đang vận chuyển</option>
                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                  </select>
                </div>
              </div>
            </div>
            
            <hr>
            
            <div class="form-row">
              <div>
                <h4>Thông tin khách hàng</h4>
                <p><strong>Tên công ty:</strong> ${order.customer_name}</p>
                <p><strong>Điện thoại:</strong> ${order.customer_phone || '-'}</p>
                <p><strong>Địa chỉ:</strong> ${order.customer_address || '-'}</p>
              </div>
              <div>
                <h4>Thông tin chuyến xe</h4>
                <p><strong>Container:</strong> ${order.container_number || '-'}</p>
                <p><strong>Xe:</strong> ${order.vehicle_plate || '-'}</p>
                <p><strong>Tài xế:</strong> ${order.driver_name || '-'}</p>
                <p><strong>SĐT tài xế:</strong> ${order.driver_phone || '-'}</p>
              </div>
            </div>
            
            <hr>
            
            <div class="form-row">
              <div>
                <p><strong>Ngày đặt:</strong> ${formatDate(order.order_date)}</p>
                <p><strong>Ngày nhận:</strong> ${order.pickup_date ? formatDate(order.pickup_date) : '-'}</p>
                <p><strong>Ngày giao:</strong> ${order.delivery_date ? formatDate(order.delivery_date) : '-'}</p>
              </div>
              <div>
                <p><strong>Hàng hóa:</strong> ${order.cargo_description || '-'}</p>
                <p><strong>Số lượng:</strong> ${order.quantity || '-'}</p>
                <p><strong>Trọng lượng:</strong> ${order.weight ? order.weight + ' tấn' : '-'}</p>
              </div>
            </div>
            
            <hr>
            
            <h4>Chi phí chuyến xe</h4>
            <button class="btn btn-sm btn-primary mb-20" onclick="showCostModal(${orderId})">➕ Thêm chi phí</button>
            ${order.costs && order.costs.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Loại chi phí</th>
                    <th>Số tiền</th>
                    <th>Chi tiết dầu</th>
                    <th>Quãng đường</th>
                    <th>Ngày</th>
                    <th>Biên lai</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.costs.map(cost => `
                    <tr>
                      <td>${cost.cost_type}</td>
                      <td class="text-right">${formatMoney(cost.amount)}</td>
                      <td>${cost.fuel_liters ? cost.fuel_liters + 'L × ' + formatMoney(cost.fuel_price_per_liter) + 'đ' : '-'}</td>
                      <td>${cost.distance_km ? cost.distance_km + ' km' : '-'}</td>
                      <td>${cost.cost_date ? formatDate(cost.cost_date) : '-'}</td>
                      <td>${cost.receipt_number || '-'}</td>
                      <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteCost(${cost.id})">Xóa</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Tổng chi phí</th>
                    <th class="text-right">${formatMoney(order.costs.reduce((sum, c) => sum + c.amount, 0))}</th>
                    <th colspan="5"></th>
                  </tr>
                </tfoot>
              </table>
            ` : '<p class="text-muted">Chưa có chi phí nào</p>'}
            
            <hr>
            
            <h4>Tạm ứng tài xế</h4>
            <button class="btn btn-sm btn-warning mb-20" onclick="showAdvanceModal(${orderId}, ${order.driver_id})">💰 Tạm ứng cho tài xế</button>
            ${order.advances && order.advances.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Ngày tạm ứng</th>
                    <th>Số tiền</th>
                    <th>Quyết toán</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.advances.map(adv => `
                    <tr>
                      <td>${formatDate(adv.advance_date)}</td>
                      <td class="text-right">${formatMoney(adv.amount)}</td>
                      <td>${adv.settled ? '<span class="badge badge-active">Đã quyết toán ' + formatDate(adv.settlement_date) + '</span>' : '<span class="badge badge-pending">Chưa quyết toán</span>'}</td>
                      <td>${adv.notes || '-'}</td>
                      <td>
                        ${!adv.settled ? `<button class="btn btn-sm btn-success" onclick="settleAdvance(${adv.id})">Quyết toán</button>` : ''}
                        <button class="btn btn-sm btn-danger" onclick="deleteAdvance(${adv.id})">Xóa</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Tổng tạm ứng</th>
                    <th class="text-right">${formatMoney(order.advances.reduce((sum, a) => sum + a.amount, 0))}</th>
                    <th colspan="3"></th>
                  </tr>
                </tfoot>
              </table>
            ` : '<p class="text-muted">Chưa có tạm ứng nào</p>'}
            
            <hr>
            
            <h4>Thanh toán từ khách hàng</h4>
            ${['admin', 'accountant'].includes(currentUser.role) ? `<button class="btn btn-sm btn-success mb-20" onclick="showPaymentModal(${orderId}, ${order.customer_id})">➕ Thêm thanh toán</button>` : ''}
            ${order.payments && order.payments.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Số tiền</th>
                    <th>Hình thức</th>
                    <th>Số tham chiếu</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.payments.map(payment => `
                    <tr>
                      <td>${formatDate(payment.payment_date)}</td>
                      <td class="text-right">${formatMoney(payment.amount)}</td>
                      <td>${payment.payment_method || '-'}</td>
                      <td>${payment.reference_number || '-'}</td>
                      <td>${payment.notes || '-'}</td>
                      <td>
                        ${['admin', 'accountant'].includes(currentUser.role) ? `<button class="btn btn-sm btn-danger" onclick="deletePayment(${payment.id})">Xóa</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Tổng thanh toán</th>
                    <th class="text-right">${formatMoney(order.payments.reduce((sum, p) => sum + p.amount, 0))}</th>
                    <th colspan="4"></th>
                  </tr>
                </tfoot>
              </table>
            ` : '<p class="text-muted">Chưa có thanh toán nào</p>'}
            
            <hr>
            
            <h4>📎 Chứng từ giao hàng (POD)</h4>
            <button class="btn btn-sm btn-primary mb-20" onclick="showUploadPODModal(${orderId})">📤 Upload POD</button>
            ${order.documents && order.documents.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th>Loại tài liệu</th>
                    <th>Tên file</th>
                    <th>Ngày upload</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.documents.map(doc => `
                    <tr>
                      <td>${doc.document_type}</td>
                      <td>${doc.file_name}</td>
                      <td>${formatDate(doc.uploaded_at)}</td>
                      <td>
                        <button class="btn btn-sm btn-primary" onclick="viewDocument(${doc.id})">Xem</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDocument(${doc.id})">Xóa</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p class="text-muted">Chưa có chứng từ nào</p>'}
            
            <hr>
            
            <h4>Tổng kết</h4>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Doanh thu</div>
                <div class="stat-value">${formatMoney(order.price)}</div>
              </div>
              <div class="stat-card warning">
                <div class="stat-label">Chi phí</div>
                <div class="stat-value">${formatMoney(order.costs ? order.costs.reduce((sum, c) => sum + c.amount, 0) : 0)}</div>
              </div>
              <div class="stat-card ${(order.price - (order.costs ? order.costs.reduce((sum, c) => sum + c.amount, 0) : 0)) >= 0 ? 'success' : 'danger'}">
                <div class="stat-label">Lợi nhuận</div>
                <div class="stat-value">${formatMoney(order.price - (order.costs ? order.costs.reduce((sum, c) => sum + c.amount, 0) : 0))}</div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
            <button class="btn btn-primary" onclick="exportWaybill(${orderId})">📄 Xuất bảng kê</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function showCostModal(orderId) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Thêm chi phí chuyến xe</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="costForm" class="modal-body" onsubmit="saveCost(event, ${orderId})">
          <div class="form-group">
            <label>Loại chi phí *</label>
            <select name="cost_type" id="costType" onchange="toggleFuelFields(this.value)" required>
              <option value="Dầu xe">Dầu xe</option>
              <option value="Chi hộ">Chi hộ</option>
              <option value="Nẹo xe">Nẹo xe</option>
              <option value="Phí cầu đường">Phí cầu đường</option>
              <option value="Phí bãi xe">Phí bãi xe</option>
              <option value="Bốc xếp">Bốc xếp</option>
              <option value="Sửa chữa">Sửa chữa</option>
              <option value="Phát sinh khác">Phát sinh khác</option>
            </select>
          </div>
          
          <div id="fuelFields" style="display: block;">
            <div class="form-row">
              <div class="form-group">
                <label>Số lít dầu</label>
                <input type="number" name="fuel_liters" id="fuelLiters" step="0.1" placeholder="VD: 140" onchange="calculateFuelAmount()">
              </div>
              <div class="form-group">
                <label>Đơn giá (đ/lít)</label>
                <input type="number" name="fuel_price_per_liter" id="fuelPrice" step="100" placeholder="VD: 25000" onchange="calculateFuelAmount()">
              </div>
            </div>
            <div class="form-group">
              <label>Quãng đường (km)</label>
              <input type="number" name="distance_km" step="0.1" placeholder="VD: 500">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Tổng tiền (VND) *</label>
              <input type="number" name="amount" id="totalAmount" step="1000" required>
            </div>
            <div class="form-group">
              <label>Ngày chi</label>
              <input type="date" name="cost_date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
          
          <div class="form-group">
            <label>Số hóa đơn/biên lai</label>
            <input type="text" name="receipt_number" placeholder="VD: HD123456">
          </div>
          
          <div class="form-group">
            <label>File hóa đơn (ảnh/PDF)</label>
            <input type="file" name="invoice_file" accept="image/*,application/pdf" onchange="previewInvoice(this)">
            <small style="color: #666;">Chức năng upload sẽ được thêm trong phiên bản tiếp theo</small>
          </div>
          
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2" placeholder="Thêm ghi chú nếu cần..."></textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="costForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

function toggleFuelFields(costType) {
  const fuelFields = document.getElementById('fuelFields');
  if (costType === 'Dầu xe') {
    fuelFields.style.display = 'block';
  } else {
    fuelFields.style.display = 'none';
    document.getElementById('fuelLiters').value = '';
    document.getElementById('fuelPrice').value = '';
  }
}

async function editOrderFromDetail(orderId) {
  try {
    closeModal();

    const order = await apiCall(`/orders/${orderId}`);
    const { customers, containers, drivers, vehicles, routes } = window.ordersData;

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>✏️ Chỉnh sửa đơn hàng: ${order.order_code}</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="editOrderForm" class="modal-body" onsubmit="saveEditOrder(event, ${orderId})">
            <div class="form-row">
              <div class="form-group">
                <label>Khách hàng *</label>
                <select name="customer_id" required>
                  <option value="">-- Chọn khách hàng --</option>
                  ${customers.map(c => `
                    <option value="${c.id}" ${order.customer_id == c.id ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Ngày đặt hàng *</label>
                <input type="date" name="order_date" value="${formatDateForInput(order.order_date)}" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Tuyến đường</label>
                <select name="route_id">
                  <option value="">-- Chọn tuyến --</option>
                  ${routes.map(r => `
                    <option value="${r.id}" ${order.route_id == r.id ? 'selected' : ''}>${r.route_name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Container *</label>
                <select name="container_id" required>
                  <option value="">-- Chọn container --</option>
                  ${containers.map(c => `
                    <option value="${c.id}" ${order.container_id == c.id ? 'selected' : ''}>${c.container_number}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Xe vận chuyển</label>
                <select name="vehicle_id">
                  <option value="">-- Chọn xe --</option>
                  ${vehicles.map(v => `
                    <option value="${v.id}" ${order.vehicle_id == v.id ? 'selected' : ''}>${v.plate_number}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Tài xế</label>
                <select name="driver_id">
                  <option value="">-- Chọn tài xế --</option>
                  ${drivers.map(d => `
                    <option value="${d.id}" ${order.driver_id == d.id ? 'selected' : ''}>${d.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Địa điểm nhận hàng</label>
                <input type="text" name="pickup_location" value="${order.pickup_location || ''}">
              </div>
              <div class="form-group">
                <label>Ngày nhận hàng</label>
                <input type="date" name="pickup_date" value="${order.pickup_date ? formatDateForInput(order.pickup_date) : ''}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Địa điểm giao hàng</label>
                <input type="text" name="delivery_location" value="${order.delivery_location || ''}">
              </div>
              <div class="form-group">
                <label>Ngày giao hàng</label>
                <input type="date" name="delivery_date" value="${order.delivery_date ? formatDateForInput(order.delivery_date) : ''}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Điểm dừng trung gian</label>
                <input type="text" name="intermediate_point" value="${order.intermediate_point || ''}">
              </div>
            </div>

            <div class="form-group">
              <label>Mô tả hàng hóa</label>
              <textarea name="cargo_description" rows="2">${order.cargo_description || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Số lượng</label>
                <input type="number" name="quantity" step="0.01" value="${order.quantity || ''}">
              </div>
              <div class="form-group">
                <label>Trọng lượng (tấn)</label>
                <input type="number" name="weight" step="0.01" value="${order.weight || ''}">
              </div>
              <div class="form-group">
                <label>Giá cước cơ bản (VND)</label>
                <input type="number" name="price" step="1000" value="${order.price || ''}" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nẹo xe (VND)</label>
                <input type="number" name="neo_xe" step="1000" value="${order.neo_xe || 0}">
              </div>
              <div class="form-group">
                <label>Chi hộ (VND)</label>
                <input type="number" name="chi_ho" step="1000" value="${order.chi_ho || 0}">
              </div>
              <div class="form-group">
                <label>Thuế VAT (%)</label>
                <input type="number" name="vat_rate" step="0.01" value="${order.vat_rate ? (Number(order.vat_rate) * 100) : 10}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Số hiệu vận đơn</label>
                <input type="text" name="booking_number" value="${order.booking_number || ''}">
              </div>
              <div class="form-group">
                <label>Số hiệu bộ hàng</label>
                <input type="text" name="bill_of_lading" value="${order.bill_of_lading || ''}">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Số seal</label>
                <input type="text" name="seal_number" value="${order.seal_number || ''}">
              </div>
              <div class="form-group">
                <label>Loại hàng hóa</label>
                <input type="text" name="cargo_type" value="${order.cargo_type || ''}">
              </div>
            </div>

            <div class="form-group">
              <label>Ghi chú</label>
              <textarea name="notes" rows="2">${order.notes || ''}</textarea>
            </div>

            <div class="form-group">
              <label>Trạng thái</label>
              <select name="status">
                <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                <option value="in-transit" ${order.status === 'in-transit' ? 'selected' : ''}>Đang vận chuyển</option>
                <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
              </select>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="editOrderForm" class="btn btn-primary">💾 Lưu thay đổi</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    showError(null, 'Lỗi tải dữ liệu: ' + error.message);
  }
}

async function saveEditOrder(e, orderId) {
  e.preventDefault();
  try {
    const formData = new FormData(document.getElementById('editOrderForm'));
    const data = Object.fromEntries(formData);

    if (data.vat_rate !== undefined && data.vat_rate !== null && data.vat_rate !== '') {
      data.vat_rate = parseFloat(data.vat_rate) / 100;
    }

    await apiCall(`/orders/${orderId}`, 'PUT', data);
    showSuccess('Cập nhật đơn hàng thành công');
    closeModal();
    loadOrders();
  } catch (error) {
    showError(null, 'Lỗi cập nhật: ' + error.message);
  }
}

function calculateFuelAmount() {
  const liters = parseFloat(document.getElementById('fuelLiters').value) || 0;
  const pricePerLiter = parseFloat(document.getElementById('fuelPrice').value) || 0;
  
  // Validation: Giá dầu phải từ 15,000 đến 40,000 VND/lít
  if (pricePerLiter > 0 && (pricePerLiter < 15000 || pricePerLiter > 40000)) {
    const warningDiv = document.getElementById('fuelWarning') || createWarningDiv();
    warningDiv.style.display = 'block';
    warningDiv.innerHTML = `
      <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <strong>⚠️ Cảnh báo:</strong> Giá dầu bất thường! 
        <br>Giá nhập: <strong>${pricePerLiter.toLocaleString('vi-VN')}</strong> VND/lít
        <br>Khoảng giá hợp lý: <strong>15,000 - 40,000</strong> VND/lít
        <br><em>Vui lòng kiểm tra lại nếu đây không phải giá thực tế</em>
      </div>
    `;
  } else {
    const warningDiv = document.getElementById('fuelWarning');
    if (warningDiv) warningDiv.style.display = 'none';
  }
  
  if (liters > 0 && pricePerLiter > 0) {
    document.getElementById('totalAmount').value = Math.round(liters * pricePerLiter);
  }
}

function createWarningDiv() {
  const warningDiv = document.createElement('div');
  warningDiv.id = 'fuelWarning';
  const fuelPriceInput = document.getElementById('fuelPrice');
  fuelPriceInput.parentNode.appendChild(warningDiv);
  return warningDiv;
}

function previewInvoice(input) {
  // Placeholder cho chức năng upload trong tương lai
  if (input.files && input.files[0]) {
    console.log('File selected:', input.files[0].name);
  }
}

async function saveCost(event, orderId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);
  
  // Remove file field as upload is not yet implemented
  delete data.invoice_file;
  
  // Convert empty strings to null for optional numeric fields
  if (!data.fuel_liters) data.fuel_liters = null;
  if (!data.fuel_price_per_liter) data.fuel_price_per_liter = null;
  if (!data.distance_km) data.distance_km = null;
  
  try {
    console.log('📤 Saving cost:', data);
    await apiCall(`/orders/${orderId}/costs`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    closeModal();
    viewOrderDetail(orderId);
  } catch (error) {
    console.error('❌ Cost save error:', error);
    alert('Lỗi tạo chi phí: ' + error.message);
  }
}

async function deleteCost(costId) {
  if (!confirm('Xác nhận xóa chi phí này?')) return;
  
  try {
    await apiCall(`/costs/${costId}`, { method: 'DELETE' });
    // Reload current order detail
    const modal = document.querySelector('.modal');
    if (modal) {
      const orderCode = modal.querySelector('h2').textContent.match(/ORD\d+/);
      if (orderCode) {
        const orders = window.ordersData.orders;
        const order = orders.find(o => o.order_code === orderCode[0]);
        if (order) viewOrderDetail(order.id);
      }
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function showPaymentModal(orderId, customerId) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Ghi nhận thanh toán</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="paymentForm" class="modal-body" onsubmit="savePayment(event, ${orderId}, ${customerId})">
          <div class="form-row">
            <div class="form-group">
              <label>Ngày thanh toán *</label>
              <input type="date" name="payment_date" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label>Số tiền (VND) *</label>
              <input type="number" name="amount" step="1000" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Hình thức thanh toán</label>
              <select name="payment_method">
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Chuyển khoản">Chuyển khoản</option>
                <option value="Séc">Séc</option>
              </select>
            </div>
            <div class="form-group">
              <label>Số tham chiếu</label>
              <input type="text" name="reference_number">
            </div>
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2"></textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="paymentForm" class="btn btn-success">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function savePayment(event, orderId, customerId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);
  data.customer_id = customerId;
  
  try {
    console.log('📤 Saving payment:', data);
    await apiCall(`/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    closeModal();
    viewOrderDetail(orderId);
  } catch (error) {
    console.error('❌ Payment save error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function deletePayment(paymentId) {
  if (!confirm('Xác nhận xóa thanh toán này?')) return;
  
  try {
    await apiCall(`/payments/${paymentId}`, { method: 'DELETE' });
    // Reload current order detail
    const modal = document.querySelector('.modal');
    if (modal) {
      const orderCode = modal.querySelector('h2').textContent.match(/ORD\d+/);
      if (orderCode) {
        const orders = window.ordersData.orders;
        const order = orders.find(o => o.order_code === orderCode[0]);
        if (order) viewOrderDetail(order.id);
      }
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteOrder(orderId) {
  if (!confirm('Xác nhận xóa đơn hàng này? Tất cả chi phí và thanh toán liên quan sẽ bị xóa.')) return;
  
  try {
    await apiCall(`/orders/${orderId}`, { method: 'DELETE' });
    loadPage('orders');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== DRIVER ADVANCES FUNCTIONS ====================
function showAdvanceModal(orderId, driverId) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Tạm ứng cho tài xế</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="advanceForm" class="modal-body" onsubmit="saveAdvance(event, ${orderId}, ${driverId})">
          <div class="form-group">
            <label>Ngày tạm ứng *</label>
            <input type="date" name="advance_date" value="${new Date().toISOString().split('T')[0]}" required>
          </div>
          <div class="form-group">
            <label>Số tiền (VND) *</label>
            <input type="number" name="amount" step="1000" required placeholder="Ví dụ: 5000000">
          </div>
          <div class="form-group">
            <label>Mục đích tạm ứng</label>
            <textarea name="notes" rows="3" placeholder="Ví dụ: Tiền dầu, cầu đường cho chuyến HN-SG"></textarea>
          </div>
          <p class="text-muted"><em>Lưu ý: Tạm ứng cho tài xế để chi phí dọc đường (dầu, cầu đường, bốc xếp...). Nhớ quyết toán sau khi chuyến xe hoàn thành.</em></p>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="advanceForm" class="btn btn-primary">Tạm ứng</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function saveAdvance(event, orderId, driverId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);
  data.driver_id = driverId;
  
  try {
    console.log('📤 Saving advance:', data);
    await apiCall(`/orders/${orderId}/advances`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    alert('Tạm ứng thành công!');
    closeModal();
    viewOrderDetail(orderId);
  } catch (error) {
    console.error('❌ Advance save error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function settleAdvance(advanceId) {
  if (!confirm('Xác nhận quyết toán tạm ứng này?')) return;
  
  try {
    await apiCall(`/advances/${advanceId}/settle`, {
      method: 'PUT',
      body: JSON.stringify({ settlement_date: new Date().toISOString().split('T')[0] })
    });
    
    alert('Quyết toán thành công!');
    const modal = document.querySelector('.modal');
    if (modal) {
      const orderCode = modal.querySelector('h2').textContent.match(/ORD\d+/);
      if (orderCode) {
        const orders = window.ordersData.orders;
        const order = orders.find(o => o.order_code === orderCode[0]);
        if (order) viewOrderDetail(order.id);
      }
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// Quick update order status/dates
async function quickUpdateOrder(orderId, field, value, autoStatus = null) {
  try {
    const updateData = { [field]: value };
    
    // Auto update status when dates change
    if (autoStatus) {
      updateData.status = autoStatus;
    }
    
    await apiCall(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData)
    });
    
    // Show success message
    const fieldName = field === 'pickup_date' ? 'ngày nhận hàng' : 
                     field === 'delivery_date' ? 'ngày giao hàng' : 'trạng thái';
    alert(`✓ Đã cập nhật ${fieldName} thành công!`);
    
    // Reload order detail
    viewOrderDetail(orderId);
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteAdvance(advanceId) {
  if (!confirm('Xác nhận xóa tạm ứng này?')) return;
  
  try {
    await apiCall(`/advances/${advanceId}`, { method: 'DELETE' });
    
    const modal = document.querySelector('.modal');
    if (modal) {
      const orderCode = modal.querySelector('h2').textContent.match(/ORD\d+/);
      if (orderCode) {
        const orders = window.ordersData.orders;
        const order = orders.find(o => o.order_code === orderCode[0]);
        if (order) viewOrderDetail(order.id);
      }
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function exportWaybill(orderId) {
  try {
    const order = await apiCall(`/orders/${orderId}`);
    const customer = await apiCall(`/customers/${order.customer_id}`);
    const totalCosts = order.costs ? order.costs.reduce((sum, c) => sum + c.amount, 0) : 0;
    const profit = order.price - totalCosts;
    
    // Tính toán theo format mới với VAT
    const cuoc = order.price || 0;
    const neoXe = order.neo_xe || 0;
    const chiHo = order.chi_ho || 0;
    const grandTotal = cuoc + neoXe + chiHo;
    const vat = grandTotal * 0.1;  // VAT 10%
    const finalTotal = grandTotal + vat;
    
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Bảng kê - ${order.order_code}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { text-align: center; color: #2563eb; margin-bottom: 5px; font-size: 14px; }
    h2 { text-align: center; margin: 10px 0 5px 0; font-weight: bold; font-size: 14px; }
    .company-header { text-align: center; margin-bottom: 10px; }
    .company-header h3 { margin: 0; font-weight: bold; font-size: 16px; }
    .company-header p { margin: 3px 0; font-size: 11px; font-style: italic; }
    .header { text-align: center; margin-bottom: 15px; }
    .header p { margin: 3px 0; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10px; border: 1px solid #000; }
    th, td { border: 1px solid #000; padding: 4px; text-align: left; }
    th { font-weight: bold; text-align: center; vertical-align: middle; }
    .footer { margin-top: 15px; font-size: 11px; }
    .footer p { font-style: italic; margin-bottom: 10px; }
    .signature { display: flex; justify-content: space-between; margin-top: 20px; }
    .signature div { text-align: center; width: 45%; }
    .signature p { margin: 5px 0; font-size: 11px; }
    .signature strong { font-size: 12px; }
    @media print {
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="company-header">
    <h3>CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</h3>
    <p>B7/22B Khuất Văn Bức, Ấp 2, Xã Tân Nhựt, Thành Phố Hồ Chí Minh, Việt Nam.</p>
    <p>MST: 0317568930</p>
  </div>

  <div class="header">
    <h2>BẢNG KÊ ĐỐI SOÁT VÀ ĐỀ NGHỊ THANH TOÁN PHÍ VẬN CHUYỂN</h2>
    <p>Mã đơn: <strong>${order.order_code}</strong> - Ngày: ${formatDate(order.order_date)}</p>
    <p>Đơn vị thanh toán: <strong style="text-transform: uppercase;">${order.customer_name}</strong></p>
  </div>
  
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10px; border: 1px solid #000;">
    <thead>
      <tr>
        <th style="border: 1px solid #000; padding: 4px; width: 30px; text-align: center; vertical-align: middle;">STT</th>
        <th style="border: 1px solid #000; padding: 4px; width: 70px; text-align: center; vertical-align: middle;">Số<br/>Cont</th>
        <th style="border: 1px solid #000; padding: 4px; width: 65px; text-align: center; vertical-align: middle;">Số<br/>xe</th>
        <th style="border: 1px solid #000; padding: 4px; width: 65px; text-align: center; vertical-align: middle;">Ngày<br/>bốc</th>
        <th style="border: 1px solid #000; padding: 4px; width: 110px; text-align: center; vertical-align: middle;">Hàng hóa</th>
        <th style="border: 1px solid #000; padding: 4px; width: 120px; text-align: center; vertical-align: middle;">Nơi đóng hàng</th>
        <th style="border: 1px solid #000; padding: 4px; width: 85px; text-align: center; vertical-align: middle;">Điểm<br/>trung chuyển</th>
        <th style="border: 1px solid #000; padding: 4px; width: 120px; text-align: center; vertical-align: middle;">Nơi trả hàng</th>
        <th style="border: 1px solid #000; padding: 4px; width: 65px; text-align: center; vertical-align: middle;">Cước</th>
        <th style="border: 1px solid #000; padding: 4px; width: 55px; text-align: center; vertical-align: middle;">Néo<br/>xe</th>
        <th style="border: 1px solid #000; padding: 4px; width: 55px; text-align: center; vertical-align: middle;">Chi<br/>hộ</th>
        <th style="border: 1px solid #000; padding: 4px; width: 70px; text-align: center; vertical-align: middle;">Tổng<br/>Cộng</th>
        <th style="border: 1px solid #000; padding: 4px; width: 90px; text-align: center; vertical-align: middle;">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">1</td>
        <td style="border: 1px solid #000; padding: 5px;">${order.container_number || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${order.vehicle_plate || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: center;">${formatDate(order.pickup_date)}</td>
        <td style="border: 1px solid #000; padding: 5px;">${order.cargo_description || ''}</td>
        <td style="border: 1px solid #000; padding: 5px;">${order.pickup_location || ''}</td>
        <td style="border: 1px solid #000; padding: 5px;">${order.intermediate_point || ''}</td>
        <td style="border: 1px solid #000; padding: 5px;">${order.delivery_location || ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;">${cuoc > 0 ? formatMoney(cuoc) : ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;">${neoXe > 0 ? formatMoney(neoXe) : ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;">${chiHo > 0 ? formatMoney(chiHo) : ''}</td>
        <td style="border: 1px solid #000; padding: 5px; text-align: right;"><strong>${formatMoney(grandTotal)}</strong></td>
        <td style="border: 1px solid #000; padding: 5px;">${order.notes || ''}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr style="font-weight: bold;">
        <td colspan="8" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">TỔNG CƯỚC VẬN CHUYỂN</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(cuoc)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(neoXe)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(chiHo)}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(grandTotal)}</td>
        <td style="border: 1px solid #000; padding: 4px;"></td>
      </tr>
      <tr>
        <td colspan="11" style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">VAT 10%</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(vat)}</td>
        <td style="border: 1px solid #000; padding: 4px;"></td>
      </tr>
      <tr style="font-weight: bold;">
        <td colspan="11" style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">TỔNG CỘNG</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(finalTotal)}</td>
        <td style="border: 1px solid #000; padding: 4px;"></td>
      </tr>
    </tfoot>
  </table>
  
  <div class="footer">
    <p><strong>Bằng chữ:</strong> ${numberToWords(finalTotal)} đồng</p>
    <p>Yêu cầu Quý công ty thanh toán công nợ theo số tài khoản: <strong>0500780826263 - TRẦN NGỌC TIÊN - Ngân hàng: Sacombank</strong></p>
  </div>
  
  <div class="signature">
    <div>
      <p><strong>${(customer.name || customer.contact_person || '').toUpperCase()}</strong></p>
      <p style="margin: 50px 0 5px 0;"></p>
      <p><strong>${(customer.contact_person || '').toUpperCase()}</strong></p>
    </div>
    <div>
      <p><strong>CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</strong></p>
      <p style="margin: 50px 0 5px 0;"></p>
      <p><strong>TRẦN NGỌC TIÊN</strong></p>
    </div>
  </div>
  
  <button onclick="window.print()" style="position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">
    🖨️ In bảng kê
  </button>
  
  <script>window.print();</script>
</body>
</html>`;
    
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function filterOrders() {
  const customerId = document.getElementById('filterCustomer').value;
  const status = document.getElementById('filterStatus').value;
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  
  const rows = document.querySelectorAll('#ordersTable tbody tr');
  
  rows.forEach(row => {
    let show = true;
    
    // Filter by customer
    if (customerId) {
      const order = window.ordersData.orders.find(o => o.id === parseInt(row.dataset.orderId));
      if (order && order.customer_id !== parseInt(customerId)) show = false;
    }
    
    // Filter by status
    if (status) {
      const order = window.ordersData.orders.find(o => o.id === parseInt(row.dataset.orderId));
      if (order && order.status !== status) show = false;
    }
    
    // Filter by date range
    if (fromDate || toDate) {
      const order = window.ordersData.orders.find(o => o.id === parseInt(row.dataset.orderId));
      if (order) {
        if (fromDate && order.order_date < fromDate) show = false;
        if (toDate && order.order_date > toDate) show = false;
      }
    }
    
    row.style.display = show ? '' : 'none';
  });
}

// ==================== CUSTOMERS ====================
async function renderCustomers(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const customers = await apiCall('/customers');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>👥 Quản lý khách hàng</h1>
        ${['admin', 'sales'].includes(currentUser.role) ? `
        <button class="btn btn-primary" onclick="showCustomerModal()">
          ➕ Thêm khách hàng
        </button>
        ` : ''}
      </div>
      
      <div class="card">
        <div class="card-body">
          ${customers.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Tên công ty</th>
                    <th>Người liên hệ</th>
                    <th>Điện thoại</th>
                    <th>Email</th>
                    <th>Mã số thuế</th>
                    <th>Công nợ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${customers.map(c => `
                    <tr>
                      <td><strong>${c.name}</strong></td>
                      <td>${c.contact_person || '-'}</td>
                      <td>${c.phone || '-'}</td>
                      <td>${c.email || '-'}</td>
                      <td>${c.tax_code || '-'}</td>
                      <td class="text-right ${c.current_debt > 0 ? 'text-danger' : ''}">${formatMoney(c.current_debt || 0)}</td>
                      <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="showCustomerModal(${c.id})">Sửa</button>
                        ${currentUser.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteCustomer(${c.id})">Xóa</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">👥</div><p>Chưa có khách hàng nào</p></div>'}
        </div>
      </div>
    `;
    
    window.customersData = customers;
  } catch (error) {
    showError(container, 'Lỗi tải khách hàng: ' + error.message);
  }
}

function showCustomerModal(customerId = null) {
  // Initialize customersData if not exists
  if (!window.customersData) {
    window.customersData = [];
  }
  
  const customer = customerId ? window.customersData.find(c => c.id === customerId) : null;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${customer ? 'Sửa khách hàng' : 'Thêm khách hàng mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="customerForm" class="modal-body" onsubmit="saveCustomer(event, ${customerId})">
          <div class="form-group">
            <label>Tên công ty *</label>
            <input type="text" name="name" value="${customer ? customer.name : ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Loại khách hàng</label>
              <select name="customer_type">
                <option value="individual" ${customer && customer.customer_type === 'individual' ? 'selected' : ''}>Cá nhân</option>
                <option value="corporate" ${customer && customer.customer_type === 'corporate' ? 'selected' : ''}>Công ty</option>
              </select>
            </div>
            <div class="form-group">
              <label>Trạng thái</label>
              <select name="status">
                <option value="active" ${!customer || customer.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                <option value="inactive" ${customer && customer.status === 'inactive' ? 'selected' : ''}>Ngưng</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Người liên hệ</label>
              <input type="text" name="contact_person" value="${customer ? (customer.contact_person || '') : ''}">
            </div>
            <div class="form-group">
              <label>Điện thoại</label>
              <input type="text" name="phone" value="${customer ? (customer.phone || '') : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" value="${customer ? (customer.email || '') : ''}">
            </div>
            <div class="form-group">
              <label>Mã số thuế</label>
              <input type="text" name="tax_code" value="${customer ? (customer.tax_code || '') : ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Địa chỉ</label>
            <textarea name="address" rows="2">${customer ? (customer.address || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Hạn mức công nợ (VND)</label>
            <input type="number" name="credit_limit" step="1000000" value="${customer ? (customer.credit_limit || 0) : 0}">
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${customer ? (customer.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="customerForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function saveCustomer(event, customerId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);

  // Validate trước khi gửi
  if (!data.name || !data.name.trim()) {
    alert('Vui lòng nhập tên công ty');
    return;
  }

  try {
    if (customerId) {
      await apiCall(`/customers/${customerId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/customers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();

    // If another module (e.g. CRM) set a post-save hook, use it.
    const afterSave = window.onCustomerSaved;
    window.onCustomerSaved = null;
    if (typeof afterSave === 'function') {
      await afterSave();
    } else {
      loadPage('customers');
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteCustomer(customerId) {
  if (!confirm('Xác nhận xóa khách hàng này?')) return;
  
  try {
    await apiCall(`/customers/${customerId}`, { method: 'DELETE' });
    loadPage('customers');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== DRIVERS ====================
async function renderDrivers(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const drivers = await apiCall('/drivers');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>🚗 Quản lý tài xế</h1>
        ${['admin', 'dispatcher'].includes(currentUser.role) ? `
        <button class="btn btn-primary" onclick="showDriverModal()">
          ➕ Thêm tài xế
        </button>
        ` : ''}
      </div>
      
      <div class="card">
        <div class="card-body">
          ${drivers.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Điện thoại</th>
                    <th>Số GPLX</th>
                    <th>Hạn GPLX</th>
                    <th>CMND</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${drivers.map(d => `
                    <tr>
                      <td><strong>${d.name}</strong></td>
                      <td>${d.phone || '-'}</td>
                      <td>${d.license_number || '-'}</td>
                      <td>${d.license_expiry ? formatDate(d.license_expiry) : '-'}</td>
                      <td>${d.id_number || '-'}</td>
                      <td>${d.status === 'active' ? '<span class="badge badge-active">Đang làm</span>' : '<span class="badge badge-inactive">Nghỉ việc</span>'}</td>
                      <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="showDriverModal(${d.id})">Sửa</button>
                        ${currentUser.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteDriver(${d.id})">Xóa</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">🚗</div><p>Chưa có tài xế nào</p></div>'}
        </div>
      </div>
    `;
    
    window.driversData = drivers;
  } catch (error) {
    showError(container, 'Lỗi tải tài xế: ' + error.message);
  }
}

function showDriverModal(driverId = null) {
  const driver = driverId ? window.driversData.find(d => d.id === driverId) : null;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${driver ? 'Sửa tài xế' : 'Thêm tài xế mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="driverForm" class="modal-body" onsubmit="saveDriver(event, ${driverId})">
          <div class="form-group">
            <label>Họ tên *</label>
            <input type="text" name="name" value="${driver ? driver.name : ''}" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Điện thoại</label>
              <input type="text" name="phone" value="${driver ? (driver.phone || '') : ''}">
            </div>
            <div class="form-group">
              <label>CMND/CCCD</label>
              <input type="text" name="id_number" value="${driver ? (driver.id_number || '') : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Số GPLX</label>
              <input type="text" name="license_number" value="${driver ? (driver.license_number || '') : ''}">
            </div>
            <div class="form-group">
              <label>Loại GPLX</label>
              <select name="license_type">
                <option value="">-- Chọn loại --</option>
                <option value="B2" ${driver && driver.license_type === 'B2' ? 'selected' : ''}>B2</option>
                <option value="C" ${driver && driver.license_type === 'C' ? 'selected' : ''}>C</option>
                <option value="D" ${driver && driver.license_type === 'D' ? 'selected' : ''}>D</option>
                <option value="E" ${driver && driver.license_type === 'E' ? 'selected' : ''}>E</option>
                <option value="FC" ${driver && driver.license_type === 'FC' ? 'selected' : ''}>FC</option>
                <option value="FD" ${driver && driver.license_type === 'FD' ? 'selected' : ''}>FD</option>
              </select>
            </div>
            <div class="form-group">
              <label>Hạn GPLX</label>
              <input type="date" name="license_expiry" value="${driver ? (driver.license_expiry || '') : ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ngày sinh</label>
              <input type="date" name="birth_date" value="${driver ? (driver.birth_date || '') : ''}">
            </div>
            <div class="form-group">
              <label>Ngày vào làm</label>
              <input type="date" name="hire_date" value="${driver ? (driver.hire_date || '') : ''}">
            </div>
            <div class="form-group">
              <label>Lương cơ bản (VND)</label>
              <input type="number" name="base_salary" step="100000" value="${driver ? (driver.base_salary || 0) : 0}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ảnh CMND (base64)</label>
              <input type="file" id="idCardImageInput" accept="image/*" onchange="handleImageUpload('idCardImageInput', 'id_card_image')">
              <input type="hidden" name="id_card_image" value="${driver ? (driver.id_card_image || '') : ''}">
              ${driver && driver.id_card_image ? '<small style="color: green;">✓ Đã có ảnh</small>' : ''}
            </div>
            <div class="form-group">
              <label>Ảnh GPLX (base64)</label>
              <input type="file" id="licenseImageInput" accept="image/*" onchange="handleImageUpload('licenseImageInput', 'license_image')">
              <input type="hidden" name="license_image" value="${driver ? (driver.license_image || '') : ''}">
              ${driver && driver.license_image ? '<small style="color: green;">✓ Đã có ảnh</small>' : ''}
            </div>
          </div>
          <div class="form-group">
            <label>Địa chỉ</label>
            <textarea name="address" rows="2">${driver ? (driver.address || '') : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="status">
              <option value="active" ${driver && driver.status === 'active' ? 'selected' : ''}>Đang làm</option>
              <option value="inactive" ${driver && driver.status === 'inactive' ? 'selected' : ''}>Nghỉ việc</option>
            </select>
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${driver ? (driver.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="driverForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function saveDriver(event, driverId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  
  // Chuyển FormData sang object
  for (let [key, value] of formData.entries()) {
    data[key] = value || null;
  }
  
  try {
    console.log('📤 Saving driver:', data);
    
    if (driverId) {
      await apiCall(`/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/drivers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    loadPage('drivers');
  } catch (error) {
    console.error('❌ Save driver error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function deleteDriver(driverId) {
  if (!confirm('Xác nhận xóa tài xế này?')) return;
  
  try {
    await apiCall(`/drivers/${driverId}`, { method: 'DELETE' });
    loadPage('drivers');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== VEHICLES ====================
async function renderVehicles(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const vehicles = await apiCall('/vehicles');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>🚛 Quản lý xe đầu kéo</h1>
        ${['admin', 'dispatcher'].includes(currentUser.role) ? `
        <button class="btn btn-primary" onclick="showVehicleModal()">
          ➕ Thêm xe
        </button>
        ` : ''}
      </div>
      
      <div class="card">
        <div class="card-body">
          ${vehicles.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Biển số</th>
                    <th>Hãng/Model</th>
                    <th>Năm SX</th>
                    <th>Công suất</th>
                    <th>Mức TT không/có hàng</th>
                    <th>Trọng tải</th>
                    <th>Hạn đăng kiểm</th>
                    <th>Hạn bảo hiểm</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${vehicles.map(v => `
                    <tr>
                      <td><strong>${v.plate_number}</strong></td>
                      <td>${v.brand ? v.brand + (v.model ? ' ' + v.model : '') : (v.vehicle_type || '-')}</td>
                      <td>${v.year || '-'}</td>
                      <td>${v.engine_power ? v.engine_power + ' HP' : '-'}</td>
                      <td>${v.fuel_consumption_empty || v.fuel_consumption_loaded ? (v.fuel_consumption_empty || '-') + ' / ' + (v.fuel_consumption_loaded || '-') + ' L' : '-'}</td>
                      <td>${v.capacity ? v.capacity + ' tấn' : '-'}</td>
                      <td>${v.registration_expiry ? formatDate(v.registration_expiry) : '-'}</td>
                      <td>${v.insurance_expiry ? formatDate(v.insurance_expiry) : '-'}</td>
                      <td>${v.status === 'available' ? '<span class="badge badge-active">Sẵn sàng</span>' : '<span class="badge badge-pending">Đang chạy</span>'}</td>
                      <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="showVehicleModal(${v.id})">Sửa</button>
                        ${currentUser.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteVehicle(${v.id})">Xóa</button>` : ''}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">🚛</div><p>Chưa có xe nào</p></div>'}
        </div>
      </div>
    `;
    
    window.vehiclesData = vehicles;
  } catch (error) {
    showError(container, 'Lỗi tải xe: ' + error.message);
  }
}

function showVehicleModal(vehicleId = null) {
  const vehicle = vehicleId ? window.vehiclesData.find(v => v.id === vehicleId) : null;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${vehicle ? 'Sửa xe' : 'Thêm xe mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="vehicleForm" class="modal-body" onsubmit="saveVehicle(event, ${vehicleId})">
          <div class="form-row">
            <div class="form-group">
              <label>Biển số xe *</label>
              <input type="text" name="plate_number" value="${vehicle ? vehicle.plate_number : ''}" required>
            </div>
            <div class="form-group">
              <label>Loại xe</label>
              <input type="text" name="vehicle_type" value="${vehicle ? (vehicle.vehicle_type || '') : ''}" placeholder="Ví dụ: Đầu kéo">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Hãng xe</label>
              <select name="brand" onchange="updateVehicleModel(this.value)">
                <option value="">-- Chọn hãng --</option>
                <option value="FAW" ${vehicle && vehicle.brand === 'FAW' ? 'selected' : ''}>FAW</option>
                <option value="Hino" ${vehicle && vehicle.brand === 'Hino' ? 'selected' : ''}>Hino</option>
                <option value="Hyundai" ${vehicle && vehicle.brand === 'Hyundai' ? 'selected' : ''}>Hyundai</option>
                <option value="Dongfeng" ${vehicle && vehicle.brand === 'Dongfeng' ? 'selected' : ''}>Dongfeng</option>
                <option value="Isuzu" ${vehicle && vehicle.brand === 'Isuzu' ? 'selected' : ''}>Isuzu</option>
                <option value="Khác" ${vehicle && vehicle.brand === 'Khác' ? 'selected' : ''}>Khác</option>
              </select>
            </div>
            <div class="form-group">
              <label>Model</label>
              <input type="text" name="model" value="${vehicle ? (vehicle.model || '') : ''}" placeholder="VD: J6P, 700 Series">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Năm sản xuất</label>
              <input type="number" name="year" value="${vehicle ? (vehicle.year || '') : ''}" min="1990" max="2030" placeholder="VD: 2019">
            </div>
            <div class="form-group">
              <label>Công suất (HP)</label>
              <input type="number" name="engine_power" value="${vehicle ? (vehicle.engine_power || '') : ''}" placeholder="VD: 420">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Mức tiêu thụ đi không (lít/100km)</label>
              <input type="number" name="fuel_consumption_empty" step="0.1" value="${vehicle ? (vehicle.fuel_consumption_empty || '') : ''}" placeholder="VD: 25">
            </div>
            <div class="form-group">
              <label>Mức tiêu thụ có hàng (lít/100km)</label>
              <input type="number" name="fuel_consumption_loaded" step="0.1" value="${vehicle ? (vehicle.fuel_consumption_loaded || '') : ''}" placeholder="VD: 32">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Trọng tải (tấn)</label>
              <input type="number" name="capacity" step="0.1" value="${vehicle ? (vehicle.capacity || '') : ''}">
            </div>
            <div class="form-group">
              <label>Trạng thái</label>
              <select name="status">
                <option value="available" ${vehicle && vehicle.status === 'available' ? 'selected' : ''}>Sẵn sàng</option>
                <option value="in-use" ${vehicle && vehicle.status === 'in-use' ? 'selected' : ''}>Đang chạy</option>
                <option value="maintenance" ${vehicle && vehicle.status === 'maintenance' ? 'selected' : ''}>Bảo trì</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Hạn đăng kiểm</label>
              <input type="date" name="registration_expiry" value="${vehicle ? (vehicle.registration_expiry || '') : ''}">
            </div>
            <div class="form-group">
              <label>Hạn bảo hiểm</label>
              <input type="date" name="insurance_expiry" value="${vehicle ? (vehicle.insurance_expiry || '') : ''}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Số khung (VIN)</label>
              <input type="text" name="vin_number" value="${vehicle ? (vehicle.vin_number || '') : ''}" placeholder="17 ký tự">
            </div>
            <div class="form-group">
              <label>Số máy</label>
              <input type="text" name="engine_number" value="${vehicle ? (vehicle.engine_number || '') : ''}" placeholder="Số động cơ">
            </div>
            <div class="form-group">
              <label>Màu sắc</label>
              <input type="text" name="color" value="${vehicle ? (vehicle.color || '') : ''}" placeholder="VD: Trắng">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Chủ sở hữu</label>
              <select name="ownership">
                <option value="">-- Chọn loại --</option>
                <option value="Công ty" ${vehicle && vehicle.ownership === 'Công ty' ? 'selected' : ''}>Công ty</option>
                <option value="Cá nhân" ${vehicle && vehicle.ownership === 'Cá nhân' ? 'selected' : ''}>Cá nhân</option>
                <option value="Thuê" ${vehicle && vehicle.ownership === 'Thuê' ? 'selected' : ''}>Thuê</option>
              </select>
            </div>
            <div class="form-group">
              <label>Giá mua (VND)</label>
              <input type="number" name="purchase_price" step="1000000" value="${vehicle ? (vehicle.purchase_price || '') : ''}" placeholder="VD: 1200000000">
            </div>
            <div class="form-group">
              <label>Ngày mua</label>
              <input type="date" name="purchase_date" value="${vehicle ? (vehicle.purchase_date || '') : ''}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Km hiện tại (odometer)</label>
              <input type="number" name="current_odometer" value="${vehicle ? (vehicle.current_odometer || '') : ''}" placeholder="VD: 125000">
            </div>
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${vehicle ? (vehicle.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="vehicleForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

function updateVehicleModel(_brand) {
  // Intentionally minimal: keeps inline onchange handler from crashing.
  // Model is currently a free-text field.
}

async function saveVehicle(event, vehicleId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = {};
  
  // Chuyển FormData sang object và xử lý kiểu dữ liệu
  for (let [key, value] of formData.entries()) {
    // Nếu là số, chuyển sang số
    if (key.includes('power') || key.includes('capacity') || key.includes('fuel_consumption') || key.includes('year')) {
      data[key] = value ? parseFloat(value) : null;
    } else {
      data[key] = value || null;
    }
  }
  
  try {
    console.log('📤 Sending data:', data);
    
    if (vehicleId) {
      await apiCall(`/vehicles/${vehicleId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/vehicles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    loadPage('vehicles');
  } catch (error) {
    console.error('❌ Save error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function deleteVehicle(vehicleId) {
  if (!confirm('Xác nhận xóa xe này?')) return;
  
  try {
    await apiCall(`/vehicles/${vehicleId}`, { method: 'DELETE' });
    loadPage('vehicles');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== CONTAINERS ====================
async function renderContainers(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const containers = await apiCall('/containers');
    const containerReport = await apiCall('/reports/containers');
    
    // Merge data
    const containersWithStats = containers.map(c => {
      const stats = containerReport.find(r => r.id === c.id) || { total_trips: 0, total_revenue: 0, total_cost: 0 };
      return { ...c, ...stats };
    });
    
    container.innerHTML = `
      <div class="page-header">
        <h1>📦 Quản lý Container</h1>
        ${['admin', 'dispatcher'].includes(currentUser.role) ? `<button class="btn btn-primary" onclick="showContainerModal()">➕ Thêm container mới</button>` : ''}
      </div>
      
      <div class="card">
        <div class="card-body">
          <p class="text-muted"><strong>Lưu ý:</strong> Container là rơ-moóc/thùng hàng. Bạn có ${containers.length} container.</p>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Số container</th>
                  <th>Loại</th>
                  <th>Số chuyến</th>
                  <th>Tổng doanh thu</th>
                  <th>Vị trí hiện tại</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${containersWithStats.map(c => `
                  <tr>
                    <td><strong>${c.container_number}</strong></td>
                    <td>${c.container_type || '-'}</td>
                    <td class="text-center">${c.total_trips || 0}</td>
                    <td class="text-right">${formatMoney(c.total_revenue || 0)}</td>
                    <td>${c.current_location || '-'}</td>
                    <td>${c.status === 'available' ? '<span class="badge badge-active">Sẵn sàng</span>' : '<span class="badge badge-pending">Đang chạy</span>'}</td>
                    <td class="actions">
                      <button class="btn btn-sm btn-primary" onclick="showContainerModal(${c.id})">Sửa</button>
                      ${currentUser.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteContainer(${c.id}, '${c.container_number}')">Xóa</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    window.containersData = containers;
  } catch (error) {
    showError(container, 'Lỗi tải container: ' + error.message);
  }
}

function showContainerModal(containerId = null) {
  const container = containerId ? window.containersData.find(c => c.id === containerId) : null;
  const isEdit = !!container;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${isEdit ? 'Cập nhật Container: ' + container.container_number : 'Thêm Container mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="containerForm" class="modal-body" onsubmit="saveContainer(event, ${containerId})">
          ${!isEdit ? `
          <div class="form-group">
            <label>Số container *</label>
            <input type="text" name="container_number" required placeholder="Ví dụ: 50E12345">
          </div>
          <div class="form-group">
            <label>Loại container</label>
            <select name="container_type">
              <option value="20ft">20ft</option>
              <option value="40ft" selected>40ft</option>
              <option value="40HC">40ft HC (High Cube)</option>
              <option value="45ft">45ft</option>
            </select>
          </div>
          ` : ''}
          <div class="form-group">
            <label>Trạng thái</label>
            <select name="status">
              <option value="available" ${container && container.status === 'available' ? 'selected' : ''}>Sẵn sàng</option>
              <option value="in-use" ${container && container.status === 'in-use' ? 'selected' : ''}>Đang chạy</option>
              <option value="maintenance" ${container && container.status === 'maintenance' ? 'selected' : ''}>Bảo trì</option>
            </select>
          </div>
          <div class="form-group">
            <label>Vị trí hiện tại</label>
            <input type="text" name="current_location" value="${container ? (container.current_location || '') : ''}" placeholder="Ví dụ: TP.HCM">
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="3">${container ? (container.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="containerForm" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function saveContainer(event, containerId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);
  
  try {
    console.log('📤 Saving container:', data);
    if (containerId) {
      await apiCall(`/containers/${containerId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      alert('Cập nhật container thành công!');
    } else {
      await apiCall(`/containers`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      alert('Thêm container mới thành công!');
    }
    
    closeModal();
    loadPage('containers');
  } catch (error) {
    console.error('❌ Container save error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function deleteContainer(containerId, containerNumber) {
  if (!confirm(`Bạn chắc chắn muốn xóa container "${containerNumber}"?\n\nLưu ý: Chỉ xóa được container chưa có đơn hàng.`)) {
    return;
  }
  
  try {
    await apiCall(`/containers/${containerId}`, { method: 'DELETE' });
    alert('Xóa container thành công!');
    loadPage('containers');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== ROUTES ====================
async function renderRoutes(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const routes = await apiCall('/routes');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>🗺️ Quản lý tuyến đường</h1>
        <button class="btn btn-primary" onclick="showRouteModal()">
          ➕ Thêm tuyến
        </button>
      </div>
      
      <div class="card">
        <div class="card-body">
          ${routes.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Tên tuyến</th>
                    <th>Điểm đi</th>
                    <th>Điểm đến</th>
                    <th>Khoảng cách (km)</th>
                    <th>Thời gian (giờ)</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${routes.map(r => `
                    <tr>
                      <td><strong>${r.route_name}</strong></td>
                      <td>${r.origin}</td>
                      <td>${r.destination}</td>
                      <td class="text-center">${r.distance_km || '-'}</td>
                      <td class="text-center">${r.estimated_hours || '-'}</td>
                      <td class="actions">
                        <button class="btn btn-sm btn-primary" onclick="showRouteModal(${r.id})">Sửa</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteRoute(${r.id})">Xóa</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">🗺️</div><p>Chưa có tuyến nào</p></div>'}
        </div>
      </div>
    `;
    
    window.routesData = routes;
  } catch (error) {
    showError(container, 'Lỗi tải tuyến: ' + error.message);
  }
}

function showRouteModal(routeId = null) {
  const route = routeId ? window.routesData.find(r => r.id === routeId) : null;
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${route ? 'Sửa tuyến' : 'Thêm tuyến mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="routeForm" class="modal-body" onsubmit="saveRoute(event, ${routeId})">
          <div class="form-group">
            <label>Tên tuyến *</label>
            <input type="text" name="route_name" value="${route ? route.route_name : ''}" placeholder="Ví dụ: HCM - Bình Dương" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Điểm đi *</label>
              <input type="text" name="origin" value="${route ? route.origin : ''}" required>
            </div>
            <div class="form-group">
              <label>Điểm đến *</label>
              <input type="text" name="destination" value="${route ? route.destination : ''}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Khoảng cách (km)</label>
              <input type="number" name="distance_km" step="0.1" value="${route ? (route.distance_km || '') : ''}">
            </div>
            <div class="form-group">
              <label>Thời gian ước tính (giờ)</label>
              <input type="number" name="estimated_hours" step="0.5" value="${route ? (route.estimated_hours || '') : ''}">
            </div>
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${route ? (route.notes || '') : ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="routeForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function saveRoute(event, routeId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = formDataToObject(formData);
  
  try {
    console.log('📤 Saving route:', data);
    if (routeId) {
      await apiCall(`/routes/${routeId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/routes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    loadPage('routes');
  } catch (error) {
    console.error('❌ Route save error:', error);
    alert('Lỗi: ' + error.message);
  }
}

async function deleteRoute(routeId) {
  if (!confirm('Xác nhận xóa tuyến này?')) return;
  
  try {
    await apiCall(`/routes/${routeId}`, { method: 'DELETE' });
    loadPage('routes');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== REPORTS ====================
async function renderReports(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const [overview, customerReport, containerReport, orders, vehicles, drivers] = await Promise.all([
      apiCall('/reports/overview'),
      apiCall('/reports/customers'),
      apiCall('/reports/containers'),
      apiCall('/orders'),
      apiCall('/vehicles'),
      apiCall('/drivers')
    ]);
    
    // Phân tích doanh thu theo tháng (6 tháng gần nhất)
    const monthlyRevenue = {};
    const monthlyCosts = {};
    orders.forEach(o => {
      if (o.order_date) {
        const month = o.order_date.substring(0, 7); // YYYY-MM
        if (!monthlyRevenue[month]) {
          monthlyRevenue[month] = 0;
          monthlyCosts[month] = 0;
        }
        monthlyRevenue[month] += (o.final_amount || o.price || 0);
      }
    });
    
    // Lấy chi phí theo tháng
    try {
      const costs = await apiCall('/costs');
      costs.forEach(c => {
        if (c.cost_date) {
          const month = c.cost_date.substring(0, 7);
          if (!monthlyCosts[month]) monthlyCosts[month] = 0;
          monthlyCosts[month] += (c.total_amount || 0);
        }
      });
    } catch (e) {
      console.error('Error loading costs:', e);
    }
    
    const months = Object.keys(monthlyRevenue).sort().slice(-6);
    
    // Phân tích xe theo hiệu suất
    const vehiclePerformance = {};
    orders.forEach(o => {
      if (o.vehicle_id) {
        if (!vehiclePerformance[o.vehicle_id]) {
          vehiclePerformance[o.vehicle_id] = {
            plate: o.vehicle_plate,
            trips: 0,
            revenue: 0
          };
        }
        vehiclePerformance[o.vehicle_id].trips += 1;
        vehiclePerformance[o.vehicle_id].revenue += (o.final_amount || o.price || 0);
      }
    });
    const topVehicles = Object.values(vehiclePerformance)
      .filter(v => v.plate)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    // Phân tích tài xế
    const driverPerformance = {};
    orders.forEach(o => {
      if (o.driver_id) {
        if (!driverPerformance[o.driver_id]) {
          driverPerformance[o.driver_id] = {
            name: o.driver_name,
            trips: 0,
            revenue: 0
          };
        }
        driverPerformance[o.driver_id].trips += 1;
        driverPerformance[o.driver_id].revenue += (o.final_amount || o.price || 0);
      }
    });
    const topDrivers = Object.values(driverPerformance)
      .filter(d => d.name)
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 10);
    
    // Chi phí trung bình mỗi chuyến
    const totalTrips = orders.length;
    const avgCostPerTrip = totalTrips > 0 ? overview.totalCosts / totalTrips : 0;
    const avgRevenuePerTrip = totalTrips > 0 ? overview.totalRevenue / totalTrips : 0;
    
    container.innerHTML = `
      <div class="page-header">
        <h1>📈 Báo cáo & Thống kê Chi tiết</h1>
      </div>
      
      <div class="filters">
        <h4>🔍 Lọc theo thời gian</h4>
        <div class="form-row">
          <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="reportFromDate">
          </div>
          <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="reportToDate">
          </div>
          <button class="btn btn-primary" onclick="filterReports()">🔍 Lọc</button>
          <button class="btn btn-secondary" onclick="loadPage('reports')">🔄 Reset</button>
        </div>
      </div>
      
      <h3>💰 Tổng quan tài chính</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Tổng đơn hàng</div>
          <div class="stat-value">${overview.totalOrders}</div>
          <div class="stat-footer">TB: ${formatMoney(avgRevenuePerTrip)}/chuyến</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Tổng doanh thu</div>
          <div class="stat-value">${formatMoney(overview.totalRevenue)}</div>
          <div class="stat-footer">100% doanh thu</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Tổng chi phí</div>
          <div class="stat-value">${formatMoney(overview.totalCosts)}</div>
          <div class="stat-footer">
            ${overview.totalRevenue > 0 ? ((overview.totalCosts / overview.totalRevenue) * 100).toFixed(1) : 0}% doanh thu
          </div>
        </div>
        <div class="stat-card ${overview.profit >= 0 ? 'success' : 'danger'}">
          <div class="stat-label">Lợi nhuận ròng</div>
          <div class="stat-value">${formatMoney(overview.profit)}</div>
          <div class="stat-footer">
            Tỷ suất: ${overview.totalRevenue > 0 ? ((overview.profit / overview.totalRevenue) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>
      
      <div class="stats-grid" style="margin-top: 15px;">
        <div class="stat-card" style="background: #e3f2fd;">
          <div class="stat-label">TB Chi phí/Chuyến</div>
          <div class="stat-value" style="font-size: 20px;">${formatMoney(avgCostPerTrip)}</div>
        </div>
        <div class="stat-card" style="background: #f3e5f5;">
          <div class="stat-label">TB Doanh thu/Chuyến</div>
          <div class="stat-value" style="font-size: 20px;">${formatMoney(avgRevenuePerTrip)}</div>
        </div>
        <div class="stat-card" style="background: #fff3e0;">
          <div class="stat-label">TB Lợi nhuận/Chuyến</div>
          <div class="stat-value" style="font-size: 20px;">${formatMoney(avgRevenuePerTrip - avgCostPerTrip)}</div>
        </div>
        <div class="stat-card" style="background: #e8f5e9;">
          <div class="stat-label">Số xe hoạt động</div>
          <div class="stat-value" style="font-size: 20px;">${topVehicles.length}</div>
        </div>
      </div>
      
      <h3 style="margin-top: 30px;">📊 Doanh thu & Chi phí 6 tháng gần nhất</h3>
      <div class="card">
        <div class="card-body">
          ${months.length > 0 ? `
            <table style="width: 100%;">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th class="text-right">Doanh thu</th>
                  <th class="text-right">Chi phí</th>
                  <th class="text-right">Lợi nhuận</th>
                  <th class="text-right">Tỷ suất</th>
                </tr>
              </thead>
              <tbody>
                ${months.map(month => {
                  const revenue = monthlyRevenue[month] || 0;
                  const cost = monthlyCosts[month] || 0;
                  const profit = revenue - cost;
                  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td><strong>${month}</strong></td>
                      <td class="text-right" style="color: #4caf50; font-weight: bold;">
                        ${formatMoney(revenue)}
                      </td>
                      <td class="text-right" style="color: #ff9800;">
                        ${formatMoney(cost)}
                      </td>
                      <td class="text-right" style="color: ${profit >= 0 ? '#4caf50' : '#f44336'}; font-weight: bold;">
                        ${formatMoney(profit)}
                      </td>
                      <td class="text-right">
                        <span class="badge ${margin >= 20 ? 'badge-success' : margin >= 10 ? 'badge-warning' : 'badge-danger'}">
                          ${margin}%
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
                <tr style="background: #f5f5f5; font-weight: bold;">
                  <td>TỔNG</td>
                  <td class="text-right" style="color: #4caf50;">
                    ${formatMoney(months.reduce((sum, m) => sum + (monthlyRevenue[m] || 0), 0))}
                  </td>
                  <td class="text-right" style="color: #ff9800;">
                    ${formatMoney(months.reduce((sum, m) => sum + (monthlyCosts[m] || 0), 0))}
                  </td>
                  <td class="text-right" style="color: #4caf50;">
                    ${formatMoney(months.reduce((sum, m) => sum + ((monthlyRevenue[m] || 0) - (monthlyCosts[m] || 0)), 0))}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          ` : '<div class="empty-state"><p>Chưa có dữ liệu</p></div>'}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
        <div class="card">
          <div class="card-header">
            <h3>🚛 Top 10 xe theo doanh thu</h3>
          </div>
          <div class="card-body">
            ${topVehicles.length > 0 ? `
              <table style="width: 100%;">
                <thead>
                  <tr>
                    <th>Biển số</th>
                    <th class="text-center">Số chuyến</th>
                    <th class="text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  ${topVehicles.map((v, idx) => `
                    <tr>
                      <td><strong>${idx + 1}. ${v.plate}</strong></td>
                      <td class="text-center">${v.trips}</td>
                      <td class="text-right" style="color: #4caf50; font-weight: bold;">
                        ${formatMoney(v.revenue)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><p>Chưa có dữ liệu</p></div>'}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>👨‍✈️ Top 10 tài xế năng suất</h3>
          </div>
          <div class="card-body">
            ${topDrivers.length > 0 ? `
              <table style="width: 100%;">
                <thead>
                  <tr>
                    <th>Tài xế</th>
                    <th class="text-center">Số chuyến</th>
                    <th class="text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  ${topDrivers.map((d, idx) => `
                    <tr>
                      <td><strong>${idx + 1}. ${d.name}</strong></td>
                      <td class="text-center">${d.trips}</td>
                      <td class="text-right" style="color: #4caf50; font-weight: bold;">
                        ${formatMoney(d.revenue)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><p>Chưa có dữ liệu</p></div>'}
          </div>
        </div>
      </div>
      
      <div class="card mt-20">
        <div class="card-header">
          <h3>👥 Báo cáo chi tiết theo khách hàng</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Khách hàng</th>
                  <th class="text-center">Số đơn</th>
                  <th class="text-right">Doanh thu</th>
                  <th class="text-right">Đã thanh toán</th>
                  <th class="text-right">Công nợ</th>
                  <th class="text-right">% Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                ${customerReport.map((c, idx) => {
                  const paymentPercent = c.total_revenue > 0 ? ((c.total_paid / c.total_revenue) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${c.name}</strong></td>
                      <td class="text-center">${c.total_orders || 0}</td>
                      <td class="text-right" style="font-weight: bold; color: #4caf50;">
                        ${formatMoney(c.total_revenue || 0)}
                      </td>
                      <td class="text-right">${formatMoney(c.total_paid || 0)}</td>
                      <td class="text-right ${c.current_debt > 0 ? 'text-danger' : 'text-success'}" style="font-weight: bold;">
                        ${formatMoney(c.current_debt || 0)}
                      </td>
                      <td class="text-right">
                        <span class="badge ${paymentPercent >= 80 ? 'badge-success' : paymentPercent >= 50 ? 'badge-warning' : 'badge-danger'}">
                          ${paymentPercent}%
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="card mt-20">
        <div class="card-header">
          <h3>📦 Báo cáo theo Container</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Container</th>
                  <th class="text-center">Số chuyến</th>
                  <th class="text-right">Doanh thu</th>
                  <th class="text-right">Chi phí</th>
                  <th class="text-right">Lợi nhuận</th>
                  <th class="text-right">Tỷ suất</th>
                </tr>
              </thead>
              <tbody>
                ${containerReport.map((c, idx) => {
                  const profit = (c.total_revenue || 0) - (c.total_cost || 0);
                  const margin = c.total_revenue > 0 ? ((profit / c.total_revenue) * 100).toFixed(1) : 0;
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><strong>${c.container_number}</strong></td>
                      <td class="text-center">${c.total_trips || 0}</td>
                      <td class="text-right" style="color: #4caf50; font-weight: bold;">
                        ${formatMoney(c.total_revenue || 0)}
                      </td>
                      <td class="text-right" style="color: #ff9800;">
                        ${formatMoney(c.total_cost || 0)}
                      </td>
                      <td class="text-right ${profit >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: bold;">
                        ${formatMoney(profit)}
                      </td>
                      <td class="text-right">
                        <span class="badge ${margin >= 20 ? 'badge-success' : margin >= 10 ? 'badge-warning' : 'badge-danger'}">
                          ${margin}%
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="card mt-20">
        <div class="card-header">
          <h3>� Hướng dẫn sử dụng báo cáo</h3>
        </div>
        <div class="card-body">
          <ul style="list-style: none; padding: 0;">
            <li>✅ <strong>Tỷ suất lợi nhuận tốt:</strong> Từ 20% trở lên (màu xanh)</li>
            <li>⚠️ <strong>Tỷ suất khá:</strong> Từ 10-20% (màu vàng)</li>
            <li>❌ <strong>Tỷ suất thấp:</strong> Dưới 10% (màu đỏ)</li>
            <li>💡 <strong>Công nợ an toàn:</strong> Tỷ lệ thanh toán trên 80%</li>
            <li>📊 <strong>Chi phí hợp lý:</strong> Không quá 60% doanh thu</li>
          </ul>
        </div>
      </div>
    `;
    
    // Load additional reports asynchronously
    loadCostsByTypeReport();
    
  } catch (error) {
    showError(container, 'Lỗi tải báo cáo: ' + error.message);
  }
}

async function loadCostsByTypeReport() {
  try {
    const costs = await apiCall('/costs');
    const costsByType = {};
    
    costs.forEach(c => {
      const type = c.cost_type || 'Khác';
      if (!costsByType[type]) {
        costsByType[type] = {
          count: 0,
          total: 0
        };
      }
      costsByType[type].count += 1;
      costsByType[type].total += (c.total_amount || 0);
    });
    
    const costTypes = Object.entries(costsByType)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.total - a.total);
    
    const totalCosts = costTypes.reduce((sum, c) => sum + c.total, 0);
    
    const container = document.getElementById('costsByTypeReport');
    if (container) {
      container.innerHTML = costTypes.length > 0 ? `
        <table style="width: 100%;">
          <thead>
            <tr>
              <th>Loại chi phí</th>
              <th class="text-center">Số lần</th>
              <th class="text-right">Tổng tiền</th>
              <th class="text-right">% Tổng CP</th>
            </tr>
          </thead>
          <tbody>
            ${costTypes.map(c => {
              const percent = totalCosts > 0 ? ((c.total / totalCosts) * 100).toFixed(1) : 0;
              return `
                <tr>
                  <td><strong>${c.type}</strong></td>
                  <td class="text-center">${c.count}</td>
                  <td class="text-right" style="color: #ff9800; font-weight: bold;">
                    ${formatMoney(c.total)}
                  </td>
                  <td class="text-right">
                    <span class="badge ${percent > 30 ? 'badge-danger' : percent > 15 ? 'badge-warning' : 'badge-secondary'}">
                      ${percent}%
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #f5f5f5; font-weight: bold;">
              <td>TỔNG</td>
              <td class="text-center">${costTypes.reduce((sum, c) => sum + c.count, 0)}</td>
              <td class="text-right" style="color: #ff9800;">
                ${formatMoney(totalCosts)}
              </td>
              <td class="text-right">100%</td>
            </tr>
          </tbody>
        </table>
      ` : '<div class="empty-state"><p>Chưa có dữ liệu chi phí</p></div>';
    }
  } catch (e) {
    console.error('Error loading costs by type:', e);
    const container = document.getElementById('costsByTypeReport');
    if (container) {
      container.innerHTML = '<div class="empty-state"><p>Không thể tải dữ liệu</p></div>';
    }
  }
}

window.filterReports = async function() {
  const fromDate = document.getElementById('reportFromDate').value;
  const toDate = document.getElementById('reportToDate').value;
  
  const params = new URLSearchParams();
  if (fromDate) params.append('from', fromDate);
  if (toDate) params.append('to', toDate);
  
  try {
    const overview = await apiCall(`/reports/overview?${params.toString()}`);
    const customerReport = await apiCall(`/reports/customers?${params.toString()}`);
    const containerReport = await apiCall(`/reports/containers?${params.toString()}`);
    
    // Reload the reports page with filtered data
    loadPage('reports');
  } catch (error) {
    alert('Lỗi lọc báo cáo: ' + error.message);
  }
};

// ==================== UTILITY FUNCTIONS ====================
function formatMoney(amount) {
  if (!amount && amount !== 0) return '0';
  return new Intl.NumberFormat('vi-VN').format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN');
}

function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return '';
  }
}

function getStatusBadge(status) {
  const badges = {
    'pending': '<span class="badge badge-pending">Chờ xử lý</span>',
    'in-transit': '<span class="badge badge-in-transit">Đang vận chuyển</span>',
    'completed': '<span class="badge badge-completed">Hoàn thành</span>'
  };
  return badges[status] || status;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="alert alert-danger">
      <strong>Lỗi:</strong> ${message}
    </div>
  `;
}

function numberToWords(num) {
  if (num === 0) return 'Không';
  
  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
  
  function readThreeDigits(n) {
    if (n === 0) return '';
    
    let result = '';
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const one = n % 10;
    
    // Hàng trăm
    if (hundred > 0) {
      result += ones[hundred] + ' trăm';
      if (ten === 0 && one > 0) result += ' lẻ';
    }
    
    // Hàng chục
    if (ten > 1) {
      result += ' ' + tens[ten];
      if (one === 1) {
        result += ' mốt';
      } else if (one === 5 && ten >= 1) {
        result += ' lăm';
      } else if (one > 0) {
        result += ' ' + ones[one];
      }
    } else if (ten === 1) {
      result += ' mười';
      if (one === 5) {
        result += ' lăm';
      } else if (one > 0) {
        result += ' ' + ones[one];
      }
    } else if (ten === 0 && one > 0 && hundred > 0) {
      result += ' ' + ones[one];
    } else if (ten === 0 && one > 0 && hundred === 0) {
      result += ones[one];
    }
    
    return result.trim();
  }
  
  let result = '';
  
  // Hàng tỷ
  const billion = Math.floor(num / 1000000000);
  if (billion > 0) {
    result += readThreeDigits(billion) + ' tỷ';
    num = num % 1000000000;
  }
  
  // Hàng triệu
  const million = Math.floor(num / 1000000);
  if (million > 0) {
    result += ' ' + readThreeDigits(million) + ' triệu';
    num = num % 1000000;
  } else if (billion > 0 && num > 0) {
    result += ' không triệu';
  }
  
  // Hàng nghìn
  const thousand = Math.floor(num / 1000);
  if (thousand > 0) {
    result += ' ' + readThreeDigits(thousand) + ' nghìn';
    num = num % 1000;
  } else if ((billion > 0 || million > 0) && num > 0) {
    result += ' không nghìn';
  }
  
  // Hàng đơn vị (trăm, chục, đơn vị)
  if (num > 0) {
    result += ' ' + readThreeDigits(num);
  }
  
  // Chuẩn hóa kết quả
  result = result.trim();
  result = result.replace(/\s+/g, ' '); // Xóa khoảng trắng thừa
  
  // Viết hoa chữ cái đầu
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ==================== ACCOUNTING & TAX REPORTS ====================
async function renderAccounting(container) {
  try {
    container.innerHTML = `
      <div class="page-header">
        <h1>💰 Kế toán & Báo cáo thuế</h1>
      </div>
      
      <div class="tabs">
        <button class="tab-btn active" onclick="switchAccountingTab('statement')">Bảng kê khách hàng</button>
        <button class="tab-btn" onclick="switchAccountingTab('tax')">Báo cáo thuế</button>
        <button class="tab-btn" onclick="switchAccountingTab('revenue')">Doanh thu - Chi phí</button>
      </div>
      
      <div id="accountingContent"></div>
    `;
    
    switchAccountingTab('statement');
  } catch (error) {
    container.innerHTML = `<p>Lỗi: ${error.message}</p>`;
  }
}

async function switchAccountingTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const content = document.getElementById('accountingContent');
  
  switch(tab) {
    case 'statement':
      await renderCustomerStatement(content);
      break;
    case 'tax':
      await renderTaxReport(content);
      break;
    case 'revenue':
      await renderRevenueReport(content);
      break;
  }
}

// Bảng kê khách hàng
async function renderCustomerStatement(container) {
  try {
    const customers = await apiCall('/customers');
    
    container.innerHTML = `
      <div class="filter-section">
        <div class="form-row">
          <div class="form-group">
            <label>Chọn khách hàng</label>
            <select id="statementCustomer">
              <option value="">-- Chọn khách hàng --</option>
              ${customers.map(c => `<option value="${c.id}">${c.name || c.contact_person || 'Không rõ tên'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="statementFromDate" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="statementToDate" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" onclick="generateStatement()">Tạo bảng kê</button>
          </div>
        </div>
      </div>
      
      <div id="statementResult"></div>
    `;
  } catch (error) {
    container.innerHTML = `<p>Lỗi: ${error.message}</p>`;
  }
}

async function generateStatement() {
  const customerId = document.getElementById('statementCustomer').value;
  const fromDate = document.getElementById('statementFromDate').value;
  const toDate = document.getElementById('statementToDate').value;
  
  if (!customerId) {
    alert('Vui lòng chọn khách hàng');
    return;
  }
  
  try {
    const orders = await apiCall(`/orders?customer_id=${customerId}&from=${fromDate}&to=${toDate}`);
    const customer = await apiCall(`/customers/${customerId}`);
    
    // Tính toán tổng hợp theo format mới
    let totalCuoc = 0;      // Tổng cước vận chuyển
    let totalNeoXe = 0;     // Tổng néo xe
    let totalChiHo = 0;     // Tổng chi hộ
    let grandTotal = 0;     // Tổng cộng
    
    orders.forEach(order => {
      const cuoc = order.price || 0;
      const neoXe = order.neo_xe || 0;
      const chiHo = order.chi_ho || 0;
      totalCuoc += cuoc;
      totalNeoXe += neoXe;
      totalChiHo += chiHo;
      grandTotal += (cuoc + neoXe + chiHo);
    });
    
    const vat = grandTotal * 0.1;  // VAT 10%
    const finalTotal = grandTotal + vat;
    
    const resultDiv = document.getElementById('statementResult');
    resultDiv.innerHTML = `
      <div class="statement-container">
        <div class="statement-actions">
          <button class="btn btn-primary" onclick="exportStatement(${customerId}, '${fromDate}', '${toDate}')">
            📄 Xuất PDF
          </button>
          <button class="btn btn-success" onclick="exportStatementExcel('${customer.name}', '${fromDate}', '${toDate}')">
            📊 Xuất Excel
          </button>
          <button class="btn btn-info" onclick="exportStatementCSV('${customer.name}', '${fromDate}', '${toDate}')">
            📋 Xuất CSV
          </button>
          <button class="btn btn-secondary" onclick="printStatement()">
            🖨️ In bảng kê
          </button>
        </div>
        
        <div id="statementPrint" class="statement-content">
          <div class="statement-header">
            <h3 style="margin: 0; font-weight: bold; font-size: 16px;">CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</h3>
            <p style="margin: 3px 0; font-size: 11px; font-style: italic;">B7/22B Khuất Văn Bức, Ấp 2, Xã Tân Nhựt, Thành Phố Hồ Chí Minh, Việt Nam.</p>
            <p style="margin: 3px 0 8px 0; font-size: 11px; font-style: italic;">MST: 0317568930</p>
            <h2 style="margin: 10px 0 5px 0; font-weight: bold; font-size: 14px;">BẢNG KÊ ĐỐI SOÁT VÀ ĐỀ NGHỊ THANH TOÁN PHÍ VẬN CHUYỂN</h2>
            <p style="margin: 3px 0; font-size: 11px;">Từ ngày ${formatDate(fromDate)} đến ngày ${formatDate(toDate)}</p>
            <p style="margin: 3px 0; font-size: 11px;">Đính kèm hóa đơn số: ...... ngày ...... tháng ...... năm ${new Date(toDate).getFullYear()}</p>
            <p style="margin: 3px 0 2px 0; font-size: 11px;">Đơn vị thanh toán: <span style="text-transform: uppercase; font-weight: bold;">${customer.name || customer.contact_person}</span></p>
          </div>
          
          <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #000; margin-top: 5px;">
            <thead>
              <tr>
                <th style="border: 1px solid #000; padding: 4px; width: 30px; font-weight: bold; text-align: center; vertical-align: middle;">STT</th>
                <th style="border: 1px solid #000; padding: 4px; width: 70px; font-weight: bold; text-align: center; vertical-align: middle;">Số<br/>Cont</th>
                <th style="border: 1px solid #000; padding: 4px; width: 65px; font-weight: bold; text-align: center; vertical-align: middle;">Số<br/>xe</th>
                <th style="border: 1px solid #000; padding: 4px; width: 65px; font-weight: bold; text-align: center; vertical-align: middle;">Ngày<br/>bốc</th>
                <th style="border: 1px solid #000; padding: 4px; width: 110px; font-weight: bold; text-align: center; vertical-align: middle;">Hàng hóa</th>
                <th style="border: 1px solid #000; padding: 4px; width: 120px; font-weight: bold; text-align: center; vertical-align: middle;">Nơi đóng hàng</th>
                <th style="border: 1px solid #000; padding: 4px; width: 85px; font-weight: bold; text-align: center; vertical-align: middle;">Điểm<br/>trung chuyển</th>
                <th style="border: 1px solid #000; padding: 4px; width: 120px; font-weight: bold; text-align: center; vertical-align: middle;">Nơi trả hàng</th>
                <th style="border: 1px solid #000; padding: 4px; width: 65px; font-weight: bold; text-align: center; vertical-align: middle;">Cước</th>
                <th style="border: 1px solid #000; padding: 4px; width: 55px; font-weight: bold; text-align: center; vertical-align: middle;">Néo<br/>xe</th>
                <th style="border: 1px solid #000; padding: 4px; width: 55px; font-weight: bold; text-align: center; vertical-align: middle;">Chi<br/>hộ</th>
                <th style="border: 1px solid #000; padding: 4px; width: 70px; font-weight: bold; text-align: center; vertical-align: middle;">Tổng<br/>Cộng</th>
                <th style="border: 1px solid #000; padding: 4px; width: 90px; font-weight: bold; text-align: center; vertical-align: middle;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map((order, idx) => {
                const cuoc = order.price || 0;
                const neoXe = order.neo_xe || 0;
                const chiHo = order.chi_ho || 0;
                const tongCong = cuoc + neoXe + chiHo;
                return `
                  <tr>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.container_number || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${order.vehicle_plate || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: center;">${formatDate(order.pickup_date)}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.cargo_description || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.pickup_location || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.intermediate_point || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.delivery_location || ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: right;">${cuoc > 0 ? formatMoney(cuoc) : ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: right;">${neoXe > 0 ? formatMoney(neoXe) : ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: right;">${chiHo > 0 ? formatMoney(chiHo) : ''}</td>
                    <td style="border: 1px solid #000; padding: 5px; text-align: right;"><strong>${formatMoney(tongCong)}</strong></td>
                    <td style="border: 1px solid #000; padding: 5px;">${order.notes || ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold;">
                <td colspan="8" style="border: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">TỔNG CƯỚC VẬN CHUYỂN</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(totalCuoc)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(totalNeoXe)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(totalChiHo)}</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(grandTotal)}</td>
                <td style="border: 1px solid #000; padding: 4px;"></td>
              </tr>
              <tr>
                <td colspan="11" style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">VAT 10%</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(vat)}</td>
                <td style="border: 1px solid #000; padding: 4px;"></td>
              </tr>
              <tr style="font-weight: bold;">
                <td colspan="11" style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">TỔNG CỘNG</td>
                <td style="border: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${formatMoney(finalTotal)}</td>
                <td style="border: 1px solid #000; padding: 4px;"></td>
              </tr>
            </tfoot>
          </table>
          
          <div class="statement-footer" style="margin-top: 15px;">
            <p style="font-size: 11px; margin-bottom: 5px;"><strong>Bằng chữ:</strong> ${numberToWords(finalTotal)} đồng</p>
            <p style="font-style: italic; font-size: 11px; margin-bottom: 10px;">Yêu cầu Quý công ty thanh toán công nợ theo số tài khoản: 0500780826263 - TRẦN NGỌC TIÊN - Ngân hàng: Sacombank</p>
            
            <div class="signature-section" style="display: flex; justify-content: space-between; margin-top: 20px;">
              <div class="signature" style="text-align: center; width: 45%;">
                <p style="margin-bottom: 5px;"><strong>${(customer.name || '').toUpperCase()}</strong></p>
                <p style="margin: 50px 0 5px 0; font-style: italic; font-size: 10px;"></p>
                <p style="margin-top: 7px;"><strong>${(customer.contact_person || '').toUpperCase()}</strong></p>
              </div>
              <div class="signature" style="text-align: center; width: 45%;">
                <p style="margin-bottom: 5px;"><strong>CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</strong></p>
                <p style="margin: 50px 0 5px 0; font-style: italic; font-size: 10px;"></p>
                <p style="margin-top: 5px;"><strong>TRẦN NGỌC TIÊN</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function printStatement() {
  const content = document.getElementById('statementPrint').innerHTML;
  const win = window.open('', '', 'width=1200,height=800');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title></title>
      <link rel="stylesheet" href="css/style.css">
      <style>
        @media print {
          body { 
            margin: 0; 
            padding: 15px; 
          }
          .statement-actions { 
            display: none !important; 
          }
          @page {
            size: A4 landscape;
            margin: 10mm 15mm;
          }
        }
        @media screen {
          body {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      ${content}
      <script>
        window.onload = function() {
          // Thông báo cách tắt header/footer trình duyệt
          alert('LƯU Ý KHI IN:\\n\\n1. Trong hộp thoại in, tìm "More settings" (Thêm cài đặt)\\n2. Bỏ chọn "Headers and footers" để ẩn thông tin về:blank và ngày giờ\\n3. Đảm bảo chọn "Landscape" (In ngang)');
          
          setTimeout(function() {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

function exportStatement(customerId, fromDate, toDate) {
  printStatement();
}

// Báo cáo thuế
async function renderTaxReport(container) {
  try {
    container.innerHTML = `
      <div class="filter-section">
        <div class="form-row">
          <div class="form-group">
            <label>Tháng</label>
            <select id="taxMonth">
              ${Array.from({length: 12}, (_, i) => `<option value="${i+1}">Tháng ${i+1}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Năm</label>
            <select id="taxYear">
              ${Array.from({length: 5}, (_, i) => {
                const year = new Date().getFullYear() - i;
                return `<option value="${year}">${year}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <button class="btn btn-primary" onclick="generateTaxReport()">Tạo báo cáo</button>
          </div>
        </div>
      </div>
      
      <div id="taxReportResult"></div>
    `;
    
    const now = new Date();
    document.getElementById('taxMonth').value = now.getMonth() + 1;
    document.getElementById('taxYear').value = now.getFullYear();
  } catch (error) {
    container.innerHTML = `<p>Lỗi: ${error.message}</p>`;
  }
}

async function generateTaxReport() {
  const month = document.getElementById('taxMonth').value;
  const year = document.getElementById('taxYear').value;
  
  try {
    const fromDate = `${year}-${month.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    
    const orders = await apiCall(`/orders?from=${fromDate}&to=${toDate}&status=completed`);
    
    const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
    const vatRate = 0.1;
    const vatAmount = totalRevenue * vatRate;
    const totalRevenueWithVat = totalRevenue + vatAmount;
    
    const customerTax = await renderTaxByCustomer(orders);
    
    const resultDiv = document.getElementById('taxReportResult');
    resultDiv.innerHTML = `
      <div class="tax-report-container">
        <div class="statement-actions">
          <button class="btn btn-primary" onclick="printTaxReport()">📄 Xuất PDF</button>
          <button class="btn btn-success" onclick="exportTaxReportExcel(${month}, ${year})">📊 Xuất Excel</button>
          <button class="btn btn-info" onclick="exportTaxReportCSV(${month}, ${year})">📋 Xuất CSV</button>
          <button class="btn btn-secondary" onclick="printTaxReport()">🖨️ In báo cáo</button>
        </div>
        
        <div id="taxReportPrint" class="tax-report-content">
          <div class="statement-header">
            <h3 style="margin: 0; font-weight: bold;">CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</h3>
            <h2 style="margin: 15px 0; font-weight: bold;">BÁO CÁO THUẾ GTGT</h2>
            <p style="margin: 5px 0;">Tháng ${month}/${year}</p>
          </div>
          
          <div class="tax-summary">
            <h3>1. Doanh thu bán hàng và cung cấp dịch vụ</h3>
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">STT</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Chỉ tiêu</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Giá trị (VND)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 2px solid #000; padding: 8px; text-align: center;">1</td>
                  <td style="border: 2px solid #000; padding: 8px;">Doanh thu chưa có thuế GTGT</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(totalRevenue)}</td>
                </tr>
                <tr>
                  <td style="border: 2px solid #000; padding: 8px; text-align: center;">2</td>
                  <td style="border: 2px solid #000; padding: 8px;">Thuế GTGT đầu ra (10%)</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(vatAmount)}</td>
                </tr>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                  <td style="border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold;">3</td>
                  <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">Tổng doanh thu (bao gồm VAT)</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatMoney(totalRevenueWithVat)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="tax-summary">
            <h3>2. Chi tiết theo khách hàng</h3>
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">STT</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Khách hàng</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Mã số thuế</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Số đơn</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Doanh thu</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">VAT (10%)</th>
                </tr>
              </thead>
              <tbody>
                ${customerTax}
              </tbody>
            </table>
          </div>
          
          <div class="tax-summary">
            <h3>3. Tổng hợp thuế phải nộp</h3>
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Chỉ tiêu</th>
                  <th style="border: 2px solid #000; padding: 8px; font-weight: bold;">Giá trị (VND)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 2px solid #000; padding: 8px;">Thuế GTGT đầu ra</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(vatAmount)}</td>
                </tr>
                <tr>
                  <td style="border: 2px solid #000; padding: 8px;">Thuế GTGT đầu vào (ước tính 50%)</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(vatAmount * 0.5)}</td>
                </tr>
                <tr style="background-color: #f0f0f0; font-weight: bold;">
                  <td style="border: 2px solid #000; padding: 8px; font-weight: bold;">Thuế GTGT phải nộp</td>
                  <td style="border: 2px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatMoney(vatAmount * 0.5)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="statement-footer">
            <p>Ngày lập: ${formatDate(new Date().toISOString().split('T')[0])}</p>
            <div class="signature-section">
              <div class="signature">
                <p><strong>Người lập biểu</strong></p>
                <p>(Ký, ghi rõ họ tên)</p>
              </div>
              <div class="signature">
                <p><strong>Kế toán trưởng</strong></p>
                <p>(Ký, ghi rõ họ tên)</p>
              </div>
              <div class="signature">
                <p><strong>Giám đốc</strong></p>
                <p>(Ký, đóng dấu)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function renderTaxByCustomer(orders) {
  const customerMap = {};
  
  for (const order of orders) {
    if (!customerMap[order.customer_id]) {
      customerMap[order.customer_id] = {
        name: order.customer_name,
        tax_code: order.customer_tax_code || 'N/A',
        orders: [],
        total: 0
      };
    }
    customerMap[order.customer_id].orders.push(order);
    customerMap[order.customer_id].total += (order.price || 0);
  }
  
  const customers = Object.values(customerMap);
  const vatRate = 0.1;
  
  return customers.map((c, idx) => {
    const vat = c.total * vatRate;
    return `
      <tr>
        <td style="border: 2px solid #000; padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="border: 2px solid #000; padding: 8px;">${c.name}</td>
        <td style="border: 2px solid #000; padding: 8px; text-align: center;">${c.tax_code}</td>
        <td style="border: 2px solid #000; padding: 8px; text-align: center;">${c.orders.length}</td>
        <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(c.total)}</td>
        <td style="border: 2px solid #000; padding: 8px; text-align: right;">${formatMoney(vat)}</td>
      </tr>
    `;
  }).join('');
}

function printTaxReport() {
  const content = document.getElementById('taxReportPrint').innerHTML;
  const win = window.open('', '', 'width=800,height=600');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Báo cáo thuế</title>
      <link rel="stylesheet" href="css/style.css">
      <style>
        @media print {
          body { margin: 0; padding: 20px; }
          .statement-actions { display: none !important; }
        }
      </style>
    </head>
    <body>
      ${content}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

// Báo cáo doanh thu - chi phí
async function renderRevenueReport(container) {
  try {
    container.innerHTML = `
      <div class="filter-section">
        <div class="form-row">
          <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="revenueFromDate" value="${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="revenueToDate" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <button class="btn btn-primary" onclick="generateRevenueReport()">Tạo báo cáo</button>
          </div>
        </div>
      </div>
      
      <div id="revenueReportResult"></div>
    `;
  } catch (error) {
    container.innerHTML = `<p>Lỗi: ${error.message}</p>`;
  }
}

async function generateRevenueReport() {
  const fromDate = document.getElementById('revenueFromDate').value;
  const toDate = document.getElementById('revenueToDate').value;
  
  try {
    const orders = await apiCall(`/orders?from=${fromDate}&to=${toDate}&status=completed`);
    
    const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
    let totalCost = 0;
    
    for (const order of orders) {
      const costs = await apiCall(`/orders/${order.id}/costs`);
      totalCost += costs.reduce((sum, c) => sum + (c.amount || 0), 0);
    }
    
    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue * 100).toFixed(2) : 0;
    
    const resultDiv = document.getElementById('revenueReportResult');
    resultDiv.innerHTML = `
      <div class="revenue-report">
        <div class="stats-grid">
          <div class="stat-card success">
            <div class="stat-label">Tổng doanh thu</div>
            <div class="stat-value">${formatMoney(totalRevenue)}</div>
          </div>
          <div class="stat-card danger">
            <div class="stat-label">Tổng chi phí</div>
            <div class="stat-value">${formatMoney(totalCost)}</div>
          </div>
          <div class="stat-card ${profit >= 0 ? 'primary' : 'danger'}">
            <div class="stat-label">Lợi nhuận</div>
            <div class="stat-value">${formatMoney(profit)}</div>
          </div>
          <div class="stat-card info">
            <div class="stat-label">Tỷ suất lợi nhuận</div>
            <div class="stat-value">${profitMargin}%</div>
          </div>
        </div>
        
        <div class="chart-section">
          <h3>Chi tiết theo đơn hàng</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã đơn</th>
                <th>Ngày</th>
                <th>Khách hàng</th>
                <th>Doanh thu</th>
                <th>Chi phí</th>
                <th>Lợi nhuận</th>
                <th>Tỷ suất</th>
              </tr>
            </thead>
            <tbody id="revenueTableBody">
              <tr><td colspan="8">Đang tải...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    const tbody = document.getElementById('revenueTableBody');
    const rows = [];
    
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const costs = await apiCall(`/orders/${order.id}/costs`);
      const orderCost = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const orderProfit = (order.price || 0) - orderCost;
      const orderMargin = order.price > 0 ? (orderProfit / order.price * 100).toFixed(2) : 0;
      
      rows.push(`
        <tr>
          <td>${i + 1}</td>
          <td>${order.order_code}</td>
          <td>${formatDate(order.pickup_date)}</td>
          <td>${order.customer_name}</td>
          <td class="text-right">${formatMoney(order.price)}</td>
          <td class="text-right">${formatMoney(orderCost)}</td>
          <td class="text-right ${orderProfit >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(orderProfit)}</td>
          <td class="text-right">${orderMargin}%</td>
        </tr>
      `);
    }
    
    tbody.innerHTML = rows.join('');
    
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== UPLOAD POD FUNCTIONS ====================
function showUploadPODModal(orderId) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>📤 Upload chứng từ POD</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="uploadPODForm" class="modal-body" onsubmit="uploadPOD(event, ${orderId})">
          <div class="form-group">
            <label>Loại tài liệu *</label>
            <select name="document_type" required>
              <option value="POD">POD (Proof of Delivery)</option>
              <option value="Invoice">Hóa đơn</option>
              <option value="Photo">Ảnh hàng hóa</option>
              <option value="Other">Khác</option>
            </select>
          </div>
          <div class="form-group">
            <label>Chọn file (Ảnh hoặc PDF) *</label>
            <input type="file" id="podFile" accept="image/*,application/pdf" required onchange="previewPOD(this)">
            <p class="text-muted" style="font-size: 12px; margin-top: 5px;">
              Hỗ trợ: JPG, PNG, PDF. Tối đa 5MB
            </p>
          </div>
          <div id="previewContainer" style="margin-top: 10px;"></div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="uploadPODForm" class="btn btn-primary">Upload</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

function previewPOD(input) {
  const preview = document.getElementById('previewContainer');
  const file = input.files[0];
  
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      alert('File quá lớn! Vui lòng chọn file dưới 5MB');
      input.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      if (file.type.startsWith('image/')) {
        preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border: 1px solid #ddd; border-radius: 4px;">`;
      } else {
        preview.innerHTML = `<p>📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)</p>`;
      }
    };
    reader.readAsDataURL(file);
  }
}

async function uploadPOD(event, orderId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const fileInput = document.getElementById('podFile');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Vui lòng chọn file');
    return;
  }
  
  try {
    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async function(e) {
      const base64Data = e.target.result;
      
      const data = {
        document_type: formData.get('document_type'),
        file_name: file.name,
        file_data: base64Data
      };
      
      await apiCall(`/orders/${orderId}/documents`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      alert('✓ Upload thành công!');
      const modalContainer = document.getElementById('modalContainer');
      if (modalContainer) modalContainer.innerHTML = '';
      viewOrderDetail(orderId);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function viewDocument(docId) {
  try {
    const doc = await apiCall(`/documents/${docId}/download`);
    
    // Open in new window
    const win = window.open('', '_blank');
    if (doc.file_name.toLowerCase().endsWith('.pdf')) {
      win.document.write(`
        <html>
        <head><title>${doc.file_name}</title></head>
        <body style="margin:0">
          <embed src="${doc.file_data}" type="application/pdf" width="100%" height="100%" />
        </body>
        </html>
      `);
    } else {
      win.document.write(`
        <html>
        <head><title>${doc.file_name}</title></head>
        <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#000;">
          <img src="${doc.file_data}" style="max-width:100%; max-height:100vh;" />
        </body>
        </html>
      `);
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteDocument(docId) {
  if (!confirm('Xác nhận xóa tài liệu này?')) return;
  
  try {
    await apiCall(`/documents/${docId}`, { method: 'DELETE' });
    
    // Reload current order detail
    const modal = document.querySelector('.modal');
    if (modal) {
      const orderCode = modal.querySelector('h2').textContent.match(/ORD\d+/);
      if (orderCode) {
        const orders = window.ordersData.orders;
        const order = orders.find(o => o.order_code === orderCode[0]);
        if (order) viewOrderDetail(order.id);
      }
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== EXPORT EXCEL & CSV FUNCTIONS ====================

// Xuất bảng kê sang Excel
async function exportStatementExcel(customerName, fromDate, toDate) {
  const customerId = document.getElementById('statementCustomer').value;
  const orders = await apiCall(`/orders?customer_id=${customerId}&from=${fromDate}&to=${toDate}`);
  const customer = await apiCall(`/customers/${customerId}`);
  
  // Tạo HTML table để export sang Excel
  let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="UTF-8">
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Bảng Kê</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
    </head>
    <body>
      <table border="1">
        <tr><td colspan="12" style="font-weight: bold; text-align: center; font-size: 14pt;">CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</td></tr>
        <tr><td colspan="12" style="text-align: center; font-size: 11pt;">B7/22B Khuất Văn Bức, Ấp 2, Xã Tân Nhựt, Thành Phố Hồ Chí Minh, Việt Nam.</td></tr>
        <tr><td colspan="12" style="text-align: center; font-size: 11pt;">MST: 0317568930</td></tr>
        <tr><td colspan="12" style="font-weight: bold; text-align: center; font-size: 12pt;">BẢNG KÊ ĐỐI SOÁT VÀ ĐỀ NGHỊ THANH TOÁN PHÍ VẬN CHUYỂN</td></tr>
        <tr><td colspan="12" style="text-align: center;">Từ ngày ${formatDate(fromDate)} đến ngày ${formatDate(toDate)}</td></tr>
        <tr><td colspan="12" style="text-align: center;">Đính kèm hóa đơn số: ...... ngày ...... tháng ...... năm ${new Date(toDate).getFullYear()}</td></tr>
        <tr><td colspan="12" style="text-align: center;">Đơn vị thanh toán: <strong>${customer.name || customer.contact_person}</strong></td></tr>
        <tr><td colspan="12"></td></tr>
        <tr style="font-weight: bold;">
          <td>STT</td><td>Số Cont</td><td>Ngày bốc</td><td>Hàng hóa</td><td>Nơi đóng hàng</td><td>Điểm trung chuyển</td><td>Nơi trả hàng</td><td>Cước</td><td>Néo xe</td><td>Chi hộ</td><td>Tổng Cộng</td><td>Ghi chú</td>
        </tr>
  `;
  
  let totalCuoc = 0, totalNeoXe = 0, totalChiHo = 0, grandTotal = 0;
  
  orders.forEach((order, idx) => {
    const cuoc = order.price || 0;
    const neoXe = order.neo_xe || 0;
    const chiHo = order.chi_ho || 0;
    const tongCong = cuoc + neoXe + chiHo;
    
    totalCuoc += cuoc;
    totalNeoXe += neoXe;
    totalChiHo += chiHo;
    grandTotal += tongCong;
    
    htmlContent += `<tr>
      <td>${idx + 1}</td>
      <td>${order.container_number || ''}</td>
      <td>${formatDate(order.pickup_date)}</td>
      <td>${order.cargo_description || ''}</td>
      <td>${order.pickup_location || ''}</td>
      <td>${order.intermediate_point || ''}</td>
      <td>${order.delivery_location || ''}</td>
      <td style="text-align: right;">${cuoc.toLocaleString()}</td>
      <td style="text-align: right;">${neoXe.toLocaleString()}</td>
      <td style="text-align: right;">${chiHo.toLocaleString()}</td>
      <td style="text-align: right; font-weight: bold;">${tongCong.toLocaleString()}</td>
      <td>${order.notes || ''}</td>
    </tr>`;
  });
  
  const vat = grandTotal * 0.1;
  const finalTotal = grandTotal + vat;
  
  htmlContent += `
        <tr style="font-weight: bold;">
          <td colspan="7" style="text-align: center; font-weight: bold;">TỔNG CƯỚC VẬN CHUYỂN</td>
          <td style="text-align: right; font-weight: bold;">${totalCuoc.toLocaleString()}</td>
          <td style="text-align: right; font-weight: bold;">${totalNeoXe.toLocaleString()}</td>
          <td style="text-align: right; font-weight: bold;">${totalChiHo.toLocaleString()}</td>
          <td style="text-align: right; font-weight: bold;">${grandTotal.toLocaleString()}</td>
          <td></td>
        </tr>
        <tr style="font-weight: bold;">
          <td colspan="10" style="text-align: right; font-weight: bold;">VAT 10%</td>
          <td style="text-align: right; font-weight: bold;">${vat.toLocaleString()}</td>
          <td></td>
        </tr>
        <tr style="font-weight: bold;">
          <td colspan="10" style="text-align: right; font-weight: bold;">TỔNG CỘNG</td>
          <td style="text-align: right; font-weight: bold;">${finalTotal.toLocaleString()}</td>
          <td></td>
        </tr>
        <tr><td colspan="12"></td></tr>
        <tr><td colspan="12" style="font-style: italic; font-size: 10pt;">Yêu cầu Quý công ty thanh toán công nợ theo số tài khoản: 0500780826263 - TRẦN NGỌC TIÊN - Ngân hàng: Sacombank</td></tr>
        <tr><td colspan="12"></td></tr>
        <tr>
          <td colspan="6" style="text-align: center; font-weight: bold;">${(customer.name || '').toUpperCase()}</td>
          <td colspan="6" style="text-align: center; font-weight: bold;">CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT</td>
        </tr>
        <tr><td colspan="6" style="height: 60px;"></td><td colspan="6" style="height: 60px;"></td></tr>
        <tr>
          <td colspan="6" style="text-align: center; font-weight: bold;">${(customer.contact_person || '').toUpperCase()}</td>
          <td colspan="6" style="text-align: center; font-weight: bold;">TRẦN NGỌC TIÊN</td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  // Download as Excel
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `BangKe_${customerName}_${fromDate}_${toDate}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Xuất bảng kê sang CSV
function exportStatementCSV(customerName, fromDate, toDate) {
  exportStatementExcel(customerName, fromDate, toDate);
}

// Xuất báo cáo thuế sang Excel
async function exportTaxReportExcel(month, year) {
  const fromDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
  
  const orders = await apiCall(`/orders?from=${fromDate}&to=${toDate}&status=completed`);
  
  const totalRevenue = orders.reduce((sum, o) => sum + (o.price || 0), 0);
  const vatAmount = totalRevenue * 0.1;
  const totalRevenueWithVat = totalRevenue + vatAmount;
  
  // Tạo dữ liệu CSV
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  
  csvContent += `CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT\n`;
  csvContent += `B7/22B Khuất Văn Bức, Ấp 2, Xã Tân Nhựt, TP.HCM\n`;
  csvContent += `MST: 0317568930\n`;
  csvContent += `BÁO CÁO THUẾ GTGT - Tháng ${month}/${year}\n\n`;
  
  csvContent += `1. DOANH THU BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ\n`;
  csvContent += `STT,Chỉ tiêu,Giá trị (VND)\n`;
  csvContent += `1,Doanh thu chưa có thuế GTGT,${totalRevenue}\n`;
  csvContent += `2,Thuế GTGT đầu ra (10%),${vatAmount}\n`;
  csvContent += `3,Tổng doanh thu (bao gồm VAT),${totalRevenueWithVat}\n\n`;
  
  csvContent += `2. CHI TIẾT THEO KHÁCH HÀNG\n`;
  csvContent += `STT,Khách hàng,Mã số thuế,Số đơn,Doanh thu,VAT (10%)\n`;
  
  const customerMap = {};
  for (const order of orders) {
    if (!customerMap[order.customer_id]) {
      customerMap[order.customer_id] = {
        name: order.customer_name,
        tax_code: order.customer_tax_code || 'N/A',
        count: 0,
        total: 0
      };
    }
    customerMap[order.customer_id].count++;
    customerMap[order.customer_id].total += (order.price || 0);
  }
  
  const customers = Object.values(customerMap);
  customers.forEach((c, idx) => {
    const vat = c.total * 0.1;
    csvContent += `${idx + 1},"${c.name}",${c.tax_code},${c.count},${c.total},${vat}\n`;
  });
  
  csvContent += `\n3. TỔNG HỢP THUẾ PHẢI NỘP\n`;
  csvContent += `Chỉ tiêu,Giá trị (VND)\n`;
  csvContent += `Thuế GTGT đầu ra,${vatAmount}\n`;
  csvContent += `Thuế GTGT đầu vào (ước tính 50%),${vatAmount * 0.5}\n`;
  csvContent += `Thuế GTGT phải nộp,${vatAmount * 0.5}\n`;
  
  // Download
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `BaoCaoThue_${month}_${year}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Xuất báo cáo thuế sang CSV
function exportTaxReportCSV(month, year) {
  exportTaxReportExcel(month, year);
}

// ==================== USER MANAGEMENT ====================
async function renderUsers(container) {
  try {
    const users = await apiCall('/users');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>👤 Quản lý User</h1>
        <button class="btn btn-primary" onclick="showUserModal()">➕ Thêm user</button>
      </div>
      
      <div class="card">
        <div class="card-body">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Họ tên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(user => `
                  <tr>
                    <td>${user.id}</td>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.fullname}</td>
                    <td>
                      <span class="badge badge-${getRoleBadgeClass(user.role)}">
                        ${getRoleText(user.role)}
                      </span>
                    </td>
                    <td>
                      <span class="badge badge-${user.status === 'active' ? 'success' : 'danger'}">
                        ${user.status === 'active' ? 'Hoạt động' : 'Vô hiệu hóa'}
                      </span>
                    </td>
                    <td>${formatDate(user.created_at)}</td>
                    <td>
                      <button class="btn btn-sm btn-primary" onclick="showUserModal(${user.id})">Sửa</button>
                      <button class="btn btn-sm btn-warning" onclick="showChangePasswordModal(${user.id})">Đổi MK</button>
                      <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">Xóa</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    if (error.message.includes('403')) {
      container.innerHTML = `
        <div class="page-header">
          <h1>👤 Quản lý User</h1>
        </div>
        <div class="alert alert-danger">
          <p>⛔ Bạn không có quyền truy cập chức năng này.</p>
          <p>Chỉ tài khoản Admin mới có thể quản lý user.</p>
        </div>
      `;
    } else {
      showError(container, 'Lỗi tải danh sách user: ' + error.message);
    }
  }
}

function getRoleText(role) {
  const roles = {
    admin: 'Quản trị viên',
    accountant: 'Kế toán',
    dispatcher: 'Điều độ',
    staff: 'Nhân viên'
  };
  return roles[role] || role;
}

function getRoleBadgeClass(role) {
  const classes = {
    admin: 'danger',
    accountant: 'info',
    dispatcher: 'warning',
    staff: 'secondary'
  };
  return classes[role] || 'secondary';
}

function showUserModal(userId = null) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${userId ? 'Sửa thông tin user' : 'Thêm user mới'}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="userForm" class="modal-body" onsubmit="saveUser(event, ${userId})">
          ${!userId ? `
            <div class="form-group">
              <label>Username *</label>
              <input type="text" name="username" required minlength="3">
            </div>
            <div class="form-group">
              <label>Mật khẩu *</label>
              <input type="password" name="password" required minlength="6">
            </div>
          ` : ''}
          <div class="form-group">
            <label>Họ tên *</label>
            <input type="text" name="fullname" id="userFullname" required>
          </div>
          <div class="form-group">
            <label>Vai trò *</label>
            <select name="role" id="userRole" required>
              <option value="staff">Nhân viên</option>
              <option value="dispatcher">Điều độ</option>
              <option value="accountant">Kế toán</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
          ${userId ? `
            <div class="form-group">
              <label>Trạng thái</label>
              <select name="status" id="userStatus">
                <option value="active">Hoạt động</option>
                <option value="inactive">Vô hiệu hóa</option>
              </select>
            </div>
          ` : ''}
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="userForm" class="btn btn-primary">Lưu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
  
  if (userId) {
    loadUserData(userId);
  }
}

async function loadUserData(userId) {
  try {
    const users = await apiCall('/users');
    const user = users.find(u => u.id === userId);
    
    if (user) {
      document.getElementById('userFullname').value = user.fullname;
      document.getElementById('userRole').value = user.role;
      if (document.getElementById('userStatus')) {
        document.getElementById('userStatus').value = user.status;
      }
    }
  } catch (error) {
    alert('Lỗi tải thông tin user: ' + error.message);
  }
}

async function saveUser(event, userId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData);
  
  try {
    if (userId) {
      await apiCall(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
    
    closeModal();
    navigateTo('users');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function showChangePasswordModal(userId) {
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Đổi mật khẩu</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="changePasswordForm" class="modal-body" onsubmit="changePassword(event, ${userId})">
          <div class="form-group">
            <label>Mật khẩu mới *</label>
            <input type="password" name="newPassword" required minlength="6">
          </div>
          <div class="form-group">
            <label>Xác nhận mật khẩu mới *</label>
            <input type="password" name="confirmPassword" required minlength="6">
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="changePasswordForm" class="btn btn-primary">Đổi mật khẩu</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('modalContainer').innerHTML = modal;
}

async function changePassword(event, userId) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const newPassword = formData.get('newPassword');
  const confirmPassword = formData.get('confirmPassword');
  
  if (newPassword !== confirmPassword) {
    alert('Mật khẩu xác nhận không khớp!');
    return;
  }
  
  try {
    await apiCall(`/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword })
    });
    
    alert('Đổi mật khẩu thành công!');
    closeModal();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteUser(userId) {
  if (!confirm('Xác nhận xóa user này?')) return;
  
  try {
    await apiCall(`/users/${userId}`, { method: 'DELETE' });
    navigateTo('users');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

// ==================== AUDIT LOGS ====================
async function renderAuditLogs(container) {
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Đang tải...</p></div>';
  
  try {
    const logs = await apiCall('/audit-logs');
    const users = await apiCall('/users');
    
    container.innerHTML = `
      <div class="page-header">
        <h1>📋 Nhật ký hoạt động</h1>
      </div>
      
      <div class="filters">
        <div class="form-row">
          <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="auditFromDate">
          </div>
          <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="auditToDate">
          </div>
          <div class="form-group">
            <label>Người dùng</label>
            <select id="auditUser">
              <option value="">Tất cả</option>
              ${users.map(u => `<option value="${u.id}">${u.fullname} (${u.username})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Hành động</label>
            <select id="auditAction">
              <option value="">Tất cả</option>
              <option value="login_success">Đăng nhập thành công</option>
              <option value="login_failed">Đăng nhập thất bại</option>
              <option value="create">Tạo mới</option>
              <option value="update">Cập nhật</option>
              <option value="delete">Xóa</option>
              <option value="security_alert">Cảnh báo bảo mật</option>
            </select>
          </div>
          <div class="form-group">
            <label>Đối tượng</label>
            <select id="auditEntity">
              <option value="">Tất cả</option>
              <option value="auth">Xác thực</option>
              <option value="orders">Đơn hàng</option>
              <option value="customers">Khách hàng</option>
              <option value="payments">Thanh toán</option>
              <option value="users">User</option>
            </select>
          </div>
          <div class="form-group">
            <button class="btn btn-primary" onclick="filterAuditLogs()">🔍 Lọc</button>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-body">
          ${logs.length > 0 ? `
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>ID</th>
                    <th>IP</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(log => {
                    const actionBadge = getActionBadge(log.action);
                    const details = log.action === 'security_alert' ? 
                      (log.new_value ? JSON.parse(log.new_value).message : 'Cảnh báo') : 
                      `${log.entity} #${log.entity_id || 'N/A'}`;
                    
                    return `
                      <tr class="${log.action === 'security_alert' ? 'bg-warning' : log.action === 'delete' ? 'bg-danger-light' : ''}">
                        <td>${formatDateTime(log.created_at)}</td>
                        <td>${log.fullname || log.username || 'System'}</td>
                        <td>${getRoleBadge(log.role)}</td>
                        <td>${actionBadge}</td>
                        <td><strong>${log.entity}</strong></td>
                        <td>${log.entity_id || '-'}</td>
                        <td><small>${log.ip_address || '-'}</small></td>
                        <td>
                          <button class="btn btn-sm btn-info" onclick="window.showAuditDetail(${log.id}, ${JSON.stringify(log.old_value || '').replace(/"/g, '&quot;')}, ${JSON.stringify(log.new_value || '').replace(/"/g, '&quot;')})">
                            👁️ Xem
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">📋</div><p>Chưa có nhật ký nào</p></div>'}
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
  }
}

function getActionBadge(action) {
  const badges = {
    'login_success': '<span class="badge badge-success">Đăng nhập</span>',
    'login_failed': '<span class="badge badge-danger">Login thất bại</span>',
    'create': '<span class="badge badge-success">Tạo mới</span>',
    'update': '<span class="badge badge-info">Cập nhật</span>',
    'delete': '<span class="badge badge-danger">Xóa</span>',
    'security_alert': '<span class="badge badge-danger">🚨 Cảnh báo</span>'
  };
  return badges[action] || `<span class="badge badge-secondary">${action}</span>`;
}

function getRoleBadge(role) {
  const badges = {
    'admin': '<span class="badge badge-danger">Admin</span>',
    'accountant': '<span class="badge badge-success">Kế toán</span>',
    'dispatcher': '<span class="badge badge-info">Điều độ</span>',
    'staff': '<span class="badge badge-secondary">Nhân viên</span>'
  };
  return badges[role] || `<span class="badge badge-secondary">${role || 'Unknown'}</span>`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('vi-VN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

window.filterAuditLogs = async function() {
  const fromDate = document.getElementById('auditFromDate').value;
  const toDate = document.getElementById('auditToDate').value;
  const userId = document.getElementById('auditUser').value;
  const action = document.getElementById('auditAction').value;
  const entity = document.getElementById('auditEntity').value;
  
  const params = new URLSearchParams();
  if (fromDate) params.append('from_date', fromDate);
  if (toDate) params.append('to_date', toDate);
  if (userId) params.append('user_id', userId);
  if (action) params.append('action', action);
  if (entity) params.append('entity', entity);
  
  try {
    const logs = await apiCall(`/audit-logs?${params.toString()}`);
    
    // Re-render the table body with filtered data
    const tbody = document.querySelector('.audit-logs-table tbody');
    if (tbody) {
      tbody.innerHTML = logs.map(log => {
        const isAlert = log.action === 'security_alert';
        const isDelete = log.action === 'delete';
        const rowClass = isAlert ? 'bg-warning' : (isDelete ? 'bg-danger-light' : '');
        
        return `
          <tr class="${rowClass}">
            <td>${formatDateTime(log.created_at)}</td>
            <td>${log.fullname || log.username}</td>
            <td>${getRoleBadge(log.role)}</td>
            <td>${getActionBadge(log.action)}</td>
            <td><span class="badge badge-secondary">${log.entity.toUpperCase()}</span></td>
            <td>${log.entity_id || 'N/A'}</td>
            <td>${log.ip_address || 'N/A'}</td>
            <td>
              <button class="btn btn-sm btn-info" onclick="window.showAuditDetail(${log.id}, ${JSON.stringify(log.old_value || '').replace(/"/g, '&quot;')}, ${JSON.stringify(log.new_value || '').replace(/"/g, '&quot;')})">👁️ Xem</button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.showAuditDetail = function(logId, oldValue, newValue) {
  let oldData = 'N/A';
  let newData = 'N/A';
  
  try {
    if (oldValue && oldValue !== 'null' && typeof oldValue === 'string') {
      oldData = JSON.stringify(JSON.parse(oldValue), null, 2);
    } else if (typeof oldValue === 'object') {
      oldData = JSON.stringify(oldValue, null, 2);
    }
  } catch (e) {
    oldData = oldValue || 'N/A';
  }
  
  try {
    if (newValue && newValue !== 'null' && typeof newValue === 'string') {
      newData = JSON.stringify(JSON.parse(newValue), null, 2);
    } else if (typeof newValue === 'object') {
      newData = JSON.stringify(newValue, null, 2);
    }
  } catch (e) {
    newData = newValue || 'N/A';
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>Chi tiết nhật ký #${logId}</h2>
        <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h4>Giá trị cũ:</h4>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; max-height: 400px;">${oldData}</pre>
          </div>
          <div>
            <h4>Giá trị mới:</h4>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; max-height: 400px;">${newData}</pre>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Đóng</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ==================== EXPORT TO WINDOW SCOPE ====================
// Export các functions để có thể gọi từ onclick="..." trong HTML
window.logout = logout;
window.loadPage = loadPage;
window.closeModal = closeModal;
window.setupNavigation = setupNavigation;

// Utility functions
window.handleImageUpload = handleImageUpload;

// Order functions
window.showOrderModal = showOrderModal;
window.saveOrder = saveOrder;
window.viewOrderDetail = viewOrderDetail;
window.deleteOrder = deleteOrder;
window.showCostModal = showCostModal;
window.saveCost = saveCost;
window.deleteCost = deleteCost;
window.showPaymentModal = showPaymentModal;
window.savePayment = savePayment;
window.deletePayment = deletePayment;
window.showAdvanceModal = showAdvanceModal;
window.saveAdvance = saveAdvance;
window.settleAdvance = settleAdvance;
window.deleteAdvance = deleteAdvance;
window.exportWaybill = exportWaybill;
window.filterOrders = filterOrders;
window.quickUpdateOrder = quickUpdateOrder;
window.toggleFuelFields = toggleFuelFields;
window.calculateFuelAmount = calculateFuelAmount;
window.previewInvoice = previewInvoice;

// Customer functions
window.showCustomerModal = showCustomerModal;
window.saveCustomer = saveCustomer;
window.deleteCustomer = deleteCustomer;

// Driver functions
window.showDriverModal = showDriverModal;
window.saveDriver = saveDriver;
window.deleteDriver = deleteDriver;

// Vehicle functions
window.showVehicleModal = showVehicleModal;
window.saveVehicle = saveVehicle;
window.deleteVehicle = deleteVehicle;

// Container functions
window.showContainerModal = showContainerModal;
window.saveContainer = saveContainer;
window.deleteContainer = deleteContainer;

// Route functions
window.showRouteModal = showRouteModal;
window.saveRoute = saveRoute;
window.deleteRoute = deleteRoute;

// User functions (if defined)
if (typeof showUserModal !== 'undefined') window.showUserModal = showUserModal;
if (typeof saveUser !== 'undefined') window.saveUser = saveUser;
if (typeof deleteUser !== 'undefined') window.deleteUser = deleteUser;

// Utility functions
window.closeModal = closeModal;
window.formatMoney = formatMoney;
window.formatDate = formatDate;
window.formatDateForInput = formatDateForInput;

console.log('✅ App.js loaded - All functions exported to window scope');

