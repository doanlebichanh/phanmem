// ================================================
// PHASE 2 & 3 FEATURES
// ================================================

// ===== PHASE 2.1: QUẢN LÝ NHIÊN LIỆU =====

window.renderFuelManagement = async function(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>⛽ Quản Lý Nhiên Liệu</h1>
      <div>
        <button class="btn btn-success" onclick="exportFuelReport()" style="margin-right: 10px;">
          <span>📥</span> Xuất Excel
        </button>
        <button class="btn btn-primary" onclick="showFuelRecordModal()">
          <span>➕</span> Thêm Đổ Xăng
        </button>
      </div>
    </div>

    <div class="filters-section">
      <div class="filters">
        <div class="filter-group">
          <label>Xe</label>
          <select id="filterFuelVehicle">
            <option value="">Tất cả</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Tháng</label>
          <input type="month" id="filterFuelMonth">
        </div>
        <button class="btn btn-secondary" onclick="filterFuelRecords()">Lọc</button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('fuel-records', this)">📋 Lịch Sử Đổ Xăng</button>
      <button class="tab-btn" onclick="switchTab('fuel-stats', this)">📊 Thống Kê Tiêu Hao</button>
    </div>

    <div id="fuel-records" class="tab-content active"></div>
    <div id="fuel-stats" class="tab-content"></div>
  `;

  await populateFuelFilters();
  await loadFuelRecords();
  await loadFuelStats();
};

// Export fuel report to Excel
window.exportFuelReport = async function() {
  try {
    const vehicle_id = document.getElementById('filterFuelVehicle')?.value || '';
    const month = document.getElementById('filterFuelMonth')?.value || '';
    
    let url = '/export/fuel-records?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}&`;
    if (month) url += `month=${month}&`;
    
    const response = await fetch(`${API_URL}${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Lỗi tải báo cáo');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `BaoCaoNhienLieu_${month || 'TatCa'}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    
    alert('Đã xuất báo cáo thành công!');
  } catch (error) {
    console.error('Export error:', error);
    alert('Lỗi xuất báo cáo: ' + error.message);
  }
};

async function populateFuelFilters() {
  try {
    const vehicles = await apiCall('/vehicles');
    const vehicleSelect = document.getElementById('filterFuelVehicle');
    
    vehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.id;
      option.textContent = v.plate_number;
      vehicleSelect.appendChild(option);
    });

    // Set tháng hiện tại
    const now = new Date();
    document.getElementById('filterFuelMonth').value = 
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  } catch (error) {
    console.error('Error:', error);
  }
}

window.filterFuelRecords = async function() {
  await loadFuelRecords();
  await loadFuelStats();
};

