// NOTE: This file was kept for backward compatibility but is deprecated.
// Core utilities (apiCall, UI helpers) are defined in `public/js/app.js`.
// To avoid duplicate definitions, this file intentionally exports nothing
// and only logs a deprecation warning when loaded.

console.warn('public/app-main.js is deprecated. Utilities are provided by public/js/app.js');

async function saveCustomer(event) {
  event.preventDefault();

  const id = document.getElementById('customerId').value;
  const data = {
    name: document.getElementById('customerName').value,
    phone: document.getElementById('customerPhone').value,
    email: document.getElementById('customerEmail').value,
    address: document.getElementById('customerAddress').value,
    tax_code: document.getElementById('customerTaxCode').value,
    notes: document.getElementById('customerNotes').value,
  };

  try {
    if (id) {
      await apiCall(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } else {
      await apiCall('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    closeModal('customerModal');
    loadCustomers();
    alert('Đã lưu khách hàng');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function editCustomer(id) {
  try {
    const customer = await apiCall(`/customers/${id}`);
    
    document.getElementById('customerId').value = customer.id;
    document.getElementById('customerName').value = customer.name;
    document.getElementById('customerPhone').value = customer.phone || '';
    document.getElementById('customerEmail').value = customer.email || '';
    document.getElementById('customerAddress').value = customer.address || '';
    document.getElementById('customerTaxCode').value = customer.tax_code || '';
    document.getElementById('customerNotes').value = customer.notes || '';

    document.getElementById('customerModalTitle').textContent = 'Sửa khách hàng';
    openModal('customerModal');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteCustomer(id) {
  if (!confirm('Bạn có chắc muốn xóa khách hàng này?')) return;

  try {
    await apiCall(`/customers/${id}`, { method: 'DELETE' });
    loadCustomers();
    alert('Đã xóa khách hàng');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;

// ============ DRIVERS ============

async function loadDrivers() {
  try {
    const drivers = await apiCall('/drivers');
    const tbody = document.getElementById('driversTable');
    tbody.innerHTML = '';

    // Update shipment form dropdown
    const shipmentDriverSelect = document.getElementById('shipmentDriver');
    shipmentDriverSelect.innerHTML = '<option value="">-- Chưa phân công --</option>';

    drivers.forEach(driver => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${driver.name}</td>
        <td>${driver.phone || ''}</td>
        <td>${driver.license_number || ''}</td>
        <td>${driver.id_number || ''}</td>
        <td><span class="status-badge status-${driver.status}">${driver.status === 'active' ? 'Đang hoạt động' : 'Tạm nghỉ'}</span></td>
        <td>
          <button class="btn-info" onclick="editDriver(${driver.id})">Sửa</button>
          <button class="btn-danger" onclick="deleteDriver(${driver.id})">Xóa</button>
        </td>
      `;
      tbody.appendChild(tr);

      // Add to shipment form
      if (driver.status === 'active') {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = driver.name;
        shipmentDriverSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error('Load drivers error:', error);
  }
}

async function saveDriver(event) {
  event.preventDefault();

  const id = document.getElementById('driverId').value;
  const data = {
    name: document.getElementById('driverName').value,
    phone: document.getElementById('driverPhone').value,
    license_number: document.getElementById('driverLicense').value,
    id_number: document.getElementById('driverIdNumber').value,
    address: document.getElementById('driverAddress').value,
    status: document.getElementById('driverStatus').value,
    notes: document.getElementById('driverNotes').value,
  };

  try {
    if (id) {
      await apiCall(`/drivers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } else {
      await apiCall('/drivers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    closeModal('driverModal');
    loadDrivers();
    alert('Đã lưu tài xế');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function editDriver(id) {
  try {
    const driver = await apiCall(`/drivers/${id}`);
    
    document.getElementById('driverId').value = driver.id;
    document.getElementById('driverName').value = driver.name;
    document.getElementById('driverPhone').value = driver.phone || '';
    document.getElementById('driverLicense').value = driver.license_number || '';
    document.getElementById('driverIdNumber').value = driver.id_number || '';
    document.getElementById('driverAddress').value = driver.address || '';
    document.getElementById('driverStatus').value = driver.status;
    document.getElementById('driverNotes').value = driver.notes || '';

    document.getElementById('driverModalTitle').textContent = 'Sửa tài xế';
    openModal('driverModal');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteDriver(id) {
  if (!confirm('Bạn có chắc muốn xóa tài xế này?')) return;

  try {
    await apiCall(`/drivers/${id}`, { method: 'DELETE' });
    loadDrivers();
    alert('Đã xóa tài xế');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.editDriver = editDriver;
window.deleteDriver = deleteDriver;

// ============ CONTAINERS ============

async function loadContainers() {
  try {
    const containers = await apiCall('/containers');

    // Update filter dropdown
    const filterSelect = document.getElementById('filterShipmentContainer');
    filterSelect.innerHTML = '<option value="">Tất cả xe</option>';

    // Update shipment form dropdown
    const shipmentContainerSelect = document.getElementById('shipmentContainer');
    shipmentContainerSelect.innerHTML = '<option value="">-- Chọn xe --</option>';

    containers.forEach(container => {
      const option1 = document.createElement('option');
      option1.value = container.id;
      option1.textContent = container.container_number;
      filterSelect.appendChild(option1);

      const option2 = document.createElement('option');
      option2.value = container.id;
      option2.textContent = container.container_number;
      shipmentContainerSelect.appendChild(option2);
    });
  } catch (error) {
    console.error('Load containers error:', error);
  }
}

// ============ SHIPMENTS ============

async function loadShipments() {
  try {
    const fromDate = document.getElementById('filterShipmentFrom').value;
    const toDate = document.getElementById('filterShipmentTo').value;
    const customerId = document.getElementById('filterShipmentCustomer').value;
    const containerId = document.getElementById('filterShipmentContainer').value;
    const status = document.getElementById('filterShipmentStatus').value;

    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    if (customerId) params.append('customer_id', customerId);
    if (containerId) params.append('container_id', containerId);
    if (status) params.append('status', status);

    const shipments = await apiCall(`/shipments?${params.toString()}`);
    const tbody = document.getElementById('shipmentsTable');
    tbody.innerHTML = '';

    shipments.forEach(shipment => {
      // Calculate paid amount (we'll get it from detail later, for now show dash)
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${shipment.shipment_code}</td>
        <td>${formatDate(shipment.shipment_date)}</td>
        <td>${shipment.customer_name}</td>
        <td>${shipment.container_number}</td>
        <td>${shipment.origin} → ${shipment.destination}</td>
        <td class="text-right">${formatMoney(shipment.final_amount)}đ</td>
        <td class="text-right">-</td>
        <td><span class="status-badge status-${shipment.status}">${getStatusText(shipment.status)}</span></td>
        <td>
          <button class="btn-info" onclick="viewShipmentDetail(${shipment.id})">Chi tiết</button>
          <button class="btn-warning" onclick="editShipment(${shipment.id})">Sửa</button>
          <button class="btn-danger" onclick="deleteShipment(${shipment.id})">Xóa</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Load shipments error:', error);
  }
}

function getStatusText(status) {
  const statusMap = {
    'pending': 'Chờ xử lý',
    'in_progress': 'Đang vận chuyển',
    'completed': 'Hoàn thành'
  };
  return statusMap[status] || status;
}

async function saveShipment(event) {
  event.preventDefault();

  const id = document.getElementById('shipmentId').value;
  const data = {
    customer_id: document.getElementById('shipmentCustomer').value,
    driver_id: document.getElementById('shipmentDriver').value || null,
    container_id: document.getElementById('shipmentContainer').value,
    shipment_date: document.getElementById('shipmentDate').value,
    origin: document.getElementById('shipmentOrigin').value,
    destination: document.getElementById('shipmentDestination').value,
    cargo_description: document.getElementById('shipmentCargo').value,
    quantity: parseFloat(document.getElementById('shipmentQuantity').value) || 0,
    unit_price: parseFloat(document.getElementById('shipmentUnitPrice').value) || 0,
    total_charge: parseFloat(document.getElementById('shipmentTotalCharge').value),
    extra_charges: parseFloat(document.getElementById('shipmentExtraCharges').value) || 0,
    discount: parseFloat(document.getElementById('shipmentDiscount').value) || 0,
    status: document.getElementById('shipmentStatus').value,
    notes: document.getElementById('shipmentNotes').value,
  };

  try {
    if (id) {
      await apiCall(`/shipments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } else {
      await apiCall('/shipments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }

    closeModal('shipmentModal');
    loadShipments();
    loadDashboard();
    alert('Đã lưu đơn hàng');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function editShipment(id) {
  try {
    const shipment = await apiCall(`/shipments/${id}`);
    
    document.getElementById('shipmentId').value = shipment.id;
    document.getElementById('shipmentCustomer').value = shipment.customer_id;
    document.getElementById('shipmentDriver').value = shipment.driver_id || '';
    document.getElementById('shipmentContainer').value = shipment.container_id;
    document.getElementById('shipmentDate').value = shipment.shipment_date;
    document.getElementById('shipmentOrigin').value = shipment.origin;
    document.getElementById('shipmentDestination').value = shipment.destination;
    document.getElementById('shipmentCargo').value = shipment.cargo_description || '';
    document.getElementById('shipmentQuantity').value = shipment.quantity || '';
    document.getElementById('shipmentUnitPrice').value = shipment.unit_price || '';
    document.getElementById('shipmentTotalCharge').value = shipment.total_charge;
    document.getElementById('shipmentExtraCharges').value = shipment.extra_charges || 0;
    document.getElementById('shipmentDiscount').value = shipment.discount || 0;
    document.getElementById('shipmentFinalAmount').value = shipment.final_amount;
    document.getElementById('shipmentStatus').value = shipment.status;
    document.getElementById('shipmentNotes').value = shipment.notes || '';

    document.getElementById('shipmentModalTitle').textContent = 'Sửa đơn hàng';
    openModal('shipmentModal');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function deleteShipment(id) {
  if (!confirm('Bạn có chắc muốn xóa đơn hàng này?')) return;

  try {
    await apiCall(`/shipments/${id}`, { method: 'DELETE' });
    loadShipments();
    loadDashboard();
    alert('Đã xóa đơn hàng');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

async function viewShipmentDetail(id) {
  try {
    const shipment = await apiCall(`/shipments/${id}`);
    currentShipmentId = id;

    const content = document.getElementById('shipmentDetailContent');
    content.innerHTML = `
      <div class="detail-info">
        <div class="detail-info-item">
          <div class="detail-info-label">Mã đơn hàng</div>
          <div class="detail-info-value">${shipment.shipment_code}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Ngày vận chuyển</div>
          <div class="detail-info-value">${formatDate(shipment.shipment_date)}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Khách hàng</div>
          <div class="detail-info-value">${shipment.customer_name}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Tài xế</div>
          <div class="detail-info-value">${shipment.driver_name || 'Chưa phân công'}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Số xe</div>
          <div class="detail-info-value">${shipment.container_number}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Trạng thái</div>
          <div class="detail-info-value"><span class="status-badge status-${shipment.status}">${getStatusText(shipment.status)}</span></div>
        </div>
      </div>

      <h4>Tuyến đường</h4>
      <div class="detail-info">
        <div class="detail-info-item">
          <div class="detail-info-label">Nơi nhận</div>
          <div class="detail-info-value">${shipment.origin}</div>
        </div>
        <div class="detail-info-item">
          <div class="detail-info-label">Nơi giao</div>
          <div class="detail-info-value">${shipment.destination}</div>
        </div>
      </div>

      ${shipment.cargo_description ? `
        <h4>Hàng hóa</h4>
        <p>${shipment.cargo_description}</p>
      ` : ''}

      <h4>Chi phí</h4>
      <table class="data-table">
        <tr>
          <td>Cước chính</td>
          <td class="text-right">${formatMoney(shipment.total_charge)}đ</td>
        </tr>
        ${shipment.extra_charges ? `
          <tr>
            <td>Phí phát sinh</td>
            <td class="text-right">${formatMoney(shipment.extra_charges)}đ</td>
          </tr>
        ` : ''}
        ${shipment.discount ? `
          <tr>
            <td>Giảm giá</td>
            <td class="text-right">-${formatMoney(shipment.discount)}đ</td>
          </tr>
        ` : ''}
        <tr style="font-weight: bold; background: #f8f9fa;">
          <td>Tổng cộng</td>
          <td class="text-right">${formatMoney(shipment.final_amount)}đ</td>
        </tr>
        <tr style="color: #27ae60;">
          <td>Đã thanh toán</td>
          <td class="text-right">${formatMoney(shipment.paid_amount)}đ</td>
        </tr>
        <tr style="font-weight: bold; color: ${shipment.remaining_amount > 0 ? '#e74c3c' : '#27ae60'};">
          <td>Còn lại</td>
          <td class="text-right">${formatMoney(shipment.remaining_amount)}đ</td>
        </tr>
      </table>

      ${shipment.payments && shipment.payments.length > 0 ? `
        <h4>Lịch sử thanh toán</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Số tiền</th>
              <th>Phương thức</th>
              <th>Người ghi nhận</th>
            </tr>
          </thead>
          <tbody>
            ${shipment.payments.map(p => `
              <tr>
                <td>${formatDate(p.payment_date)}</td>
                <td class="text-right">${formatMoney(p.amount)}đ</td>
                <td>${getPaymentMethodText(p.payment_method)}</td>
                <td>${p.created_by_name || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>Chưa có thanh toán</p>'}
    `;

    openModal('shipmentDetailModal');
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function getPaymentMethodText(method) {
  const methods = {
    'cash': 'Tiền mặt',
    'transfer': 'Chuyển khoản',
    'check': 'Séc'
  };
  return methods[method] || method;
}

window.editShipment = editShipment;
window.deleteShipment = deleteShipment;
window.viewShipmentDetail = viewShipmentDetail;

// ============ PAYMENTS ============

async function savePayment(event) {
  event.preventDefault();

  const data = {
    shipment_id: document.getElementById('paymentShipmentId').value,
    payment_date: document.getElementById('paymentDate').value,
    amount: parseFloat(document.getElementById('paymentAmount').value),
    payment_method: document.getElementById('paymentMethod').value,
    reference_number: document.getElementById('paymentReference').value,
    notes: document.getElementById('paymentNotes').value,
  };

  try {
    await apiCall('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    closeModal('paymentModal');
    alert('Đã ghi nhận thanh toán');
    
    // Refresh shipment detail
    if (currentShipmentId) {
      viewShipmentDetail(currentShipmentId);
    }
    loadDashboard();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

function printShipment() {
  // This would generate a printable invoice
  alert('Chức năng in đang được phát triển. Hiện tại bạn có thể dùng Ctrl+P để in trang này.');
}

// ============ REPORTS ============

async function loadRevenueReport() {
  try {
    const year = document.getElementById('reportYear').value;
    const data = await apiCall(`/statistics/revenue-by-month?year=${year}`);
    
    const tbody = document.getElementById('revenueReportTable');
    tbody.innerHTML = '';

    const monthNames = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    
    // Create full 12 months
    for (let i = 0; i < 12; i++) {
      const monthStr = monthNames[i];
      const monthData = data.find(d => d.month === monthStr);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>Tháng ${parseInt(monthStr)}</td>
        <td class="text-right">${monthData ? monthData.shipment_count : 0}</td>
        <td class="text-right">${monthData ? formatMoney(monthData.revenue) : '0'}đ</td>
      `;
      tbody.appendChild(tr);
    }

    // Add total row
    const totalShipments = data.reduce((sum, d) => sum + d.shipment_count, 0);
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    
    const totalTr = document.createElement('tr');
    totalTr.style.fontWeight = 'bold';
    totalTr.style.background = '#f8f9fa';
    totalTr.innerHTML = `
      <td>TỔNG</td>
      <td class="text-right">${totalShipments}</td>
      <td class="text-right">${formatMoney(totalRevenue)}đ</td>
    `;
    tbody.appendChild(totalTr);
  } catch (error) {
    console.error('Load revenue report error:', error);
  }
}

// ============ EVENT HANDLERS ============

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError('loginError');

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    await login(username, password);
    showScreen('appScreen');
    document.getElementById('userInfo').textContent = `Xin chào, ${currentUser.fullname}`;
    loadDashboard();
    loadCustomers();
    loadDrivers();
    loadContainers();
  } catch (error) {
    showError('loginError', error.message);
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    showView(view + 'View');

    // Load data for specific views
    if (view === 'dashboard') loadDashboard();
    if (view === 'shipments') loadShipments();
    if (view === 'customers') loadCustomers();
    if (view === 'drivers') loadDrivers();
  });
});

// Customer actions
document.getElementById('btnNewCustomer')?.addEventListener('click', () => {
  document.getElementById('customerForm').reset();
  document.getElementById('customerId').value = '';
  document.getElementById('customerModalTitle').textContent = 'Thêm khách hàng';
  openModal('customerModal');
});

document.getElementById('customerForm')?.addEventListener('submit', saveCustomer);

// Driver actions
document.getElementById('btnNewDriver')?.addEventListener('click', () => {
  document.getElementById('driverForm').reset();
  document.getElementById('driverId').value = '';
  document.getElementById('driverModalTitle').textContent = 'Thêm tài xế';
  openModal('driverModal');
});

document.getElementById('driverForm')?.addEventListener('submit', saveDriver);

// Shipment actions
document.getElementById('btnNewShipment')?.addEventListener('click', () => {
  document.getElementById('shipmentForm').reset();
  document.getElementById('shipmentId').value = '';
  document.getElementById('shipmentDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('shipmentModalTitle').textContent = 'Tạo đơn hàng mới';
  openModal('shipmentModal');
});

document.getElementById('shipmentForm')?.addEventListener('submit', saveShipment);

// Auto-calculate final amount
['shipmentTotalCharge', 'shipmentExtraCharges', 'shipmentDiscount'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    const total = parseFloat(document.getElementById('shipmentTotalCharge').value) || 0;
    const extra = parseFloat(document.getElementById('shipmentExtraCharges').value) || 0;
    const discount = parseFloat(document.getElementById('shipmentDiscount').value) || 0;
    document.getElementById('shipmentFinalAmount').value = total + extra - discount;
  });
});

// Auto-calculate total charge from quantity and unit price
['shipmentQuantity', 'shipmentUnitPrice'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', () => {
    const qty = parseFloat(document.getElementById('shipmentQuantity').value) || 0;
    const price = parseFloat(document.getElementById('shipmentUnitPrice').value) || 0;
    if (qty > 0 && price > 0) {
      document.getElementById('shipmentTotalCharge').value = Math.round(qty * price);
      document.getElementById('shipmentTotalCharge').dispatchEvent(new Event('input'));
    }
  });
});

// Shipment filters
document.getElementById('btnSearchShipments')?.addEventListener('click', loadShipments);

// Shipment detail actions
document.getElementById('btnPrintShipment')?.addEventListener('click', printShipment);

document.getElementById('btnAddPayment')?.addEventListener('click', () => {
  document.getElementById('paymentForm').reset();
  document.getElementById('paymentShipmentId').value = currentShipmentId;
  document.getElementById('paymentDate').value = new Date().toISOString().slice(0, 10);
  openModal('paymentModal');
});

document.getElementById('paymentForm')?.addEventListener('submit', savePayment);

// Reports
document.getElementById('btnLoadRevenueReport')?.addEventListener('click', loadRevenueReport);

// Initialize
if (authToken && currentUser) {
  showScreen('appScreen');
  document.getElementById('userInfo').textContent = `Xin chào, ${currentUser.fullname}`;
  loadDashboard();
  loadCustomers();
  loadDrivers();
  loadContainers();
} else {
  showScreen('loginScreen');
}
