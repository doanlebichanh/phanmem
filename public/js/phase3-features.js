// ================================================
// PHASE 2.3 & PHASE 3 FEATURES  
// ================================================

// ===== PHASE 2.3: BÁO CÁO CHI PHÍ VẬN HÀNH =====

window.renderExpenseReports = async function(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>📊 Báo Cáo Chi Phí Vận Hành</h1>
      <button class="btn btn-primary" onclick="exportExpenseReport()">
        <span>📥</span> Xuất Excel
      </button>
    </div>

    <div class="filters-section">
      <div class="filters">
        <div class="filter-group">
          <label>Xe</label>
          <select id="filterExpenseVehicle">
            <option value="">Tất cả</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Từ tháng</label>
          <input type="month" id="filterExpenseFrom">
        </div>
        <div class="filter-group">
          <label>Đến tháng</label>
          <input type="month" id="filterExpenseTo">
        </div>
        <button class="btn btn-secondary" onclick="loadExpenseReport()">Xem báo cáo</button>
      </div>
    </div>

    <div id="expenseReportContent"></div>
  `;

  await populateExpenseFilters();
  await loadExpenseReport();
};

async function populateExpenseFilters() {
  try {
    const vehicles = await apiCall('/vehicles');
    const vehicleSelect = document.getElementById('filterExpenseVehicle');
    
    vehicles.forEach(v => {
      const option = document.createElement('option');
      option.value = v.id;
      option.textContent = v.plate_number;
      vehicleSelect.appendChild(option);
    });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const fromMonth = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
    
    document.getElementById('filterExpenseFrom').value = fromMonth;
    document.getElementById('filterExpenseTo').value = currentMonth;
  } catch (error) {
    console.error('Error:', error);
  }
}

window.loadExpenseReport = async function() {
  try {
    const vehicle_id = document.getElementById('filterExpenseVehicle')?.value;
    const from = document.getElementById('filterExpenseFrom')?.value;
    const to = document.getElementById('filterExpenseTo')?.value;
    
    let url = '/expense-reports?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}&`;
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}&`;
    
    const report = await apiCall(url);
    
    const content = document.getElementById('expenseReportContent');
    
    if (!report || report.length === 0) {
      content.innerHTML = '<p class="no-data">Không có dữ liệu trong khoảng thời gian này</p>';
      return;
    }

    const totalExpenses = report.reduce((sum, r) => sum + (r.total_expenses || 0), 0);
    
    content.innerHTML = `
      <div class="stats-summary">
        <div class="stat-box stat-danger">
          <h3>💰 Tổng Chi Phí</h3>
          <p class="stat-value">${formatCurrency(totalExpenses)}</p>
        </div>
        <div class="stat-box stat-info">
          <h3>⛽ Nhiên liệu</h3>
          <p class="stat-value">${formatCurrency(report.reduce((sum, r) => sum + (r.fuel_cost || 0), 0))}</p>
        </div>
        <div class="stat-box stat-warning">
          <h3>🔧 Bảo dưỡng</h3>
          <p class="stat-value">${formatCurrency(report.reduce((sum, r) => sum + (r.maintenance_cost || 0), 0))}</p>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Xe</th>
            <th>Nhiên liệu</th>
            <th>Bảo dưỡng</th>
            <th>Phí xe</th>
            <th>Lương TX</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          ${report.map(r => `
            <tr>
              <td><strong>${r.plate_number || 'Chung'}</strong></td>
              <td class="text-right">${formatCurrency(r.fuel_cost || 0)}</td>
              <td class="text-right">${formatCurrency(r.maintenance_cost || 0)}</td>
              <td class="text-right">${formatCurrency(r.fee_cost || 0)}</td>
              <td class="text-right">${formatCurrency(r.salary_cost || 0)}</td>
              <td class="text-right"><strong>${formatCurrency(r.total_expenses || 0)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <th>TỔNG CỘNG</th>
            <th class="text-right">${formatCurrency(report.reduce((sum, r) => sum + (r.fuel_cost || 0), 0))}</th>
            <th class="text-right">${formatCurrency(report.reduce((sum, r) => sum + (r.maintenance_cost || 0), 0))}</th>
            <th class="text-right">${formatCurrency(report.reduce((sum, r) => sum + (r.fee_cost || 0), 0))}</th>
            <th class="text-right">${formatCurrency(report.reduce((sum, r) => sum + (r.salary_cost || 0), 0))}</th>
            <th class="text-right"><strong>${formatCurrency(totalExpenses)}</strong></th>
          </tr>
        </tfoot>
      </table>
    `;
  } catch (error) {
    console.error('Error:', error);
    alert('Lỗi tải báo cáo: ' + error.message);
  }
};