async function loadFuelRecords() {
  try {
    const vehicle_id = document.getElementById('filterFuelVehicle')?.value;
    const month = document.getElementById('filterFuelMonth')?.value;
    
    let url = '/fuel-records?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}&`;
    if (month) url += `month=${month}&`;
    
    const records = await apiCall(url);
    
    const content = document.getElementById('fuel-records');
    if (!records || records.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có dữ liệu đổ xăng</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Xe</th>
            <th>Loại</th>
            <th>Số lít</th>
            <th>Giá/lít</th>
            <th>Tổng tiền</th>
            <th>Km đồng hồ</th>
            <th>Cây xăng</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${formatDate(r.fuel_date)}</td>
              <td>${r.plate_number}</td>
              <td>${getFuelTypeName(r.fuel_type)}</td>
              <td class="text-right">${formatNumber(r.liters)} L</td>
              <td class="text-right">${formatCurrency(r.price_per_liter)}</td>
              <td class="text-right"><strong>${formatCurrency(r.total_cost)}</strong></td>
              <td class="text-right">${r.odometer_reading ? formatNumber(r.odometer_reading) + ' km' : '-'}</td>
              <td>${r.station_name || '-'}</td>
              <td class="actions">
                <button class="btn btn-sm btn-info" onclick="editFuelRecord(${r.id})" title="Sửa">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteFuelRecord(${r.id})" title="Xóa">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="3">Tổng cộng:</th>
            <th class="text-right">${formatNumber(records.reduce((sum, r) => sum + r.liters, 0))} L</th>
            <th></th>
            <th class="text-right"><strong>${formatCurrency(records.reduce((sum, r) => sum + r.total_cost, 0))}</strong></th>
            <th colspan="3"></th>
          </tr>
        </tfoot>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
    alert('Lỗi tải dữ liệu: ' + error.message);
  }
}

async function loadFuelStats() {
  try {
    const vehicle_id = document.getElementById('filterFuelVehicle')?.value;
    const month = document.getElementById('filterFuelMonth')?.value;
    
    let url = '/fuel-records/stats?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}&`;
    if (month) url += `month=${month}&`;
    
    const stats = await apiCall(url);
    
    const content = document.getElementById('fuel-stats');
    if (!stats || stats.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có dữ liệu thống kê</p>';
      return;
    }

    content.innerHTML = `
      <div class="stats-grid">
        ${stats.map(s => `
          <div class="stat-card">
            <h3>${s.plate_number}</h3>
            <div class="stat-row">
              <span>Tổng đổ:</span>
              <strong>${formatNumber(s.total_liters)} L</strong>
            </div>
            <div class="stat-row">
              <span>Chi phí:</span>
              <strong class="text-danger">${formatCurrency(s.total_cost)}</strong>
            </div>
            <div class="stat-row">
              <span>Số lần:</span>
              <strong>${s.refuel_count} lần</strong>
            </div>
            <div class="stat-row">
              <span>TB/lần:</span>
              <strong>${formatNumber(s.avg_liters_per_refuel)} L</strong>
            </div>
            ${s.distance_traveled ? `
              <div class="stat-row">
                <span>Km đã chạy:</span>
                <strong>${formatNumber(s.distance_traveled)} km</strong>
              </div>
              <div class="stat-row">
                <span>Tiêu hao:</span>
                <strong class="text-warning">${formatNumber(s.consumption_rate)} L/100km</strong>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error:', error);
  }
}

function getFuelTypeName(type) {
  const types = {
    'diesel': '⛽ Dầu Diesel',
    'gasoline_92': '⛽ Xăng 92',
    'gasoline_95': '⛽ Xăng 95',
    'gasoline_e5': '⛽ Xăng E5'
  };
  return types[type] || type;
}

window.showFuelRecordModal = async function(fuelId = null) {
  try {
    const vehicles = await apiCall('/vehicles');
    let fuel = null;
    
    if (fuelId) {
      fuel = await apiCall(`/fuel-records/${fuelId}`);
    }

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>⛽ ${fuelId ? 'Sửa' : 'Thêm'} Đổ Xăng</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="fuelForm" class="modal-body" onsubmit="saveFuelRecord(event, ${fuelId})">
            <div class="form-row">
              <div class="form-group">
                <label>🚛 Xe *</label>
                <select id="fuelVehicle" required>
                  <option value="">-- Chọn xe --</option>
                  ${vehicles.map(v => `
                    <option value="${v.id}" ${fuel?.vehicle_id === v.id ? 'selected' : ''}>
                      ${v.plate_number}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>📅 Ngày đổ xăng *</label>
                <input type="date" id="fuelDate" value="${fuel?.fuel_date || new Date().toISOString().substring(0, 10)}" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>⛽ Loại nhiên liệu *</label>
                <select id="fuelType" required>
                  <option value="">-- Chọn loại --</option>
                  <option value="diesel" ${fuel?.fuel_type === 'diesel' ? 'selected' : ''}>Dầu Diesel</option>
                  <option value="gasoline_92" ${fuel?.fuel_type === 'gasoline_92' ? 'selected' : ''}>Xăng 92</option>
                  <option value="gasoline_95" ${fuel?.fuel_type === 'gasoline_95' ? 'selected' : ''}>Xăng 95</option>
                  <option value="gasoline_e5" ${fuel?.fuel_type === 'gasoline_e5' ? 'selected' : ''}>Xăng E5</option>
                </select>
              </div>
              <div class="form-group">
                <label>📊 Km đồng hồ</label>
                <input type="number" id="fuelOdometer" value="${fuel?.odometer_reading || ''}" placeholder="VD: 150000">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>🛢️ Số lít *</label>
                <input type="number" step="0.01" id="fuelLiters" value="${fuel?.liters || ''}" required placeholder="VD: 50.5" oninput="calculateFuelCost()">
              </div>
              <div class="form-group">
                <label>💵 Giá/lít (VNĐ) *</label>
                <input type="number" id="fuelPricePerLiter" value="${fuel?.price_per_liter || ''}" required placeholder="VD: 22000" oninput="calculateFuelCost()">
              </div>
            </div>

            <div class="form-group">
              <label>💰 Tổng tiền (VNĐ) *</label>
              <input type="number" id="fuelTotalCost" value="${fuel?.total_cost || ''}" required readonly style="background: #f5f5f5;">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>🏪 Cây xăng</label>
                <input type="text" id="fuelStation" value="${fuel?.station_name || ''}" placeholder="Tên cây xăng">
              </div>
              <div class="form-group">
                <label>🧾 Số biên lai</label>
                <input type="text" id="fuelReceipt" value="${fuel?.receipt_number || ''}" placeholder="Mã biên lai">
              </div>
            </div>

            <div class="form-group">
              <label>📝 Ghi chú</label>
              <textarea id="fuelNotes" rows="2" placeholder="Ghi chú thêm (nếu có)">${fuel?.notes || ''}</textarea>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="fuelForm" class="btn btn-primary">💾 Lưu</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.calculateFuelCost = function() {
  const liters = parseFloat(document.getElementById('fuelLiters').value) || 0;
  const pricePerLiter = parseFloat(document.getElementById('fuelPricePerLiter').value) || 0;
  const totalCost = liters * pricePerLiter;
  document.getElementById('fuelTotalCost').value = totalCost;
};

window.saveFuelRecord = async function(event, fuelId) {
  event.preventDefault();
  
  try {
    const data = {
      vehicle_id: document.getElementById('fuelVehicle').value,
      fuel_date: document.getElementById('fuelDate').value,
      fuel_type: document.getElementById('fuelType').value,
      liters: parseFloat(document.getElementById('fuelLiters').value),
      price_per_liter: parseFloat(document.getElementById('fuelPricePerLiter').value),
      total_cost: parseFloat(document.getElementById('fuelTotalCost').value),
      odometer_reading: document.getElementById('fuelOdometer').value || null,
      station_name: document.getElementById('fuelStation').value,
      receipt_number: document.getElementById('fuelReceipt').value,
      notes: document.getElementById('fuelNotes').value
    };

    if (fuelId) {
      await apiCall(`/fuel-records/${fuelId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/fuel-records', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    alert('Đã lưu thành công!');
    closeModal();
    await loadFuelRecords();
    await loadFuelStats();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.editFuelRecord = function(id) {
  showFuelRecordModal(id);
};

window.deleteFuelRecord = async function(id) {
  if (!confirm('Xóa bản ghi đổ xăng này?')) return;
  
  try {
    await apiCall(`/fuel-records/${id}`, { method: 'DELETE' });
    alert('Đã xóa!');
    await loadFuelRecords();
    await loadFuelStats();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// ===== HELPER FUNCTIONS =====

function switchTab(tabId, button) {
  // Ẩn tất cả tab content
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Bỏ active tất cả tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Active tab được chọn
  document.getElementById(tabId).classList.add('active');
  button.classList.add('active');
}

// ===== PHASE 2.2: CASH FLOW (DÒNG TIỀN) =====

window.renderCashFlow = async function(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>💰 Dòng Tiền</h1>
      <div>
        <button class="btn btn-success" onclick="exportCashFlowReport()" style="margin-right: 10px;">
          <span>📥</span> Xuất Excel
        </button>
        <button class="btn btn-primary" onclick="showCashFlowModal()">
          <span>➕</span> Ghi Thu/Chi
        </button>
      </div>
    </div>

    <div class="filters-section">
      <div class="filters">
        <div class="filter-group">
          <label>Loại</label>
          <select id="filterCashType">
            <option value="">Tất cả</option>
            <option value="income">Thu</option>
            <option value="expense">Chi</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Từ ngày</label>
          <input type="date" id="filterCashFrom">
        </div>
        <div class="filter-group">
          <label>Đến ngày</label>
          <input type="date" id="filterCashTo">
        </div>
        <button class="btn btn-secondary" onclick="filterCashFlow()">Lọc</button>
      </div>
    </div>

    <div class="stats-summary" id="cashflowSummary"></div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('cashflow-list', this)">📋 Danh Sách</button>
      <button class="tab-btn" onclick="switchTab('cashflow-chart', this)">📊 Biểu Đồ</button>
    </div>

    <div id="cashflow-list" class="tab-content active"></div>
    <div id="cashflow-chart" class="tab-content"></div>
  `;

  // Set mặc định tháng hiện tại
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  document.getElementById('filterCashFrom').value = firstDay.toISOString().substring(0, 10);
  document.getElementById('filterCashTo').value = lastDay.toISOString().substring(0, 10);

  await loadCashFlow();
};

window.filterCashFlow = async function() {
  await loadCashFlow();
};

async function loadCashFlow() {
  try {
    const type = document.getElementById('filterCashType')?.value;
    const from = document.getElementById('filterCashFrom')?.value;
    const to = document.getElementById('filterCashTo')?.value;
    
    let url = '/cash-flow?';
    if (type) url += `type=${type}&`;
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}&`;
    
    const records = await apiCall(url);
    
    // Tính tổng thu chi
    const totalIncome = records.filter(r => r.type === 'income').reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = records.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
    const netFlow = totalIncome - totalExpense;

    // Hiển thị summary
    document.getElementById('cashflowSummary').innerHTML = `
      <div class="stat-box stat-success">
        <h3>💵 Thu</h3>
        <p class="stat-value">${formatCurrency(totalIncome)}</p>
      </div>
      <div class="stat-box stat-danger">
        <h3>💸 Chi</h3>
        <p class="stat-value">${formatCurrency(totalExpense)}</p>
      </div>
      <div class="stat-box ${netFlow >= 0 ? 'stat-info' : 'stat-warning'}">
        <h3>📊 Ròng</h3>
        <p class="stat-value">${formatCurrency(netFlow)}</p>
      </div>
    `;

    // Hiển thị danh sách
    const listContent = document.getElementById('cashflow-list');
    if (!records || records.length === 0) {
      listContent.innerHTML = '<p class="no-data">Chưa có dữ liệu dòng tiền</p>';
      return;
    }

    listContent.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Loại</th>
            <th>Danh mục</th>
            <th>Mô tả</th>
            <th>Số tiền</th>
            <th>Phương thức</th>
            <th>Liên quan</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${formatDate(r.transaction_date)}</td>
              <td>
                <span class="badge ${r.type === 'income' ? 'badge-completed' : 'badge-cancelled'}">
                  ${r.type === 'income' ? '💵 Thu' : '💸 Chi'}
                </span>
              </td>
              <td>${getCashFlowCategoryName(r.category)}</td>
              <td>${r.description || '-'}</td>
              <td class="text-right ${r.type === 'income' ? 'text-success' : 'text-danger'}">
                <strong>${formatCurrency(r.amount)}</strong>
              </td>
              <td>${getPaymentMethodName(r.payment_method)}</td>
              <td>
                ${r.order_code ? `Đơn: ${r.order_code}` : ''}
                ${r.driver_name ? `TX: ${r.driver_name}` : ''}
                ${r.plate_number ? `Xe: ${r.plate_number}` : ''}
                ${!r.order_code && !r.driver_name && !r.plate_number ? '-' : ''}
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-info" onclick="editCashFlow(${r.id})" title="Sửa">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCashFlow(${r.id})" title="Xóa">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Biểu đồ đơn giản (text based)
    const chartContent = document.getElementById('cashflow-chart');
    const dailyStats = {};
    records.forEach(r => {
      const date = r.transaction_date;
      if (!dailyStats[date]) {
        dailyStats[date] = { income: 0, expense: 0 };
      }
      if (r.type === 'income') {
        dailyStats[date].income += r.amount;
      } else {
        dailyStats[date].expense += r.amount;
      }
    });

    chartContent.innerHTML = `
      <div class="chart-container">
        <h3>Biểu đồ thu chi theo ngày</h3>
        ${Object.keys(dailyStats).sort().map(date => `
          <div class="bar-chart-row">
            <span class="bar-label">${formatDate(date)}</span>
            <div class="bar-group">
              <div class="bar bar-income" style="width: ${(dailyStats[date].income / Math.max(totalIncome, totalExpense)) * 100}%">
                ${formatCurrency(dailyStats[date].income)}
              </div>
              <div class="bar bar-expense" style="width: ${(dailyStats[date].expense / Math.max(totalIncome, totalExpense)) * 100}%">
                ${formatCurrency(dailyStats[date].expense)}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Error:', error);
    alert('Lỗi tải dữ liệu: ' + error.message);
  }
}

function getCashFlowCategoryName(category) {
  const categories = {
    'freight_revenue': '🚚 Cước vận chuyển',
    'fuel_cost': '⛽ Chi phí nhiên liệu',
    'salary': '💵 Lương',
    'maintenance': '🔧 Bảo dưỡng',
    'insurance': '🛡️ Bảo hiểm',
    'tax': '💰 Thuế',
    'fine': '⚠️ Phạt',
    'other_income': '➕ Thu khác',
    'other_expense': '➖ Chi khác'
  };
  return categories[category] || category;
}

function getPaymentMethodName(method) {
  const methods = {
    'cash': '💵 Tiền mặt',
    'bank_transfer': '🏦 Chuyển khoản',
    'card': '💳 Thẻ',
    'other': '📌 Khác'
  };
  return methods[method] || method || '-';
}

window.showCashFlowModal = async function(cashId = null) {
  try {
    const [orders, drivers, vehicles] = await Promise.all([
      apiCall('/orders'),
      apiCall('/drivers'),
      apiCall('/vehicles')
    ]);
    
    let cash = null;
    if (cashId) {
      cash = await apiCall(`/cash-flow/${cashId}`);
    }

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>💰 ${cashId ? 'Sửa' : 'Ghi'} Thu/Chi</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="cashFlowForm" class="modal-body" onsubmit="saveCashFlow(event, ${cashId})">
            <div class="form-row">
              <div class="form-group">
                <label>📅 Ngày giao dịch *</label>
                <input type="date" id="cashDate" value="${cash?.transaction_date || new Date().toISOString().substring(0, 10)}" required>
              </div>
              <div class="form-group">
                <label>💼 Loại *</label>
                <select id="cashType" required onchange="updateCashCategories()">
                  <option value="">-- Chọn loại --</option>
                  <option value="income" ${cash?.type === 'income' ? 'selected' : ''}>💵 Thu</option>
                  <option value="expense" ${cash?.type === 'expense' ? 'selected' : ''}>💸 Chi</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>📋 Danh mục *</label>
                <select id="cashCategory" required>
                  <option value="">-- Chọn danh mục --</option>
                </select>
              </div>
              <div class="form-group">
                <label>💰 Số tiền (VNĐ) *</label>
                <input type="number" id="cashAmount" value="${cash?.amount || ''}" required placeholder="VD: 5000000">
              </div>
            </div>

            <div class="form-group">
              <label>📝 Mô tả *</label>
              <input type="text" id="cashDescription" value="${cash?.description || ''}" required placeholder="Mô tả ngắn gọn">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>💳 Phương thức thanh toán</label>
                <select id="cashPaymentMethod">
                  <option value="">-- Chọn phương thức --</option>
                  <option value="cash" ${cash?.payment_method === 'cash' ? 'selected' : ''}>💵 Tiền mặt</option>
                  <option value="bank_transfer" ${cash?.payment_method === 'bank_transfer' ? 'selected' : ''}>🏦 Chuyển khoản</option>
                  <option value="card" ${cash?.payment_method === 'card' ? 'selected' : ''}>💳 Thẻ</option>
                  <option value="other" ${cash?.payment_method === 'other' ? 'selected' : ''}>📌 Khác</option>
                </select>
              </div>
              <div class="form-group">
                <label>🧾 Số tham chiếu</label>
                <input type="text" id="cashReference" value="${cash?.reference_number || ''}" placeholder="Số hóa đơn/giao dịch">
              </div>
            </div>

            <fieldset style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0;">
              <legend style="color: #667eea; font-weight: 600;">🔗 Liên Kết (Tùy chọn)</legend>
              <div class="form-row">
                <div class="form-group">
                  <label>📦 Đơn hàng</label>
                  <select id="cashOrder">
                    <option value="">-- Không liên kết --</option>
                    ${orders.map(o => `<option value="${o.id}" ${cash?.order_id === o.id ? 'selected' : ''}>${o.order_code}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>🚗 Tài xế</label>
                  <select id="cashDriver">
                    <option value="">-- Không liên kết --</option>
                    ${drivers.map(d => `<option value="${d.id}" ${cash?.driver_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>🚛 Xe</label>
                <select id="cashVehicle">
                  <option value="">-- Không liên kết --</option>
                  ${vehicles.map(v => `<option value="${v.id}" ${cash?.vehicle_id === v.id ? 'selected' : ''}>${v.plate_number}</option>`).join('')}
                </select>
              </div>
            </fieldset>

            <div class="form-group">
              <label>📝 Ghi chú</label>
              <textarea id="cashNotes" rows="2" placeholder="Ghi chú thêm (nếu có)">${cash?.notes || ''}</textarea>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="cashFlowForm" class="btn btn-primary">💾 Lưu</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
    
    // Set categories dựa trên type hiện tại
    if (cash) {
      updateCashCategories(cash.category);
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.updateCashCategories = function(selectedValue = '') {
  const type = document.getElementById('cashType').value;
  const categorySelect = document.getElementById('cashCategory');
  
  const incomeCategories = [
    { value: 'freight_revenue', label: '🚚 Cước vận chuyển' },
    { value: 'other_income', label: '➕ Thu khác' }
  ];
  
  const expenseCategories = [
    { value: 'fuel_cost', label: '⛽ Chi phí nhiên liệu' },
    { value: 'salary', label: '💵 Lương' },
    { value: 'maintenance', label: '🔧 Bảo dưỡng' },
    { value: 'insurance', label: '🛡️ Bảo hiểm' },
    { value: 'tax', label: '💰 Thuế' },
    { value: 'fine', label: '⚠️ Phạt' },
    { value: 'other_expense', label: '➖ Chi khác' }
  ];
  
  const categories = type === 'income' ? incomeCategories : expenseCategories;
  
  categorySelect.innerHTML = '<option value="">-- Chọn danh mục --</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.label;
    if (selectedValue === cat.value) {
      option.selected = true;
    }
    categorySelect.appendChild(option);
  });
};

window.saveCashFlow = async function(event, cashId) {
  event.preventDefault();
  
  try {
    const data = {
      transaction_date: document.getElementById('cashDate').value,
      type: document.getElementById('cashType').value,
      category: document.getElementById('cashCategory').value,
      amount: parseFloat(document.getElementById('cashAmount').value),
      description: document.getElementById('cashDescription').value,
      payment_method: document.getElementById('cashPaymentMethod').value || null,
      reference_number: document.getElementById('cashReference').value || null,
      order_id: document.getElementById('cashOrder').value || null,
      driver_id: document.getElementById('cashDriver').value || null,
      vehicle_id: document.getElementById('cashVehicle').value || null,
      notes: document.getElementById('cashNotes').value
    };

    if (cashId) {
      await apiCall(`/cash-flow/${cashId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/cash-flow', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    alert('Đã lưu thành công!');
    closeModal();
    await loadCashFlow();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.editCashFlow = function(id) {
  showCashFlowModal(id);
};

window.deleteCashFlow = async function(id) {
  if (!confirm('Xóa giao dịch này?')) return;
  
  try {
    await apiCall(`/cash-flow/${id}`, { method: 'DELETE' });
    alert('Đã xóa!');
    await loadCashFlow();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// Export cash flow report to Excel
window.exportCashFlowReport = async function() {
  try {
    const type = document.getElementById('filterCashType')?.value || '';
    const from = document.getElementById('filterCashFrom')?.value || '';
    const to = document.getElementById('filterCashTo')?.value || '';
    
    let url = '/export/cash-flow?';
    if (type) url += `type=${type}&`;
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}&`;
    
    const response = await fetch(`${API_URL}${url}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Lỗi tải báo cáo');
    }
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `BaoCaoDongTien_${from || 'Dau'}_${to || 'Cuoi'}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    
    alert('Đã xuất báo cáo dòng tiền thành công!');
  } catch (error) {
    console.error('Export error:', error);
    alert('Lỗi xuất báo cáo: ' + error.message);
  }
};
