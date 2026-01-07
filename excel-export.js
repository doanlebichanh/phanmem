const ExcelJS = require('exceljs');

// Định dạng tiền tệ VNĐ
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Định dạng ngày
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Style cho header
const headerStyle = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
  alignment: { vertical: 'middle', horizontal: 'center' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
};

// Style cho tiêu đề chính
const titleStyle = {
  font: { bold: true, size: 16, color: { argb: 'FF4472C4' } },
  alignment: { vertical: 'middle', horizontal: 'center' }
};

// Style cho tổng cộng
const totalStyle = {
  font: { bold: true, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } },
  alignment: { vertical: 'middle', horizontal: 'right' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  }
};

// Export báo cáo nhiên liệu
async function exportFuelReport(db, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo Cáo Nhiên Liệu');

  // Tiêu đề
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = 'BÁO CÁO CHI PHÍ NHIÊN LIỆU';
  worksheet.getCell('A1').style = titleStyle;

  // Thông tin bộ lọc
  let rowNum = 2;
  if (filters.vehicle_id) {
    worksheet.mergeCells(`A${rowNum}:J${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Xe: ${filters.vehicle_name || filters.vehicle_id}`;
    rowNum++;
  }
  if (filters.month) {
    worksheet.mergeCells(`A${rowNum}:J${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Tháng: ${filters.month}`;
    rowNum++;
  }
  
  worksheet.mergeCells(`A${rowNum}:J${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Ngày xuất: ${formatDate(new Date())}`;
  rowNum += 2;

  // Header
  const headerRow = rowNum;
  const headers = ['STT', 'Ngày', 'Xe', 'Loại nhiên liệu', 'Số lít', 'Giá/lít', 'Tổng tiền', 'Số Km', 'Trạm xăng', 'Ghi chú'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.style = headerStyle;
  });

  // Lấy dữ liệu
  let query = `
    SELECT fr.*, v.plate_number
    FROM fuel_records fr
    LEFT JOIN vehicles v ON fr.vehicle_id = v.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.vehicle_id) {
    query += ' AND fr.vehicle_id = ?';
    params.push(filters.vehicle_id);
  }
  if (filters.month) {
    query += ' AND strftime("%Y-%m", fr.fuel_date) = ?';
    params.push(filters.month);
  }

  query += ' ORDER BY fr.fuel_date DESC';

  return new Promise((resolve, reject) => {
    db.all(query, params, async (err, records) => {
      if (err) {
        reject(err);
        return;
      }

      let currentRow = headerRow + 1;
      let totalLiters = 0;
      let totalCost = 0;

      // Dữ liệu
      records.forEach((record, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = formatDate(record.fuel_date);
        worksheet.getCell(currentRow, 3).value = record.plate_number;
        worksheet.getCell(currentRow, 4).value = record.fuel_type;
        worksheet.getCell(currentRow, 5).value = record.liters;
        worksheet.getCell(currentRow, 6).value = record.price_per_liter;
        worksheet.getCell(currentRow, 7).value = record.total_cost;
        worksheet.getCell(currentRow, 8).value = record.odometer_reading || '';
        worksheet.getCell(currentRow, 9).value = record.station_name || '';
        worksheet.getCell(currentRow, 10).value = record.notes || '';

        // Format số tiền
        worksheet.getCell(currentRow, 6).numFmt = '#,##0';
        worksheet.getCell(currentRow, 7).numFmt = '#,##0';

        totalLiters += record.liters;
        totalCost += record.total_cost;

        currentRow++;
      });

      // Tổng cộng
      worksheet.getCell(currentRow, 1).value = 'TỔNG CỘNG';
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getCell(currentRow, 1).style = totalStyle;
      
      worksheet.getCell(currentRow, 5).value = totalLiters;
      worksheet.getCell(currentRow, 5).style = totalStyle;
      worksheet.getCell(currentRow, 5).numFmt = '#,##0.00';
      
      worksheet.getCell(currentRow, 6).value = '';
      worksheet.getCell(currentRow, 6).style = totalStyle;
      
      worksheet.getCell(currentRow, 7).value = totalCost;
      worksheet.getCell(currentRow, 7).style = totalStyle;
      worksheet.getCell(currentRow, 7).numFmt = '#,##0';

      // Điều chỉnh độ rộng cột
      worksheet.columns = [
        { width: 6 },   // STT
        { width: 12 },  // Ngày
        { width: 12 },  // Xe
        { width: 15 },  // Loại NL
        { width: 10 },  // Số lít
        { width: 12 },  // Giá/lít
        { width: 15 },  // Tổng tiền
        { width: 12 },  // Số Km
        { width: 20 },  // Trạm xăng
        { width: 25 }   // Ghi chú
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      resolve(buffer);
    });
  });
}

// Export báo cáo dòng tiền
async function exportCashFlowReport(db, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo Cáo Dòng Tiền');

  // Tiêu đề
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value = 'BÁO CÁO DÒNG TIỀN';
  worksheet.getCell('A1').style = titleStyle;

  // Thông tin bộ lọc
  let rowNum = 2;
  if (filters.from) {
    worksheet.mergeCells(`A${rowNum}:J${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Từ ngày: ${formatDate(filters.from)} - Đến ngày: ${formatDate(filters.to)}`;
    rowNum++;
  }
  
  worksheet.mergeCells(`A${rowNum}:J${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Ngày xuất: ${formatDate(new Date())}`;
  rowNum += 2;

  // Header
  const headerRow = rowNum;
  const headers = ['STT', 'Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Mô tả', 'Đơn hàng', 'Tài xế', 'Xe', 'Ghi chú'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.style = headerStyle;
  });

  // Lấy dữ liệu
  let query = `
    SELECT cf.*, 
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

  if (filters.type) {
    query += ' AND cf.type = ?';
    params.push(filters.type);
  }
  if (filters.from) {
    query += ' AND cf.transaction_date >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    query += ' AND cf.transaction_date <= ?';
    params.push(filters.to);
  }

  query += ' ORDER BY cf.transaction_date DESC';

  return new Promise((resolve, reject) => {
    db.all(query, params, async (err, records) => {
      if (err) {
        reject(err);
        return;
      }

      let currentRow = headerRow + 1;
      let totalIncome = 0;
      let totalExpense = 0;

      // Dữ liệu
      records.forEach((record, index) => {
        worksheet.getCell(currentRow, 1).value = index + 1;
        worksheet.getCell(currentRow, 2).value = formatDate(record.transaction_date);
        worksheet.getCell(currentRow, 3).value = record.type === 'income' ? 'Thu' : 'Chi';
        worksheet.getCell(currentRow, 4).value = record.category;
        worksheet.getCell(currentRow, 5).value = record.amount;
        worksheet.getCell(currentRow, 6).value = record.description || '';
        worksheet.getCell(currentRow, 7).value = record.order_code || '';
        worksheet.getCell(currentRow, 8).value = record.driver_name || '';
        worksheet.getCell(currentRow, 9).value = record.plate_number || '';
        worksheet.getCell(currentRow, 10).value = record.notes || '';

        // Format số tiền với màu
        worksheet.getCell(currentRow, 5).numFmt = '#,##0';
        if (record.type === 'income') {
          worksheet.getCell(currentRow, 5).font = { color: { argb: 'FF008000' } };
          totalIncome += record.amount;
        } else {
          worksheet.getCell(currentRow, 5).font = { color: { argb: 'FFFF0000' } };
          totalExpense += record.amount;
        }

        currentRow++;
      });

      // Tổng cộng
      worksheet.getCell(currentRow, 1).value = 'TỔNG THU';
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getCell(currentRow, 1).style = totalStyle;
      worksheet.getCell(currentRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
      
      worksheet.getCell(currentRow, 5).value = totalIncome;
      worksheet.getCell(currentRow, 5).style = totalStyle;
      worksheet.getCell(currentRow, 5).numFmt = '#,##0';
      worksheet.getCell(currentRow, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
      
      currentRow++;
      
      worksheet.getCell(currentRow, 1).value = 'TỔNG CHI';
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getCell(currentRow, 1).style = totalStyle;
      worksheet.getCell(currentRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA07A' } };
      
      worksheet.getCell(currentRow, 5).value = totalExpense;
      worksheet.getCell(currentRow, 5).style = totalStyle;
      worksheet.getCell(currentRow, 5).numFmt = '#,##0';
      worksheet.getCell(currentRow, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFA07A' } };
      
      currentRow++;
      
      worksheet.getCell(currentRow, 1).value = 'DÒNG TIỀN RÒNG';
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      worksheet.getCell(currentRow, 1).style = totalStyle;
      worksheet.getCell(currentRow, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
      
      worksheet.getCell(currentRow, 5).value = totalIncome - totalExpense;
      worksheet.getCell(currentRow, 5).style = totalStyle;
      worksheet.getCell(currentRow, 5).numFmt = '#,##0';
      worksheet.getCell(currentRow, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };

      // Điều chỉnh độ rộng cột
      worksheet.columns = [
        { width: 6 },   // STT
        { width: 12 },  // Ngày
        { width: 8 },   // Loại
        { width: 20 },  // Danh mục
        { width: 15 },  // Số tiền
        { width: 30 },  // Mô tả
        { width: 12 },  // Đơn hàng
        { width: 15 },  // Tài xế
        { width: 12 },  // Xe
        { width: 25 }   // Ghi chú
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      resolve(buffer);
    });
  });
}

// Export báo cáo chi phí vận hành
async function exportExpenseReport(db, filters = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo Cáo Chi Phí Vận Hành');

  // Tiêu đề
  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = 'BÁO CÁO CHI PHÍ VẬN HÀNH';
  worksheet.getCell('A1').style = titleStyle;

  // Thông tin bộ lọc
  let rowNum = 2;
  if (filters.from || filters.to) {
    worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Từ tháng: ${filters.from || 'Đầu'} - Đến tháng: ${filters.to || 'Hiện tại'}`;
    rowNum++;
  }
  
  worksheet.mergeCells(`A${rowNum}:G${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Ngày xuất: ${formatDate(new Date())}`;
  rowNum += 2;

  // Header
  const headerRow = rowNum;
  const headers = ['Xe', 'Nhiên liệu', 'Bảo dưỡng', 'Phí xe', 'Lương TX', 'Tổng', '% Tổng'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.style = headerStyle;
  });

  // Lấy dữ liệu
  let query = `
    SELECT 
      v.id as vehicle_id,
      v.plate_number,
      COALESCE(SUM(fr.total_cost), 0) as fuel_cost,
      COALESCE(SUM(vm.cost), 0) as maintenance_cost,
      COALESCE(SUM(vf.amount), 0) as fee_cost,
      COALESCE(SUM(ds.total_salary), 0) as salary_cost,
      (COALESCE(SUM(fr.total_cost), 0) + COALESCE(SUM(vm.cost), 0) + 
       COALESCE(SUM(vf.amount), 0) + COALESCE(SUM(ds.total_salary), 0)) as total_expenses
    FROM vehicles v
    LEFT JOIN fuel_records fr ON v.id = fr.vehicle_id
    LEFT JOIN vehicle_maintenance vm ON v.id = vm.vehicle_id
    LEFT JOIN vehicle_fees vf ON v.id = vf.vehicle_id
    LEFT JOIN driver_salaries ds ON ds.driver_id IN (
      SELECT DISTINCT driver_id 
      FROM orders 
      WHERE vehicle_id = v.id
    )
    WHERE 1=1
  `;
  const params = [];

  if (filters.vehicle_id) {
    query += ' AND v.id = ?';
    params.push(filters.vehicle_id);
  }
  if (filters.from) {
    query += ` AND (
      (fr.fuel_date >= ? OR fr.fuel_date IS NULL) AND
      (vm.maintenance_date >= ? OR vm.maintenance_date IS NULL) AND
      (vf.fee_date >= ? OR vf.fee_date IS NULL) AND
      (ds.salary_month >= ? OR ds.salary_month IS NULL)
    )`;
    params.push(filters.from, filters.from, filters.from, filters.from);
  }
  if (filters.to) {
    query += ` AND (
      (fr.fuel_date <= ? OR fr.fuel_date IS NULL) AND
      (vm.maintenance_date <= ? OR vm.maintenance_date IS NULL) AND
      (vf.fee_date <= ? OR vf.fee_date IS NULL) AND
      (ds.salary_month <= ? OR ds.salary_month IS NULL)
    )`;
    params.push(filters.to, filters.to, filters.to, filters.to);
  }

  query += ' GROUP BY v.id, v.plate_number ORDER BY total_expenses DESC';

  return new Promise((resolve, reject) => {
    db.all(query, params, async (err, records) => {
      if (err) {
        reject(err);
        return;
      }

      let currentRow = headerRow + 1;
      let grandTotal = records.reduce((sum, r) => sum + r.total_expenses, 0);

      // Dữ liệu
      records.forEach((record) => {
        worksheet.getCell(currentRow, 1).value = record.plate_number;
        worksheet.getCell(currentRow, 2).value = record.fuel_cost;
        worksheet.getCell(currentRow, 3).value = record.maintenance_cost;
        worksheet.getCell(currentRow, 4).value = record.fee_cost;
        worksheet.getCell(currentRow, 5).value = record.salary_cost;
        worksheet.getCell(currentRow, 6).value = record.total_expenses;
        worksheet.getCell(currentRow, 7).value = grandTotal > 0 ? (record.total_expenses / grandTotal) : 0;

        // Format số tiền
        for (let col = 2; col <= 6; col++) {
          worksheet.getCell(currentRow, col).numFmt = '#,##0';
        }
        worksheet.getCell(currentRow, 7).numFmt = '0.00%';

        currentRow++;
      });

      // Tổng cộng
      worksheet.getCell(currentRow, 1).value = 'TỔNG CỘNG';
      worksheet.getCell(currentRow, 1).style = totalStyle;
      
      const totalFuel = records.reduce((sum, r) => sum + r.fuel_cost, 0);
      const totalMaintenance = records.reduce((sum, r) => sum + r.maintenance_cost, 0);
      const totalFee = records.reduce((sum, r) => sum + r.fee_cost, 0);
      const totalSalary = records.reduce((sum, r) => sum + r.salary_cost, 0);
      
      worksheet.getCell(currentRow, 2).value = totalFuel;
      worksheet.getCell(currentRow, 3).value = totalMaintenance;
      worksheet.getCell(currentRow, 4).value = totalFee;
      worksheet.getCell(currentRow, 5).value = totalSalary;
      worksheet.getCell(currentRow, 6).value = grandTotal;
      worksheet.getCell(currentRow, 7).value = 1;

      for (let col = 2; col <= 7; col++) {
        worksheet.getCell(currentRow, col).style = totalStyle;
        if (col <= 6) {
          worksheet.getCell(currentRow, col).numFmt = '#,##0';
        } else {
          worksheet.getCell(currentRow, col).numFmt = '0.00%';
        }
      }

      // Điều chỉnh độ rộng cột
      worksheet.columns = [
        { width: 12 },  // Xe
        { width: 15 },  // Nhiên liệu
        { width: 15 },  // Bảo dưỡng
        { width: 15 },  // Phí xe
        { width: 15 },  // Lương TX
        { width: 18 },  // Tổng
        { width: 10 }   // %
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      resolve(buffer);
    });
  });
}

module.exports = {
  exportFuelReport,
  exportCashFlowReport,
  exportExpenseReport
};