// Export expense report to Excel
window.exportExpenseReport = async function() {
  try {
    const vehicle_id = document.getElementById('filterExpenseVehicle')?.value || '';
    const from = document.getElementById('filterExpenseFrom')?.value || '';
    const to = document.getElementById('filterExpenseTo')?.value || '';
    
    let url = '/export/expense-reports?';
    if (vehicle_id) url += `vehicle_id=${vehicle_id}&`;
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
    a.download = `BaoCaoChiPhiVanHanh_${from || 'Dau'}_${to || 'Cuoi'}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
    
    alert('Đã xuất báo cáo chi phí thành công!');
  } catch (error) {
    console.error('Export error:', error);
    alert('Lỗi xuất báo cáo: ' + error.message);
  }
};

// ===== PHASE 3.1: CRM & BÁO GIÁ =====

window.renderCRM = async function(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>👔 CRM & Báo Giá</h1>
      <div>
        <button class="btn btn-secondary" onclick="showCustomerModal()">
          <span>➕</span> Thêm Khách Hàng
        </button>
        <button class="btn btn-primary" onclick="showQuoteModal()">
          <span>📄</span> Tạo Báo Giá
        </button>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('customers-list', this)">👥 Khách Hàng</button>
      <button class="tab-btn" onclick="switchTab('quotes-list', this)">📄 Báo Giá</button>
    </div>

    <div id="customers-list" class="tab-content active"></div>
    <div id="quotes-list" class="tab-content"></div>
  `;

  await loadCustomers();
  await loadQuotes();
};

async function loadCustomers() {
  try {
    const customers = await apiCall('/customers');
    
    const content = document.getElementById('customers-list');
    if (!customers || customers.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có khách hàng nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Công ty</th>
            <th>Mã số thuế</th>
            <th>Người liên hệ</th>
            <th>Điện thoại</th>
            <th>Email</th>
            <th>Loại</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => `
            <tr>
              <td><strong>${c.company_name}</strong></td>
              <td>${c.tax_code || '-'}</td>
              <td>${c.contact_person || '-'}</td>
              <td>${c.phone || '-'}</td>
              <td>${c.email || '-'}</td>
              <td>${c.customer_type === 'corporate' ? '🏢 Công ty' : '👤 Cá nhân'}</td>
              <td>
                <span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-cancelled'}">
                  ${c.status === 'active' ? 'Hoạt động' : 'Ngưng'}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-info" onclick="editCustomer(${c.id})" title="Sửa">✏️</button>
                <button class="btn btn-sm btn-success" onclick="createQuoteForCustomer(${c.id})" title="Báo giá">📄</button>
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

async function loadQuotes() {
  try {
    const quotes = await apiCall('/quotes');
    
    const content = document.getElementById('quotes-list');
    if (!quotes || quotes.length === 0) {
      content.innerHTML = '<p class="no-data">Chưa có báo giá nào</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Số BG</th>
            <th>Ngày</th>
            <th>Khách hàng</th>
            <th>Tuyến</th>
            <th>Giá trị</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${quotes.map(q => `
            <tr>
              <td><strong>${q.quote_number}</strong></td>
              <td>${formatDate(q.quote_date)}</td>
              <td>${q.company_name}</td>
              <td>${q.route_from} → ${q.route_to}</td>
              <td class="text-right"><strong>${formatCurrency(q.final_amount)}</strong></td>
              <td>
                <span class="badge ${getQuoteStatusBadge(q.status)}">
                  ${getQuoteStatusText(q.status)}
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-sm btn-info" onclick="viewQuote(${q.id})" title="Xem">👁️</button>
                ${q.status === 'approved' && !q.converted_order_id ? `
                  <button class="btn btn-sm btn-success" onclick="convertQuoteToOrder(${q.id})" title="Chuyển đơn">✅</button>
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

function getQuoteStatusBadge(status) {
  const badges = {
    'draft': 'badge-pending',
    'sent': 'badge-active',
    'approved': 'badge-completed',
    'rejected': 'badge-cancelled',
    'expired': 'badge-cancelled'
  };
  return badges[status] || 'badge-pending';
}

function getQuoteStatusText(status) {
  const texts = {
    'draft': 'Nháp',
    'sent': 'Đã gửi',
    'approved': 'Đã duyệt',
    'rejected': 'Từ chối',
    'expired': 'Hết hạn'
  };
  return texts[status] || status;
}

window.showCustomerModal = async function(customerId = null) {
  let customer = null;
  if (customerId) {
    customer = await apiCall(`/customers/${customerId}`);
  }

  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>👔 ${customerId ? 'Sửa' : 'Thêm'} Khách Hàng</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="customerForm" class="modal-body" onsubmit="saveCustomer(event, ${customerId})">
          <div class="form-row">
            <div class="form-group">
              <label>🏢 Tên công ty *</label>
              <input type="text" id="customerCompany" value="${customer?.company_name || ''}" required>
            </div>
            <div class="form-group">
              <label>🔢 Mã số thuế</label>
              <input type="text" id="customerTax" value="${customer?.tax_code || ''}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>👤 Người liên hệ</label>
              <input type="text" id="customerContact" value="${customer?.contact_person || ''}">
            </div>
            <div class="form-group">
              <label>📞 Điện thoại</label>
              <input type="text" id="customerPhone" value="${customer?.phone || ''}">
            </div>
          </div>

          <div class="form-group">
            <label>📧 Email</label>
            <input type="email" id="customerEmail" value="${customer?.email || ''}">
          </div>

          <div class="form-group">
            <label>🏠 Địa chỉ</label>
            <textarea id="customerAddress" rows="2">${customer?.address || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>💼 Loại khách hàng</label>
              <select id="customerType">
                <option value="individual" ${customer?.customer_type === 'individual' ? 'selected' : ''}>Cá nhân</option>
                <option value="corporate" ${customer?.customer_type === 'corporate' ? 'selected' : ''}>Công ty</option>
              </select>
            </div>
            <div class="form-group">
              <label>📊 Trạng thái</label>
              <select id="customerStatus">
                <option value="active" ${customer?.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                <option value="inactive" ${customer?.status === 'inactive' ? 'selected' : ''}>Ngưng</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>📝 Ghi chú</label>
            <textarea id="customerNotes" rows="2">${customer?.notes || ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="customerForm" class="btn btn-primary">💾 Lưu</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modal;
};

window.saveCustomer = async function(event, customerId) {
  event.preventDefault();
  
  try {
    const data = {
      company_name: document.getElementById('customerCompany').value,
      tax_code: document.getElementById('customerTax').value,
      contact_person: document.getElementById('customerContact').value,
      phone: document.getElementById('customerPhone').value,
      email: document.getElementById('customerEmail').value,
      address: document.getElementById('customerAddress').value,
      customer_type: document.getElementById('customerType').value,
      status: document.getElementById('customerStatus').value,
      notes: document.getElementById('customerNotes').value
    };

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

    alert('Đã lưu thành công!');
    closeModal();
    await loadCustomers();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.editCustomer = function(id) {
  showCustomerModal(id);
};

window.showQuoteModal = async function(quoteId = null, preSelectedCustomerId = null) {
  const customers = await apiCall('/customers?status=active');
  let quote = null;
  
  if (quoteId) {
    quote = await apiCall(`/quotes/${quoteId}`);
  }

  const quoteNumber = quote?.quote_number || `BG${new Date().getFullYear()}${String(Date.now()).slice(-6)}`;

  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal large" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>📄 ${quoteId ? 'Sửa' : 'Tạo'} Báo Giá</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <form id="quoteForm" class="modal-body" onsubmit="saveQuote(event, ${quoteId})">
          <div class="form-row">
            <div class="form-group">
              <label>📋 Số báo giá</label>
              <input type="text" id="quoteNumber" value="${quoteNumber}" readonly style="background: #f5f5f5;">
            </div>
            <div class="form-group">
              <label>👔 Khách hàng *</label>
              <select id="quoteCustomer" required>
                <option value="">-- Chọn khách hàng --</option>
                ${customers.map(c => `
                  <option value="${c.id}" ${(quote?.customer_id === c.id || preSelectedCustomerId === c.id) ? 'selected' : ''}>
                    ${c.company_name}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>📅 Ngày báo giá *</label>
              <input type="date" id="quoteDate" value="${quote?.quote_date || new Date().toISOString().substring(0, 10)}" required>
            </div>
            <div class="form-group">
              <label>⏰ Hiệu lực đến</label>
              <input type="date" id="quoteValidUntil" value="${quote?.valid_until || ''}">
            </div>
          </div>

          <fieldset style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0;">
            <legend style="color: #667eea; font-weight: 600;">🗺️ Thông Tin Vận Chuyển</legend>
            <div class="form-row">
              <div class="form-group">
                <label>📍 Điểm đi *</label>
                <input type="text" id="quoteFrom" value="${quote?.route_from || ''}" required>
              </div>
              <div class="form-group">
                <label>📍 Điểm đến *</label>
                <input type="text" id="quoteTo" value="${quote?.route_to || ''}" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>📦 Loại container</label>
                <select id="quoteContainerType">
                  <option value="">-- Chọn loại --</option>
                  <option value="20ft" ${quote?.container_type === '20ft' ? 'selected' : ''}>20ft</option>
                  <option value="40ft" ${quote?.container_type === '40ft' ? 'selected' : ''}>40ft</option>
                  <option value="40hc" ${quote?.container_type === '40hc' ? 'selected' : ''}>40HC</option>
                </select>
              </div>
              <div class="form-group">
                <label>📊 Số lượng</label>
                <input type="number" id="quoteQuantity" value="${quote?.quantity || 1}" min="1" oninput="calculateQuoteTotal()">
              </div>
            </div>

            <div class="form-group">
              <label>📝 Mô tả hàng hóa</label>
              <textarea id="quoteCargo" rows="2">${quote?.cargo_description || ''}</textarea>
            </div>
          </fieldset>

          <fieldset style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0;">
            <legend style="color: #667eea; font-weight: 600;">💰 Giá Cả</legend>
            <div class="form-row">
              <div class="form-group">
                <label>💵 Đơn giá *</label>
                <input type="number" id="quoteUnitPrice" value="${quote?.unit_price || ''}" required oninput="calculateQuoteTotal()">
              </div>
              <div class="form-group">
                <label>💰 Thành tiền</label>
                <input type="number" id="quoteTotalAmount" value="${quote?.total_amount || ''}" readonly style="background: #f5f5f5;">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>🎁 Giảm giá</label>
                <input type="number" id="quoteDiscount" value="${quote?.discount_amount || 0}" oninput="calculateQuoteTotal()">
              </div>
              <div class="form-group">
                <label>📊 Thuế VAT (%)</label>
                <input type="number" id="quoteTaxPercent" value="10" step="0.1" oninput="calculateQuoteTotal()">
              </div>
            </div>

            <div class="form-group">
              <label>💎 Tổng cuối cùng</label>
              <input type="number" id="quoteFinalAmount" value="${quote?.final_amount || ''}" readonly style="background: #f0f9ff; font-size: 18px; font-weight: bold;">
            </div>
          </fieldset>

          <div class="form-group">
            <label>📝 Ghi chú</label>
            <textarea id="quoteNotes" rows="2">${quote?.notes || ''}</textarea>
          </div>
        </form>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Hủy</button>
          <button type="submit" form="quoteForm" class="btn btn-primary">💾 Lưu báo giá</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modal;
  
  if (quote) {
    calculateQuoteTotal();
  }
};

window.calculateQuoteTotal = function() {
  const quantity = parseFloat(document.getElementById('quoteQuantity').value) || 1;
  const unitPrice = parseFloat(document.getElementById('quoteUnitPrice').value) || 0;
  const discount = parseFloat(document.getElementById('quoteDiscount').value) || 0;
  const taxPercent = parseFloat(document.getElementById('quoteTaxPercent').value) || 0;
  
  const totalAmount = quantity * unitPrice;
  const afterDiscount = totalAmount - discount;
  const taxAmount = afterDiscount * (taxPercent / 100);
  const finalAmount = afterDiscount + taxAmount;
  
  document.getElementById('quoteTotalAmount').value = totalAmount;
  document.getElementById('quoteFinalAmount').value = finalAmount;
};

window.saveQuote = async function(event, quoteId) {
  event.preventDefault();
  
  try {
    const quantity = parseFloat(document.getElementById('quoteQuantity').value) || 1;
    const unitPrice = parseFloat(document.getElementById('quoteUnitPrice').value);
    const discount = parseFloat(document.getElementById('quoteDiscount').value) || 0;
    const taxPercent = parseFloat(document.getElementById('quoteTaxPercent').value) || 0;
    
    const totalAmount = quantity * unitPrice;
    const taxAmount = (totalAmount - discount) * (taxPercent / 100);
    
    const data = {
      quote_number: document.getElementById('quoteNumber').value,
      customer_id: document.getElementById('quoteCustomer').value,
      quote_date: document.getElementById('quoteDate').value,
      valid_until: document.getElementById('quoteValidUntil').value || null,
      route_from: document.getElementById('quoteFrom').value,
      route_to: document.getElementById('quoteTo').value,
      container_type: document.getElementById('quoteContainerType').value,
      cargo_description: document.getElementById('quoteCargo').value,
      quantity: quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      discount_amount: discount,
      tax_amount: taxAmount,
      final_amount: parseFloat(document.getElementById('quoteFinalAmount').value),
      notes: document.getElementById('quoteNotes').value,
      status: 'draft'
    };

    if (quoteId) {
      await apiCall(`/quotes/${quoteId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      await apiCall('/quotes', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    alert('Đã lưu báo giá!');
    closeModal();
    await loadQuotes();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.createQuoteForCustomer = function(customerId) {
  showQuoteModal(null, customerId);
};

window.viewQuote = async function(quoteId) {
  const quote = await apiCall(`/quotes/${quoteId}`);
  
  const modal = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal large" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>📄 Chi Tiết Báo Giá: ${quote.quote_number}</h2>
          <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <h3 style="text-align: center; color: #667eea; margin-bottom: 20px;">CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH</h3>
            <h4 style="text-align: center; margin-bottom: 30px;">BÁO GIÁ DỊCH VỤ VẬN CHUYỂN</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <p><strong>Số báo giá:</strong> ${quote.quote_number}</p>
                <p><strong>Ngày:</strong> ${formatDate(quote.quote_date)}</p>
                <p><strong>Hiệu lực đến:</strong> ${quote.valid_until ? formatDate(quote.valid_until) : 'Không giới hạn'}</p>
              </div>
              <div>
                <p><strong>Khách hàng:</strong> ${quote.company_name}</p>
                <p><strong>Người liên hệ:</strong> ${quote.contact_person || '-'}</p>
                <p><strong>Điện thoại:</strong> ${quote.customer_phone || '-'}</p>
              </div>
            </div>

            <div style="background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-bottom: 10px;">Thông tin vận chuyển:</h4>
              <p><strong>Điểm đi:</strong> ${quote.route_from}</p>
              <p><strong>Điểm đến:</strong> ${quote.route_to}</p>
              <p><strong>Loại container:</strong> ${quote.container_type || '-'}</p>
              <p><strong>Hàng hóa:</strong> ${quote.cargo_description || '-'}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #667eea; color: white;">
                  <th style="padding: 10px; text-align: left;">Mô tả</th>
                  <th style="padding: 10px; text-align: center;">Số lượng</th>
                  <th style="padding: 10px; text-align: right;">Đơn giá</th>
                  <th style="padding: 10px; text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd;">Vận chuyển ${quote.route_from} - ${quote.route_to}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${quote.quantity}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(quote.unit_price)}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${formatCurrency(quote.total_amount)}</td>
                </tr>
              </tbody>
            </table>

            <div style="text-align: right; margin-top: 20px;">
              <p>Tổng cộng: ${formatCurrency(quote.total_amount)}</p>
              ${quote.discount_amount > 0 ? `<p>Giảm giá: -${formatCurrency(quote.discount_amount)}</p>` : ''}
              <p>Thuế VAT: ${formatCurrency(quote.tax_amount)}</p>
              <h3 style="color: #667eea; margin-top: 10px;">Tổng thanh toán: ${formatCurrency(quote.final_amount)}</h3>
            </div>

            ${quote.notes ? `<div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
              <strong>Ghi chú:</strong> ${quote.notes}
            </div>` : ''}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center;">
              <p style="font-style: italic;">Trân trọng cảm ơn!</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Đóng</button>
          ${quote.status === 'draft' ? `
            <button class="btn btn-info" onclick="closeModal(); showQuoteModal(${quote.id})">Sửa</button>
            <button class="btn btn-success" onclick="approveQuote(${quote.id})">Duyệt & Gửi</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalContainer').innerHTML = modal;
};

window.approveQuote = async function(quoteId) {
  if (!confirm('Duyệt và gửi báo giá này cho khách hàng?')) return;
  
  try {
    await apiCall(`/quotes/${quoteId}/approve`, {
      method: 'PUT'
    });
    alert('Đã duyệt và gửi báo giá!');
    closeModal();
    await loadQuotes();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};

window.convertQuoteToOrder = async function(quoteId) {
  if (!confirm('Chuyển báo giá thành đơn hàng?')) return;
  
  try {
    const result = await apiCall(`/quotes/${quoteId}/convert`, {
      method: 'POST'
    });
    alert(`Đã tạo đơn hàng ${result.order_code}!`);
    await loadQuotes();
  } catch (error) {
    alert('Lỗi: ' + error.message);
  }
};
