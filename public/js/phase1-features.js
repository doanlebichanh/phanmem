// ==================== PHASE 1: SALARY MANAGEMENT ====================

// Helper functions - Export to global scope
window.formatCurrency = function formatCurrency(amount) {
  if (!amount) return '0đ';
  return new Intl.NumberFormat('vi-VN', { 
    style: 'currency', 
    currency: 'VND' 
  }).format(amount);
}

window.formatNumber = function formatNumber(num) {
  if (!num) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
}

// Export to window scope for app.js to access
window.renderSalaries = async function renderSalaries(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>💵 Quản lý Lương Tài Xế</h1>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showCalculateSalaryModal()">
          ➕ Tính lương tháng
        </button>
        <button class="btn btn-secondary" onclick="showBonusPenaltyModal()">
          ⭐ Thưởng/Phạt
        </button>
        <button class="btn btn-success" onclick="exportSalariesExcel()">
          📊 Export Excel
        </button>
      </div>
    </div>

    <div class="filter-bar">
      <select id="filterSalaryMonth" onchange="filterSalaries()">
        <option value="">-- Tất cả tháng --</option>
      </select>
      <select id="filterSalaryDriver" onchange="filterSalaries()">
        <option value="">-- Tất cả tài xế --</option>
      </select>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="salaries">Bảng lương</button>
      <button class="tab-btn" data-tab="bonuses">Thưởng/Phạt</button>
    </div>

    <div class="tab-content active" id="salaries-content"></div>
    <div class="tab-content" id="bonuses-content"></div>
  `;

  // Setup tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      document.getElementById(`${e.target.dataset.tab}-content`).classList.add('active');
    });
  });

  // Load data
  try {
    await populateSalaryFilters();
    await loadSalaries();
    await loadBonusesPenalties();
  } catch (error) {
    console.error('Error loading salaries:', error);
    container.innerHTML += `<div class="alert alert-danger">Lỗi tải dữ liệu: ${error.message}</div>`;
  }
}

async function populateSalaryFilters() {
  try {
    const drivers = await apiCall('/drivers');
    const driverSelect = document.getElementById('filterSalaryDriver');
    
    drivers.forEach(d => {
      const option = document.createElement('option');
      option.value = d.id;
      option.textContent = d.name;
      driverSelect.appendChild(option);
    });

    // Generate last 12 months
    const monthSelect = document.getElementById('filterSalaryMonth');
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().substring(0, 7);
      const option = document.createElement('option');
      option.value = monthStr;
      option.textContent = `Tháng ${monthStr}`;
      monthSelect.appendChild(option);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

window.filterSalaries = async function() {
  await loadSalaries();
}

async function loadSalaries() {
  try {
    const month = document.getElementById('filterSalaryMonth')?.value;
    const driver_id = document.getElementById('filterSalaryDriver')?.value;
    
    let url = '/salaries?';
    if (month) url += `month=${month}&`;
    if (driver_id) url += `driver_id=${driver_id}&`;
    
    const salaries = await apiCall(url);
    
    const content = document.getElementById('salaries-content');
    if (!salaries || salaries.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có bản lương nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Tháng</th>
            <th>Tài xế</th>
            <th>Lương cơ bản</th>
            <th>Số chuyến</th>
            <th>Thưởng</th>
            <th>Phạt</th>
            <th>Tạm ứng trừ</th>
            <th>Tổng lương</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${salaries.map(s => `
            <tr>
              <td>${s.salary_month}</td>
              <td>${s.driver_name}</td>
              <td>${formatCurrency(s.base_salary)}</td>
              <td>${s.trip_count}</td>
              <td class="text-success">${formatCurrency(s.trip_bonus)}</td>
              <td class="text-danger">${formatCurrency(s.deductions)}</td>
              <td class="text-warning">${formatCurrency(s.advances_deducted)}</td>
              <td><strong>${formatCurrency(s.total_salary)}</strong></td>
              <td>${getSalaryStatusBadge(s.status)}</td>
              <td class="actions">
                <button class="btn btn-sm btn-info" onclick="viewSalaryDetail(${s.id})" title="Xem chi tiết">👁️</button>
                ${s.status === 'draft' ? `
                  <button class="btn btn-sm btn-info" onclick="editSalary(${s.id})" title="Sửa">✏️</button>
                  <button class="btn btn-sm btn-success" onclick="approveSalary(${s.id})" title="Duyệt">✅</button>
                  <button class="btn btn-sm btn-primary" onclick="showPaySalaryModal(${s.id})" title="Trả lương">💰</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteSalary(${s.id})" title="Xóa">🗑️</button>
                ` : s.status === 'approved' ? `
                  <button class="btn btn-sm btn-primary" onclick="showPaySalaryModal(${s.id})" title="Trả lương">💰</button>
                ` : `
                  <span class="badge badge-completed">✓ Đã trả</span>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
    alert('Lỗi tải bảng lương: ' + error.message);
  }
}

function getSalaryStatusBadge(status) {
  const badges = {
    'draft': '<span class="badge badge-pending">Nháp</span>',
    'approved': '<span class="badge badge-active">Đã duyệt</span>',
    'paid': '<span class="badge badge-completed">Đã trả</span>'
  };
  return badges[status] || status;
}

window.showCalculateSalaryModal = async function() {
  try {
    const drivers = await apiCall('/drivers');
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const salaryMonth = lastMonth.toISOString().substring(0, 7);

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>💰 Tính lương tháng</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="calcSalaryForm" class="modal-body" onsubmit="calculateSalary(event)">
            <div class="form-group">
              <label>Tài xế *</label>
              <select id="calcDriver" required>
                <option value="">-- Chọn tài xế --</option>
                ${drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tháng *</label>
                <input type="month" id="calcMonth" value="${salaryMonth}" required>
              </div>
              <div class="form-group">
                <label>Lương cơ bản (VNĐ) *</label>
                <input type="number" id="calcBaseSalary" value="8000000" required>
              </div>
            </div>
            <div id="calcResult" style="display: none; background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%); padding: 20px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #00acc1;">
              <h4 style="margin-bottom: 15px; color: #00695c;">📊 Kết quả tính lương:</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <p style="margin: 8px 0;"><strong>Số chuyến:</strong> <span id="resultTripCount" style="color: #0277bd;"></span></p>
                <p style="margin: 8px 0;"><strong>Thưởng chuyến:</strong> <span id="resultBonus" style="color: #2e7d32;"></span></p>
                <p style="margin: 8px 0;"><strong>Phạt:</strong> <span id="resultPenalty" style="color: #c62828;"></span></p>
                <p style="margin: 8px 0;"><strong>Tạm ứng trừ:</strong> <span id="resultAdvance" style="color: #f57c00;"></span></p>
              </div>
              <h3 style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #00897b; color: #00695c;"><strong>💵 Tổng lương:</strong> <span id="resultTotal" style="color: #00695c; font-size: 1.3em;"></span></h3>
            </div>
          </form>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="button" class="btn btn-secondary" onclick="calculatePreview()">🔍 Tính toán</button>
            <button type="submit" form="calcSalaryForm" class="btn btn-primary" id="btnSaveSalary" style="display: none;">💾 Lưu bản lương</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.calculatePreview = async function() {
  try {
    const driver_id = document.getElementById('calcDriver').value;
    const salary_month = document.getElementById('calcMonth').value;
    const base_salary = parseFloat(document.getElementById('calcBaseSalary').value);

    if (!driver_id || !salary_month) {
      alert('Vui lòng chọn tài xế và tháng');
      return;
    }

    const result = await apiCall('/salaries/calculate', {
      method: 'POST',
      body: JSON.stringify({ driver_id, salary_month, base_salary })
    });

    document.getElementById('resultTripCount').textContent = result.trip_count;
    document.getElementById('resultBonus').textContent = formatCurrency(result.trip_bonus);
    document.getElementById('resultPenalty').textContent = formatCurrency(result.deductions);
    document.getElementById('resultAdvance').textContent = formatCurrency(result.advances_deducted);
    document.getElementById('resultTotal').textContent = formatCurrency(result.total_salary);

    document.getElementById('calcResult').style.display = 'block';
    document.getElementById('btnSaveSalary').style.display = 'inline-block';
  } catch (error) {
    alert('Lỗi tính lương: ' + error.message);
  }
};

window.calculateSalary = async function(event) {
  event.preventDefault();
  
  try {
    const driver_id = document.getElementById('calcDriver').value;
    const salary_month = document.getElementById('calcMonth').value;
    const base_salary = parseFloat(document.getElementById('calcBaseSalary').value);

    const result = await apiCall('/salaries/calculate', {
      method: 'POST',
      body: JSON.stringify({ driver_id, salary_month, base_salary })
    });

    // Thêm các trường thiếu
    const salaryData = {
      ...result,
      overtime_hours: 0,
      overtime_pay: 0,
      notes: ''
    };

    await apiCall('/salaries', {
      method: 'POST',
      body: JSON.stringify(salaryData)
    });

    alert('Đã tạo bản lương thành công!');
    closeModal();
    await loadSalaries();
  } catch (error) {
    alert('Lỗi lưu lương: ' + error.message);
  }
};

window.approveSalary = async function(id) {
  if (!confirm('Duyệt bản lương này?')) return;
  
  try {
    await apiCall(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'approved' })
    });
    alert('Đã duyệt lương!');
    await loadSalaries();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.showPaySalaryModal = async function(id) {
  try {
    const salary = await apiCall(`/salaries/${id}`);
    
    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>💰 Trả Lương</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="paySalaryForm" class="modal-body" onsubmit="processPay(event, ${id})">
            <div class="info-box" style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p><strong>Tài xế:</strong> ${salary.driver_name}</p>
              <p><strong>Tháng:</strong> ${salary.salary_month}</p>
              <p style="font-size: 18px; color: #667eea;"><strong>Tổng lương:</strong> ${formatCurrency(salary.total_salary)}</p>
            </div>
            
            <div class="form-group">
              <label>📅 Ngày trả lương *</label>
              <input type="date" id="paidDate" value="${new Date().toISOString().substring(0, 10)}" required>
            </div>
            
            <div class="form-group">
              <label>💳 Phương thức thanh toán *</label>
              <select id="paymentMethod" required>
                <option value="cash">💵 Tiền mặt</option>
                <option value="bank_transfer" selected>🏦 Chuyển khoản</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>📝 Ghi chú</label>
              <textarea id="paymentNotes" rows="3" placeholder="Ghi chú về việc trả lương (nếu có)"></textarea>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="paySalaryForm" class="btn btn-primary">💰 Xác nhận trả lương</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.processPay = async function(event, id) {
  event.preventDefault();
  
  try {
    const data = {
      status: 'paid',
      paid_date: document.getElementById('paidDate').value,
      payment_method: document.getElementById('paymentMethod').value,
      notes: document.getElementById('paymentNotes').value
    };
    
    await apiCall(`/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    alert('Đã cập nhật trả lương thành công!');
    closeModal();
    await loadSalaries();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.editSalary = async function(id) {
  try {
    const salary = await apiCall(`/salaries/${id}`);
    
    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>✏️ Sửa Bản Lương</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="editSalaryForm" class="modal-body" onsubmit="updateSalary(event, ${id})">
            <div class="form-group">
              <label>Tài xế</label>
              <input type="text" value="${salary.driver_name}" disabled>
            </div>
            
            <div class="form-group">
              <label>Tháng</label>
              <input type="text" value="${salary.salary_month}" disabled>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>💰 Lương cơ bản *</label>
                <input type="number" id="editBaseSalary" value="${salary.base_salary}" required>
              </div>
              <div class="form-group">
                <label>📊 Số chuyến</label>
                <input type="number" value="${salary.trip_count}" disabled>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>⏰ Giờ tăng ca</label>
                <input type="number" id="editOvertimeHours" value="${salary.overtime_hours || 0}" step="0.5">
              </div>
              <div class="form-group">
                <label>💵 Lương tăng ca</label>
                <input type="number" id="editOvertimePay" value="${salary.overtime_pay || 0}">
              </div>
            </div>
            
            <div class="form-group">
              <label>📝 Ghi chú</label>
              <textarea id="editNotes" rows="3">${salary.notes || ''}</textarea>
            </div>
            
            <div class="info-box" style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <p><strong>Thưởng chuyến:</strong> ${formatCurrency(salary.trip_bonus)}</p>
              <p><strong>Phạt:</strong> ${formatCurrency(salary.deductions)}</p>
              <p><strong>Tạm ứng trừ:</strong> ${formatCurrency(salary.advances_deducted)}</p>
              <p style="font-size: 16px; color: #667eea;"><strong>Tổng lương hiện tại:</strong> ${formatCurrency(salary.total_salary)}</p>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="editSalaryForm" class="btn btn-primary">💾 Cập nhật</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.updateSalary = async function(event, id) {
  event.preventDefault();
  
  try {
    const data = {
      base_salary: parseFloat(document.getElementById('editBaseSalary').value),
      overtime_hours: parseFloat(document.getElementById('editOvertimeHours').value) || 0,
      overtime_pay: parseFloat(document.getElementById('editOvertimePay').value) || 0,
      notes: document.getElementById('editNotes').value
    };
    
    await apiCall(`/salaries/${id}/update-details`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    alert('Đã cập nhật bản lương!');
    closeModal();
    await loadSalaries();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.deleteSalary = async function(id) {
  if (!confirm('Xóa bản lương này? Hành động không thể hoàn tác!')) return;
  
  try {
    await apiCall(`/salaries/${id}`, { method: 'DELETE' });
    alert('Đã xóa!');
    await loadSalaries();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// ===== VIEW SALARY DETAIL =====

window.viewSalaryDetail = async function(salaryId) {
  try {
    const salary = await apiCall(`/salaries/${salaryId}`);
    
    // Get bonuses and penalties for this month
    const bonuses = await apiCall(`/bonuses-penalties?month=${salary.salary_month}&driver_id=${salary.driver_id}`);
    
    // Get completed orders for this month
    const orders = await apiCall(`/orders?driver_id=${salary.driver_id}&status=completed`);
    const monthOrders = orders.filter(o => {
      if (!o.delivery_date) return false;
      const orderMonth = o.delivery_date.substring(0, 7);
      return orderMonth === salary.salary_month;
    });
    
    let modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal modal-large" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>📊 Chi tiết lương tháng ${salary.salary_month}</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="info-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0;">👤 ${salary.driver_name}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
                <div>
                  <p style="margin: 5px 0; opacity: 0.9;">Lương cơ bản</p>
                  <h4 style="margin: 5px 0;">${formatCurrency(salary.base_salary)}</h4>
                </div>
                <div>
                  <p style="margin: 5px 0; opacity: 0.9;">Số chuyến</p>
                  <h4 style="margin: 5px 0;">${salary.trip_count}</h4>
                </div>
                <div>
                  <p style="margin: 5px 0; opacity: 0.9;">Trạng thái</p>
                  <h4 style="margin: 5px 0;">${getSalaryStatusBadge(salary.status)}</h4>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div class="detail-section">
                <h4>📦 Chuyến hàng hoàn thành (${monthOrders.length})</h4>
                ${monthOrders.length > 0 ? `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Mã đơn</th>
                        <th>Ngày</th>
                        <th>Khách hàng</th>
                        <th>Giá trị</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${monthOrders.map(o => `
                        <tr>
                          <td>${o.order_code}</td>
                          <td>${formatDate(o.delivery_date)}</td>
                          <td>${o.customer_name}</td>
                          <td>${formatCurrency(o.final_amount)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : '<p class="no-data">Không có chuyến nào</p>'}
              </div>

              <div class="detail-section">
                <h4>⭐ Thưởng/Phạt (${bonuses.length})</h4>
                ${bonuses.length > 0 ? `
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Loại</th>
                        <th>Số tiền</th>
                        <th>Lý do</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bonuses.map(b => `
                        <tr>
                          <td>${formatDate(b.date)}</td>
                          <td>${b.type === 'bonus' ? '<span class="badge badge-active">Thưởng</span>' : '<span class="badge badge-pending">Phạt</span>'}</td>
                          <td class="${b.type === 'bonus' ? 'text-success' : 'text-danger'}">${formatCurrency(b.amount)}</td>
                          <td>${b.reason}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : '<p class="no-data">Không có thưởng/phạt</p>'}
              </div>
            </div>

            <div class="info-box" style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
              <h4 style="margin-top: 0;">💰 Tổng kết</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0;">Lương cơ bản:</td>
                  <td style="text-align: right; font-weight: bold;">${formatCurrency(salary.base_salary)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #2e7d32;">+ Thưởng:</td>
                  <td style="text-align: right; font-weight: bold; color: #2e7d32;">${formatCurrency(salary.trip_bonus)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #c62828;">- Phạt:</td>
                  <td style="text-align: right; font-weight: bold; color: #c62828;">${formatCurrency(salary.deductions)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #f57c00;">- Tạm ứng trừ:</td>
                  <td style="text-align: right; font-weight: bold; color: #f57c00;">${formatCurrency(salary.advances_deducted)}</td>
                </tr>
                <tr style="border-top: 2px solid #667eea;">
                  <td style="padding: 12px 0; font-size: 18px;"><strong>Tổng lương:</strong></td>
                  <td style="text-align: right; font-size: 20px; font-weight: bold; color: #667eea;">${formatCurrency(salary.total_salary)}</td>
                </tr>
              </table>
            </div>

            ${salary.notes ? `
              <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                <strong>📝 Ghi chú:</strong> ${salary.notes}
              </div>
            ` : ''}
            
            ${bonuses.length > 0 && (salary.trip_bonus === 0 || salary.deductions === 0) ? `
              <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0 0 10px 0;"><strong>⚠️ Cảnh báo:</strong> Có thưởng/phạt nhưng chưa được tính vào bản lương!</p>
                <button class="btn btn-warning" onclick="recalculateSalary(${salaryId})">🔄 Tính lại bản lương</button>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
            ${salary.status === 'draft' ? `
              <button class="btn btn-warning" onclick="recalculateSalary(${salaryId})">🔄 Tính lại</button>
            ` : ''}
            <button class="btn btn-primary" onclick="exportSalaryDetailPDF(${salaryId})">📄 Export PDF</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// ===== EXPORT EXCEL =====

window.exportSalariesExcel = async function() {
  try {
    const month = document.getElementById('filterSalaryMonth')?.value;
    const driver_id = document.getElementById('filterSalaryDriver')?.value;
    
    let url = '/salaries?';
    if (month) url += `month=${month}&`;
    if (driver_id) url += `driver_id=${driver_id}&`;
    
    const salaries = await apiCall(url);
    
    if (!salaries || salaries.length === 0) {
      alert('Không có dữ liệu để export');
      return;
    }
    
    // Create Excel-compatible HTML table
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          th { background-color: #667eea; color: white; font-weight: bold; }
          .number { text-align: right; }
        </style>
      </head>
      <body>
        <h2>BẢNG LƯƠNG TÀI XẾ ${month ? `- THÁNG ${month}` : ''}</h2>
        <p>Ngày xuất: ${formatDate(new Date().toISOString())}</p>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tháng</th>
              <th>Tài xế</th>
              <th>Lương cơ bản (VNĐ)</th>
              <th>Số chuyến</th>
              <th>Thưởng (VNĐ)</th>
              <th>Phạt (VNĐ)</th>
              <th>Tạm ứng trừ (VNĐ)</th>
              <th>Tổng lương (VNĐ)</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let totalBaseSalary = 0;
    let totalBonus = 0;
    let totalPenalty = 0;
    let totalAdvance = 0;
    let totalSalary = 0;
    
    salaries.forEach((s, index) => {
      totalBaseSalary += s.base_salary || 0;
      totalBonus += s.trip_bonus || 0;
      totalPenalty += s.deductions || 0;
      totalAdvance += s.advances_deducted || 0;
      totalSalary += s.total_salary || 0;
      
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${s.salary_month}</td>
          <td>${s.driver_name}</td>
          <td class="number">${(s.base_salary || 0).toLocaleString('vi-VN')}</td>
          <td class="number">${s.trip_count}</td>
          <td class="number">${(s.trip_bonus || 0).toLocaleString('vi-VN')}</td>
          <td class="number">${(s.deductions || 0).toLocaleString('vi-VN')}</td>
          <td class="number">${(s.advances_deducted || 0).toLocaleString('vi-VN')}</td>
          <td class="number"><strong>${(s.total_salary || 0).toLocaleString('vi-VN')}</strong></td>
          <td>${s.status === 'draft' ? 'Nháp' : s.status === 'approved' ? 'Đã duyệt' : 'Đã trả'}</td>
        </tr>
      `;
    });
    
    html += `
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td colspan="3">TỔNG CỘNG</td>
              <td class="number">${totalBaseSalary.toLocaleString('vi-VN')}</td>
              <td></td>
              <td class="number">${totalBonus.toLocaleString('vi-VN')}</td>
              <td class="number">${totalPenalty.toLocaleString('vi-VN')}</td>
              <td class="number">${totalAdvance.toLocaleString('vi-VN')}</td>
              <td class="number">${totalSalary.toLocaleString('vi-VN')}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    // Create blob and download
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Luong_TaiXe_${month || 'TatCa'}_${new Date().getTime()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
    
    alert('✅ Đã export file Excel thành công!');
  } catch (error) {
    alert('Lỗi export: ' + error.message);
  }
};

window.exportSalaryDetailPDF = function(salaryId) {
  alert('Chức năng export PDF đang được phát triển. Hiện tại bạn có thể dùng Ctrl+P để in hoặc lưu PDF.');
};

// ===== RECALCULATE SALARY =====

window.recalculateSalary = async function(salaryId) {
  if (!confirm('Tính lại bản lương này? Hệ thống sẽ cập nhật lại thưởng/phạt từ dữ liệu hiện tại.')) return;
  
  try {
    // Get current salary
    const salary = await apiCall(`/salaries/${salaryId}`);
    
    // Recalculate using the same logic as calculate endpoint
    const result = await apiCall('/salaries/calculate', {
      method: 'POST',
      body: JSON.stringify({
        driver_id: salary.driver_id,
        salary_month: salary.salary_month,
        base_salary: salary.base_salary
      })
    });
    
    // Update the salary record
    await apiCall(`/salaries/${salaryId}`, {
      method: 'PUT',
      body: JSON.stringify({
        trip_count: result.trip_count,
        trip_bonus: result.trip_bonus,
        deductions: result.deductions,
        advances_deducted: result.advances_deducted,
        total_salary: result.total_salary
      })
    });
    
    alert(`✅ Đã tính lại bản lương!\n\nThưởng: ${formatCurrency(result.trip_bonus)}\nPhạt: ${formatCurrency(result.deductions)}\nTổng lương mới: ${formatCurrency(result.total_salary)}`);
    
    closeModal();
    await loadSalaries();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// ===== BONUSES & PENALTIES =====

async function loadBonusesPenalties() {
  try {
    const month = document.getElementById('filterSalaryMonth')?.value;
    const driver_id = document.getElementById('filterSalaryDriver')?.value;
    
    let url = '/bonuses-penalties?';
    if (month) url += `month=${month}&`;
    if (driver_id) url += `driver_id=${driver_id}&`;
    
    const records = await apiCall(url);
    
    const content = document.getElementById('bonuses-content');
    if (!records || records.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có thưởng/phạt nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Tài xế</th>
            <th>Loại</th>
            <th>Lý do</th>
            <th>Số tiền</th>
            <th>Đơn hàng</th>
            <th>Người duyệt</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${formatDate(r.date)}</td>
              <td>${r.driver_name}</td>
              <td>${r.type === 'bonus' ? '<span class="badge badge-active">Thưởng</span>' : '<span class="badge badge-pending">Phạt</span>'}</td>
              <td>${r.reason}</td>
              <td class="${r.type === 'bonus' ? 'text-success' : 'text-danger'}">${formatCurrency(r.amount)}</td>
              <td>${r.order_code || '-'}</td>
              <td>${r.approved_by_name || '-'}</td>
              <td class="actions">
                ${currentUser.role === 'admin' ? `
                  <button class="btn btn-sm btn-danger" onclick="deleteBonusPenalty(${r.id})">Xóa</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
  }
}

window.showBonusPenaltyModal = async function() {
  try {
    const drivers = await apiCall('/drivers');
    const orders = await apiCall('/orders?status=completed');

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>⭐ Thưởng/Phạt Tài Xế</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="bonusPenaltyForm" class="modal-body" onsubmit="saveBonusPenalty(event)">
            <div class="form-row">
              <div class="form-group">
                <label>Tài xế *</label>
                <select id="bpDriver" required>
                  <option value="">-- Chọn tài xế --</option>
                  ${drivers.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Loại *</label>
                <select id="bpType" required>
                  <option value="bonus">✅ Thưởng</option>
                  <option value="penalty">⛔ Phạt</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Ngày *</label>
                <input type="date" id="bpDate" value="${new Date().toISOString().substring(0, 10)}" required>
              </div>
              <div class="form-group">
                <label>Số tiền (VNĐ) *</label>
                <input type="number" id="bpAmount" required placeholder="Nhập số tiền">
              </div>
            </div>
            <div class="form-group">
              <label>Lý do *</label>
              <textarea id="bpReason" rows="3" required placeholder="Mô tả lý do thưởng/phạt"></textarea>
            </div>
            <div class="form-group">
              <label>Đơn hàng liên quan (tùy chọn)</label>
              <select id="bpOrder">
                <option value="">-- Không liên kết --</option>
                ${orders.map(o => `<option value="${o.id}">${o.order_code} - ${o.customer_name}</option>`).join('')}
              </select>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="bonusPenaltyForm" class="btn btn-primary">Lưu</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.saveBonusPenalty = async function(event) {
  event.preventDefault();
  
  try {
    const data = {
      driver_id: document.getElementById('bpDriver').value,
      type: document.getElementById('bpType').value,
      date: document.getElementById('bpDate').value,
      amount: parseFloat(document.getElementById('bpAmount').value),
      reason: document.getElementById('bpReason').value,
      order_id: document.getElementById('bpOrder').value || null
    };

    await apiCall('/bonuses-penalties', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('Đã lưu thành công!');
    closeModal();
    await loadBonusesPenalties();
    
    // Auto-update related salary if exists
    await autoUpdateRelatedSalary(data.driver_id, data.date);
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.deleteBonusPenalty = async function(id) {
  if (!confirm('Xóa bản ghi này?')) return;
  
  try {
    // Get bonus info before deleting
    const bonuses = await apiCall('/bonuses-penalties');
    const bonus = bonuses.find(b => b.id === id);
    
    await apiCall(`/bonuses-penalties/${id}`, { method: 'DELETE' });
    alert('Đã xóa!');
    await loadBonusesPenalties();
    
    // Auto-update related salary if exists
    if (bonus) {
      await autoUpdateRelatedSalary(bonus.driver_id, bonus.date);
    }
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// Auto-update salary when bonus/penalty changes
async function autoUpdateRelatedSalary(driver_id, date) {
  try {
    const month = date.substring(0, 7); // Extract YYYY-MM
    
    // Check if salary exists for this month
    const salaries = await apiCall(`/salaries?month=${month}&driver_id=${driver_id}`);
    
    if (salaries && salaries.length > 0) {
      const salary = salaries[0];
      
      // Only auto-update if status is draft
      if (salary.status === 'draft') {
        // Recalculate
        const result = await apiCall('/salaries/calculate', {
          method: 'POST',
          body: JSON.stringify({
            driver_id: salary.driver_id,
            salary_month: salary.salary_month,
            base_salary: salary.base_salary
          })
        });
        
        // Update
        await apiCall(`/salaries/${salary.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            trip_count: result.trip_count,
            trip_bonus: result.trip_bonus,
            deductions: result.deductions,
            advances_deducted: result.advances_deducted,
            total_salary: result.total_salary
          })
        });
        
        console.log(`✅ Auto-updated salary #${salary.id} for month ${month}`);
        await loadSalaries(); // Refresh the salary list
      }
    }
  } catch (error) {
    console.error('Error auto-updating salary:', error);
    // Don't show alert, just log the error
  }
}

// ==================== PHASE 1: VEHICLE MAINTENANCE ====================

window.renderMaintenance = async function renderMaintenance(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>🔧 Quản lý Bảo dưỡng Xe</h1>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="showMaintenanceModal()">
          ➕ Thêm bảo dưỡng
        </button>
        <button class="btn btn-secondary" onclick="showVehicleFeeModal()">
          💰 Thêm phí xe
        </button>
      </div>
    </div>

    <div class="alert-container" id="maintenanceAlerts"></div>

    <div class="filter-bar">
      <select id="filterMaintenanceVehicle" onchange="filterMaintenance()">
        <option value="">-- Tất cả xe --</option>
      </select>
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="maintenance">Lịch sử bảo dưỡng</button>
      <button class="tab-btn" data-tab="fees">Phí xe (Đăng kiểm/Bảo hiểm)</button>
    </div>

    <div class="tab-content active" id="maintenance-content"></div>
    <div class="tab-content" id="fees-content"></div>
  `;

  // Setup tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      document.getElementById(`${e.target.dataset.tab}-content`).classList.add('active');
    });
  });

  // Load data
  try {
    await populateMaintenanceFilters();
    await loadMaintenanceAlerts();
    await loadMaintenance();
    await loadVehicleFees();
  } catch (error) {
    console.error('Error loading maintenance:', error);
    container.innerHTML += `<div class="alert alert-danger">Lỗi tải dữ liệu: ${error.message}</div>`;
  }
}

async function populateMaintenanceFilters() {
  try {
    const vehicles = await apiCall('/vehicles');
    const select = document.getElementById('filterMaintenanceVehicle');
    
    vehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.id;
      option.textContent = v.plate_number;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

window.filterMaintenance = async function() {
  await loadMaintenance();
}

async function loadMaintenanceAlerts() {
  try {
    const alerts = await apiCall('/alerts/vehicle-expiry');
    
    const container = document.getElementById('maintenanceAlerts');
    if (!alerts || alerts.length === 0) {
      container.innerHTML = '';
      return;
    }

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');
    const infoAlerts = alerts.filter(a => a.severity === 'info');

    let html = '';
    
    if (criticalAlerts.length > 0) {
      html += `<div class="alert alert-danger">
        <strong>⚠️ KHẨN CẤP (${criticalAlerts.length}):</strong><br>
        ${criticalAlerts.map(a => `• ${a.message}`).join('<br>')}
      </div>`;
    }
    
    if (warningAlerts.length > 0) {
      html += `<div class="alert alert-warning">
        <strong>⚠️ CẢNHBáo (${warningAlerts.length}):</strong><br>
        ${warningAlerts.map(a => `• ${a.message}`).join('<br>')}
      </div>`;
    }
    
    if (infoAlerts.length > 0) {
      html += `<div class="alert alert-info">
        <strong>ℹ️ Thông tin (${infoAlerts.length}):</strong><br>
        ${infoAlerts.map(a => `• ${a.message}`).join('<br>')}
      </div>`;
    }

    container.innerHTML = html;
  } catch (error) {
    console.error('Error:', error);
  }
}

async function loadMaintenance() {
  try {
    const vehicle_id = document.getElementById('filterMaintenanceVehicle')?.value;
    let url = '/maintenance?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}`;
    
    const records = await apiCall(url);
    
    const content = document.getElementById('maintenance-content');
    if (!records || records.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có bảo dưỡng nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Xe</th>
            <th>Loại bảo dưỡng</th>
            <th>Số km</th>
            <th>Chi phí</th>
            <th>Garage</th>
            <th>Bảo dưỡng tiếp theo</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td>${formatDate(r.maintenance_date)}</td>
              <td>${r.plate_number}</td>
              <td>${getMaintenanceTypeName(r.maintenance_type)}</td>
              <td>${r.odometer_reading ? formatNumber(r.odometer_reading) + ' km' : '-'}</td>
              <td>${formatCurrency(r.cost)}</td>
              <td>${r.garage || '-'}</td>
              <td>${r.next_due_date ? formatDate(r.next_due_date) : '-'}${r.next_due_odometer ? '<br>' + formatNumber(r.next_due_odometer) + ' km' : ''}</td>
              <td class="actions">
                <button class="btn btn-sm btn-primary" onclick="editMaintenance(${r.id})">Sửa</button>
                ${currentUser.role === 'admin' ? `
                  <button class="btn btn-sm btn-danger" onclick="deleteMaintenance(${r.id})">Xóa</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
    alert('Lỗi tải bảo dưỡng: ' + error.message);
  }
}

function getMaintenanceTypeName(type) {
  const types = {
    'oil_change': 'Thay dầu động cơ',
    'tire_replacement': 'Thay lốp',
    'brake_service': 'Bảo dưỡng phanh',
    'engine_service': 'Bảo dưỡng động cơ',
    'transmission': 'Bảo dưỡng hộp số',
    'ac_service': 'Bảo dưỡng điều hòa',
    'major_overhaul': 'Đại tu',
    'general_inspection': 'Kiểm tra tổng thể',
    'other': 'Khác'
  };
  return types[type] || type;
}

window.showMaintenanceModal = async function(maintenanceId = null) {
  try {
    const vehicles = await apiCall('/vehicles');
    let maintenance = null;
    
    if (maintenanceId) {
      const allMaintenance = await apiCall('/maintenance');
      maintenance = allMaintenance.find(m => m.id === maintenanceId);
    }

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal large" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>🔧 ${maintenanceId ? 'Sửa' : 'Thêm'} Bảo Dưỡng Xe</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="maintenanceForm" class="modal-body" onsubmit="saveMaintenance(event, ${maintenanceId})">
            <div class="form-row">
              <div class="form-group">
                <label>🚛 Xe *</label>
                <select id="maintenanceVehicle" required ${maintenanceId ? 'disabled' : ''}>
                  <option value="">-- Chọn xe --</option>
                  ${vehicles.map(v => `<option value="${v.id}" ${maintenance?.vehicle_id === v.id ? 'selected' : ''}>${v.plate_number}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>🔨 Loại bảo dưỡng *</label>
                <select id="maintenanceType" required>
                  <option value="">-- Chọn loại --</option>
                  <option value="oil_change" ${maintenance?.maintenance_type === 'oil_change' ? 'selected' : ''}>🛢️ Thay dầu động cơ</option>
                  <option value="tire_replacement" ${maintenance?.maintenance_type === 'tire_replacement' ? 'selected' : ''}>🛞 Thay lốp</option>
                  <option value="brake_service" ${maintenance?.maintenance_type === 'brake_service' ? 'selected' : ''}>🛑 Bảo dưỡng phanh</option>
                  <option value="engine_service" ${maintenance?.maintenance_type === 'engine_service' ? 'selected' : ''}>⚙️ Bảo dưỡng động cơ</option>
                  <option value="transmission" ${maintenance?.maintenance_type === 'transmission' ? 'selected' : ''}>🔩 Bảo dưỡng hộp số</option>
                  <option value="ac_service" ${maintenance?.maintenance_type === 'ac_service' ? 'selected' : ''}>❄️ Bảo dưỡng điều hòa</option>
                  <option value="major_overhaul" ${maintenance?.maintenance_type === 'major_overhaul' ? 'selected' : ''}>🔧 Đại tu</option>
                  <option value="general_inspection" ${maintenance?.maintenance_type === 'general_inspection' ? 'selected' : ''}>🔍 Kiểm tra tổng thể</option>
                  <option value="other" ${maintenance?.maintenance_type === 'other' ? 'selected' : ''}>📋 Khác</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label>📅 Ngày bảo dưỡng *</label>
                <input type="date" id="maintenanceDate" value="${maintenance?.maintenance_date || new Date().toISOString().substring(0, 10)}" required>
              </div>
              <div class="form-group">
                <label>📊 Số km đồng hồ</label>
                <input type="number" id="maintenanceOdometer" value="${maintenance?.odometer_reading || ''}" placeholder="VD: 50000">
              </div>
            </div>
            
            <div class="form-group">
              <label>💰 Chi phí (VNĐ) *</label>
              <input type="number" id="maintenanceCost" value="${maintenance?.cost || ''}" required placeholder="Nhập chi phí bảo dưỡng">
            </div>
            
            <fieldset style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0;">
              <legend style="color: #667eea; font-weight: 600;">📅 Lịch Bảo Dưỡng Tiếp Theo</legend>
              <div class="form-row">
                <div class="form-group">
                  <label>📆 Ngày dự kiến</label>
                  <input type="date" id="maintenanceNextDate" value="${maintenance?.next_due_date || ''}">
                </div>
                <div class="form-group">
                  <label>📊 Số km dự kiến</label>
                  <input type="number" id="maintenanceNextOdometer" value="${maintenance?.next_due_odometer || ''}" placeholder="VD: 55000">
                </div>
              </div>
            </fieldset>
            
            <div class="form-row">
              <div class="form-group">
                <label>🏪 Garage</label>
                <input type="text" id="maintenanceGarage" value="${maintenance?.garage || ''}" placeholder="Tên garage">
              </div>
              <div class="form-group">
                <label>📄 Số hóa đơn</label>
                <input type="text" id="maintenanceInvoice" value="${maintenance?.invoice_number || ''}" placeholder="Mã hóa đơn">
              </div>
            </div>
            
            <div class="form-group">
              <label>📝 Mô tả công việc</label>
              <textarea id="maintenanceDescription" rows="3" placeholder="Ghi chú chi tiết về công việc bảo dưỡng">${maintenance?.description || ''}</textarea>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="maintenanceForm" class="btn btn-primary">Lưu</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.saveMaintenance = async function(event, maintenanceId) {
  event.preventDefault();
  
  try {
    const data = {
      vehicle_id: document.getElementById('maintenanceVehicle').value,
      maintenance_type: document.getElementById('maintenanceType').value,
      maintenance_date: document.getElementById('maintenanceDate').value,
      odometer_reading: document.getElementById('maintenanceOdometer').value || null,
      cost: parseFloat(document.getElementById('maintenanceCost').value),
      next_due_date: document.getElementById('maintenanceNextDate').value || null,
      next_due_odometer: document.getElementById('maintenanceNextOdometer').value || null,
      garage: document.getElementById('maintenanceGarage').value,
      invoice_number: document.getElementById('maintenanceInvoice').value,
      description: document.getElementById('maintenanceDescription').value
    };

    if (maintenanceId) {
      await apiCall(`/maintenance/${maintenanceId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/maintenance', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    alert('Đã lưu thành công!');
    closeModal();
    await loadMaintenance();
    await loadMaintenanceAlerts();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.editMaintenance = function(id) {
  showMaintenanceModal(id);
};

window.deleteMaintenance = async function(id) {
  if (!confirm('Xóa bảo dưỡng này?')) return;
  
  try {
    await apiCall(`/maintenance/${id}`, { method: 'DELETE' });
    alert('Đã xóa!');
    await loadMaintenance();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

// ===== VEHICLE FEES =====

async function loadVehicleFees() {
  try {
    const vehicle_id = document.getElementById('filterMaintenanceVehicle')?.value;
    let url = '/vehicle-fees?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}`;
    
    const fees = await apiCall(url);
    
    const content = document.getElementById('fees-content');
    if (!fees || fees.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có phí xe nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Xe</th>
            <th>Loại phí</th>
            <th>Số tiền</th>
            <th>Ngày đóng</th>
            <th>Hiệu lực</th>
            <th>Hết hạn</th>
            <th>Số biên nhận</th>
          </tr>
        </thead>
        <tbody>
          ${fees.map(f => `
            <tr>
              <td>${f.plate_number}</td>
              <td>${getFeeTypeName(f.fee_type)}</td>
              <td>${formatCurrency(f.amount)}</td>
              <td>${formatDate(f.paid_date)}</td>
              <td>${f.valid_from ? formatDate(f.valid_from) : '-'}</td>
              <td>${f.valid_to ? formatDate(f.valid_to) : '-'}</td>
              <td>${f.receipt_number || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
  }
}

function getFeeTypeName(type) {
  const types = {
    'registration': 'Đăng kiểm',
    'inspection': 'Kiểm định',
    'insurance': 'Bảo hiểm',
    'road_tax': 'Thuế đường bộ',
    'other': 'Khác'
  };
  return types[type] || type;
}

window.showVehicleFeeModal = async function() {
  try {
    const vehicles = await apiCall('/vehicles');

    const modal = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2>💰 Thêm Phí Xe</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
          </div>
          <form id="vehicleFeeForm" class="modal-body" onsubmit="saveVehicleFee(event)">
            <div class="form-group">
              <label>🚛 Xe *</label>
              <select id="feeVehicle" required>
                <option value="">-- Chọn xe --</option>
                ${vehicles.map(v => `<option value="${v.id}">${v.plate_number}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>📋 Loại phí *</label>
              <select id="feeType" required>
                <option value="">-- Chọn loại --</option>
                <option value="registration">📜 Đăng kiểm</option>
                <option value="inspection">🔍 Kiểm định</option>
                <option value="insurance">🛡️ Bảo hiểm</option>
                <option value="road_tax">🛣️ Thuế đường bộ</option>
                <option value="other">📌 Khác</option>
              </select>
            </div>
            <div class="form-group">
              <label>💵 Số tiền (VNĐ) *</label>
              <input type="number" id="feeAmount" required placeholder="Nhập số tiền">
            </div>
            <div class="form-group">
              <label>📅 Ngày đóng *</label>
              <input type="date" id="feePaidDate" value="${new Date().toISOString().substring(0, 10)}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>📆 Hiệu lực từ</label>
                <input type="date" id="feeValidFrom">
              </div>
              <div class="form-group">
                <label>📆 Hết hạn</label>
                <input type="date" id="feeValidTo">
              </div>
            </div>
            <div class="form-group">
              <label>🧾 Số biên nhận</label>
              <input type="text" id="feeReceipt" placeholder="Mã biên nhận">
            </div>
            <div class="form-group">
              <label>📝 Ghi chú</label>
              <textarea id="feeNotes" rows="3" placeholder="Ghi chú thêm (nếu có)"></textarea>
            </div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
            <button type="submit" form="vehicleFeeForm" class="btn btn-primary">Lưu</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modalContainer').innerHTML = modal;
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
}

window.saveVehicleFee = async function(event) {
  event.preventDefault();
  
  try {
    const data = {
      vehicle_id: document.getElementById('feeVehicle').value,
      fee_type: document.getElementById('feeType').value,
      amount: parseFloat(document.getElementById('feeAmount').value),
      paid_date: document.getElementById('feePaidDate').value,
      valid_from: document.getElementById('feeValidFrom').value || null,
      valid_to: document.getElementById('feeValidTo').value || null,
      receipt_number: document.getElementById('feeReceipt').value,
      notes: document.getElementById('feeNotes').value
    };

    await apiCall('/vehicle-fees', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('Đã lưu thành công!');
    closeModal();
    await loadVehicleFees();
    await loadMaintenanceAlerts();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};
