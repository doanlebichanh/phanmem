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

function applyThinBorderToCell(cell) {
  cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
}

function normalizeMetaLines(metaLines) {
  if (!metaLines) return [];
  if (Array.isArray(metaLines)) return metaLines.filter(Boolean);
  return [String(metaLines)];
}

function setColumns(worksheet, columns = []) {
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15
  }));
}

function writeHeaderRow(worksheet, rowIndex, columns) {
  const row = worksheet.getRow(rowIndex);
  row.height = 22;
  columns.forEach((col, i) => {
    const cell = worksheet.getCell(rowIndex, i + 1);
    cell.value = col.header;
    cell.style = headerStyle;
  });
}

function writeDataRows(worksheet, startRowIndex, columns, rows) {
  let rowIndex = startRowIndex;
  (rows || []).forEach((rowData, idx) => {
    const excelRowIndex = rowIndex + idx;
    columns.forEach((col, i) => {
      const cell = worksheet.getCell(excelRowIndex, i + 1);
      let value = rowData ? rowData[col.key] : '';
      if (col.value) {
        value = col.value(rowData, idx);
      }
      cell.value = value === undefined ? '' : value;
      if (col.numFmt) cell.numFmt = col.numFmt;
      if (col.alignment) cell.alignment = col.alignment;
      applyThinBorderToCell(cell);
    });
  });
  return rowIndex + (rows || []).length;
}

function autoFreezePanes(worksheet, headerRowIndex) {
  worksheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
}

async function exportTableWorkbook({
  sheetName,
  title,
  metaLines,
  columns,
  rows,
  pageSetup
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName || 'Export');
  worksheet.properties.defaultRowHeight = 18;
  worksheet.views = [{ showGridLines: false }];
  if (pageSetup) worksheet.pageSetup = { ...worksheet.pageSetup, ...pageSetup };

  const cols = columns || [];
  setColumns(worksheet, cols);

  const totalCols = Math.max(cols.length, 1);

  // Title
  worksheet.mergeCells(1, 1, 1, totalCols);
  worksheet.getCell(1, 1).value = title || 'BÁO CÁO';
  worksheet.getCell(1, 1).style = titleStyle;
  worksheet.getRow(1).height = 28;

  // Meta lines
  let rowNum = 2;
  const metas = normalizeMetaLines(metaLines);
  metas.forEach(line => {
    worksheet.mergeCells(rowNum, 1, rowNum, totalCols);
    worksheet.getCell(rowNum, 1).value = line;
    worksheet.getCell(rowNum, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    rowNum++;
  });
  worksheet.mergeCells(rowNum, 1, rowNum, totalCols);
  worksheet.getCell(rowNum, 1).value = `Ngày xuất: ${formatDate(new Date())}`;
  worksheet.getCell(rowNum, 1).alignment = { vertical: 'middle', horizontal: 'left' };
  rowNum += 2;

  // Header + rows
  const headerRowIndex = rowNum;
  writeHeaderRow(worksheet, headerRowIndex, cols);
  const afterDataRow = writeDataRows(worksheet, headerRowIndex + 1, cols, rows);

  // Auto-filter
  if (cols.length > 0) {
    worksheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: cols.length }
    };
  }

  autoFreezePanes(worksheet, headerRowIndex);

  // Add a bit of bottom padding
  worksheet.getRow(afterDataRow + 1).height = 8;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function exportMultiSheetWorkbook({
  title,
  metaLines,
  sheets
}) {
  const workbook = new ExcelJS.Workbook();
  const metas = normalizeMetaLines(metaLines);

  (sheets || []).forEach((sheet, sheetIndex) => {
    const worksheet = workbook.addWorksheet(sheet.name || `Sheet${sheetIndex + 1}`);
    worksheet.properties.defaultRowHeight = 18;
    worksheet.views = [{ showGridLines: false }];
    if (sheet.pageSetup) worksheet.pageSetup = { ...worksheet.pageSetup, ...sheet.pageSetup };

    const cols = sheet.columns || [];
    setColumns(worksheet, cols);
    const totalCols = Math.max(cols.length, 1);

    worksheet.mergeCells(1, 1, 1, totalCols);
    worksheet.getCell(1, 1).value = sheet.title || title || 'BÁO CÁO';
    worksheet.getCell(1, 1).style = titleStyle;
    worksheet.getRow(1).height = 28;

    let rowNum = 2;
    metas.concat(normalizeMetaLines(sheet.metaLines)).forEach(line => {
      worksheet.mergeCells(rowNum, 1, rowNum, totalCols);
      worksheet.getCell(rowNum, 1).value = line;
      worksheet.getCell(rowNum, 1).alignment = { vertical: 'middle', horizontal: 'left' };
      rowNum++;
    });
    worksheet.mergeCells(rowNum, 1, rowNum, totalCols);
    worksheet.getCell(rowNum, 1).value = `Ngày xuất: ${formatDate(new Date())}`;
    worksheet.getCell(rowNum, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    rowNum += 2;

    const headerRowIndex = rowNum;
    writeHeaderRow(worksheet, headerRowIndex, cols);
    const afterDataRow = writeDataRows(worksheet, headerRowIndex + 1, cols, sheet.rows || []);

    if (cols.length > 0) {
      worksheet.autoFilter = {
        from: { row: headerRowIndex, column: 1 },
        to: { row: headerRowIndex, column: cols.length }
      };
    }
    autoFreezePanes(worksheet, headerRowIndex);
    worksheet.getRow(afterDataRow + 1).height = 8;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

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

async function exportCashFlowConsolidatedReport(records = [], filters = {}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo Cáo Dòng Tiền');

  // Tiêu đề
  worksheet.mergeCells('A1:H1');
  worksheet.getCell('A1').value = 'BÁO CÁO DÒNG TIỀN (TỔNG HỢP)';
  worksheet.getCell('A1').style = titleStyle;

  // Thông tin bộ lọc
  let rowNum = 2;
  if (filters.from) {
    worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Từ ngày: ${formatDate(filters.from)} - Đến ngày: ${formatDate(filters.to)}`;
    rowNum++;
  }
  if (filters.type) {
    worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
    worksheet.getCell(`A${rowNum}`).value = `Loại: ${filters.type === 'income' ? 'Thu' : 'Chi'}`;
    rowNum++;
  }

  worksheet.mergeCells(`A${rowNum}:H${rowNum}`);
  worksheet.getCell(`A${rowNum}`).value = `Ngày xuất: ${formatDate(new Date())}`;
  rowNum += 2;

  const headerRow = rowNum;
  const headers = ['STT', 'Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Mô tả', 'Nguồn', 'Tham chiếu'];
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.style = headerStyle;
  });

  const filtered = (filters.type ? records.filter(r => r.type === filters.type) : records)
    .filter(r => r && r.transaction_date);

  let currentRow = headerRow + 1;
  let totalIncome = 0;
  let totalExpense = 0;

  filtered.forEach((record, index) => {
    worksheet.getCell(currentRow, 1).value = index + 1;
    worksheet.getCell(currentRow, 2).value = formatDate(record.transaction_date);
    worksheet.getCell(currentRow, 3).value = record.type === 'income' ? 'Thu' : 'Chi';
    worksheet.getCell(currentRow, 4).value = record.category || '';
    worksheet.getCell(currentRow, 5).value = Number(record.amount || 0);
    worksheet.getCell(currentRow, 6).value = record.description || '';
    worksheet.getCell(currentRow, 7).value = record.source || '';
    worksheet.getCell(currentRow, 8).value = record.reference || '';

    worksheet.getCell(currentRow, 5).numFmt = '#,##0';
    if (record.type === 'income') {
      worksheet.getCell(currentRow, 5).font = { color: { argb: 'FF008000' } };
      totalIncome += Number(record.amount || 0);
    } else {
      worksheet.getCell(currentRow, 5).font = { color: { argb: 'FFFF0000' } };
      totalExpense += Number(record.amount || 0);
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
    { width: 6 },
    { width: 12 },
    { width: 8 },
    { width: 20 },
    { width: 15 },
    { width: 40 },
    { width: 14 },
    { width: 16 }
  ];

  return workbook.xlsx.writeBuffer();
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

  const fromDate = normalizeMonthToDate(filters.from, false);
  const toDate = normalizeMonthToDate(filters.to, true);
  const salaryFrom = filters.from ? String(filters.from).substring(0, 7) : null;
  const salaryTo = filters.to ? String(filters.to).substring(0, 7) : null;

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
  const salaryParams = [];

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

  const salaryRange = [];
  if (salaryFrom) {
    salaryRange.push('ds.salary_month >= ?');
    salaryParams.push(salaryFrom);
  }
  if (salaryTo) {
    salaryRange.push('ds.salary_month <= ?');
    salaryParams.push(salaryTo);
  }

  const salarySubquery = `
    SELECT o.vehicle_id, COALESCE(SUM(ds.total_salary), 0) AS salary_cost
    FROM driver_salaries ds
    JOIN (
      SELECT DISTINCT vehicle_id, driver_id
      FROM orders
      WHERE vehicle_id IS NOT NULL AND driver_id IS NOT NULL
    ) o ON o.driver_id = ds.driver_id
    WHERE 1=1 ${salaryRange.length ? ` AND ${salaryRange.join(' AND ')}` : ''}
    GROUP BY o.vehicle_id
  `;

  let query = `
    SELECT
      v.id as vehicle_id,
      v.plate_number,
      COALESCE(fr.fuel_cost, 0) as fuel_cost,
      COALESCE(vm.maintenance_cost, 0) as maintenance_cost,
      COALESCE(vf.fee_cost, 0) as fee_cost,
      COALESCE(ds.salary_cost, 0) as salary_cost,
      (COALESCE(fr.fuel_cost, 0) + COALESCE(vm.maintenance_cost, 0) +
       COALESCE(vf.fee_cost, 0) + COALESCE(ds.salary_cost, 0)) as total_expenses
    FROM vehicles v
    LEFT JOIN (${fuelSubquery}) fr ON v.id = fr.vehicle_id
    LEFT JOIN (${maintenanceSubquery}) vm ON v.id = vm.vehicle_id
    LEFT JOIN (${feeSubquery}) vf ON v.id = vf.vehicle_id
    LEFT JOIN (${salarySubquery}) ds ON v.id = ds.vehicle_id
    WHERE 1=1
  `;

  const params = [...fuelParams, ...maintenanceParams, ...feeParams, ...salaryParams];
  if (filters.vehicle_id) {
    query += ' AND v.id = ?';
    params.push(filters.vehicle_id);
  }

  query += ' ORDER BY total_expenses DESC';

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

// Export báo giá
async function exportQuoteReport(db, quoteId, options = {}) {
  const companyName = options.company_name || 'CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH';
  const directorName = options.director_name || 'TRẦN NGỌC TIÊN';

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo Giá');

  const quote = await new Promise((resolve, reject) => {
    const query = `
      SELECT q.*, c.name as customer_name, c.contact_person, c.phone as customer_phone
      FROM quotes q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = ?
    `;
    db.get(query, [quoteId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!quote) {
    const err = new Error('Không tìm thấy báo giá');
    err.code = 'NOT_FOUND';
    throw err;
  }

  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
  };
  worksheet.views = [{ showGridLines: false }];

  worksheet.columns = [
    { width: 42 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 }
  ];

  const thinBorder = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  const applyBorderRange = (row, fromCol, toCol) => {
    for (let c = fromCol; c <= toCol; c++) {
      worksheet.getCell(row, c).border = thinBorder;
      worksheet.getCell(row, c).alignment = {
        ...(worksheet.getCell(row, c).alignment || {}),
        vertical: 'middle',
        wrapText: true
      };
    }
  };
  const applyBorderRect = (fromRow, toRow, fromCol, toCol) => {
    for (let rr = fromRow; rr <= toRow; rr++) {
      applyBorderRange(rr, fromCol, toCol);
    }
  };

  // Header
  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = companyName;
  worksheet.getCell('A1').style = {
    font: { bold: true, size: 14, color: { argb: 'FF4472C4' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true }
  };
  worksheet.getRow(1).height = 22;

  worksheet.mergeCells('A2:F2');
  worksheet.getCell('A2').value = 'BÁO GIÁ DỊCH VỤ VẬN CHUYỂN';
  worksheet.getCell('A2').style = titleStyle;
  worksheet.getRow(2).height = 20;

  let r = 4;
  const setKV = (row, label1, value1, label2, value2) => {
    worksheet.mergeCells(row, 2, row, 3);
    worksheet.mergeCells(row, 5, row, 6);

    worksheet.getCell(row, 1).value = label1;
    worksheet.getCell(row, 1).font = { bold: true };
    worksheet.getCell(row, 1).alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.getCell(row, 2).value = value1 ?? '';
    worksheet.getCell(row, 2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    worksheet.getCell(row, 4).value = label2;
    worksheet.getCell(row, 4).font = { bold: true };
    worksheet.getCell(row, 4).alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.getCell(row, 5).value = value2 ?? '';
    worksheet.getCell(row, 5).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

    worksheet.getRow(row).height = 18;
    applyBorderRange(row, 1, 6);
  };

  setKV(r++, 'Số báo giá:', quote.quote_number, 'Ngày:', formatDate(quote.quote_date));
  setKV(r++, 'Khách hàng:', quote.customer_name || '', 'Hiệu lực:', quote.valid_until ? formatDate(quote.valid_until) : 'Không giới hạn');
  setKV(r++, 'Người liên hệ:', quote.contact_person || '', 'Điện thoại:', quote.customer_phone || '');

  r++;

  // Transport info
  worksheet.mergeCells(`A${r}:F${r}`);
  worksheet.getCell(`A${r}`).value = 'THÔNG TIN VẬN CHUYỂN';
  worksheet.getCell(`A${r}`).style = {
    font: { bold: true, size: 12 },
    alignment: { vertical: 'middle', horizontal: 'left' }
  };
  worksheet.getRow(r).height = 20;
  applyBorderRange(r, 1, 6);
  r++;

  setKV(r++, 'Điểm đi:', quote.route_from || '', 'Điểm đến:', quote.route_to || '');
  setKV(r++, 'Loại container:', quote.container_type || '', 'Hàng hóa:', quote.cargo_description || '');
  r++;

  // Item table
  const headerRow = r;
  const headers = ['Mô tả', 'Số lượng', 'Đơn giá', 'Thành tiền'];
  headers.forEach((h, i) => {
    const cell = worksheet.getCell(headerRow, i + 1);
    cell.value = h;
    cell.style = headerStyle;
  });
  worksheet.getRow(headerRow).height = 20;
  applyBorderRange(headerRow, 1, 4);
  r++;

  worksheet.getCell(r, 1).value = `Vận chuyển ${quote.route_from || ''} - ${quote.route_to || ''}`;
  worksheet.getCell(r, 2).value = Number(quote.quantity || 1);
  worksheet.getCell(r, 3).value = Number(quote.unit_price || 0);
  worksheet.getCell(r, 4).value = Number(quote.total_amount || 0);
  worksheet.getCell(r, 2).numFmt = '#,##0.00';
  worksheet.getCell(r, 3).numFmt = '#,##0';
  worksheet.getCell(r, 4).numFmt = '#,##0';
  worksheet.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  worksheet.getCell(r, 2).alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getCell(r, 3).alignment = { vertical: 'middle', horizontal: 'right' };
  worksheet.getCell(r, 4).alignment = { vertical: 'middle', horizontal: 'right' };
  worksheet.getRow(r).height = 18;
  applyBorderRange(r, 1, 4);
  r += 2;

  // Totals
  const setTotalLine = (label, value, isStrong) => {
    worksheet.mergeCells(r, 1, r, 3);
    worksheet.getCell(r, 1).value = label;
    worksheet.getCell(r, 1).alignment = { horizontal: 'right' };
    worksheet.getCell(r, 1).font = { bold: !!isStrong };
    worksheet.getCell(r, 4).value = Number(value || 0);
    worksheet.getCell(r, 4).numFmt = '#,##0';
    worksheet.getCell(r, 4).font = { bold: !!isStrong, color: isStrong ? { argb: 'FF4472C4' } : undefined };
    worksheet.getCell(r, 4).alignment = { horizontal: 'right' };
    worksheet.getRow(r).height = 18;
    applyBorderRange(r, 1, 4);
    r++;
  };

  setTotalLine('Tổng cộng:', quote.total_amount || 0, false);
  if (Number(quote.discount_amount || 0) > 0) {
    setTotalLine('Giảm giá:', -(Number(quote.discount_amount || 0)), false);
  }
  setTotalLine('Thuế VAT:', quote.tax_amount || 0, false);
  setTotalLine('Tổng thanh toán:', quote.final_amount || 0, true);

  // Enclose the main form area (info + transport + items + totals)
  applyBorderRect(4, r - 1, 1, 6);

  if (quote.notes) {
    r++;
    worksheet.mergeCells(`A${r}:F${r}`);
    worksheet.getCell(`A${r}`).value = `Ghi chú: ${quote.notes}`;
    worksheet.getCell(`A${r}`).alignment = { wrapText: true };
    worksheet.getRow(r).height = 36;
    applyBorderRange(r, 1, 6);
    r++;
  }

  // Signature (bottom-right)
  r += 2;
  worksheet.mergeCells(`E${r}:F${r}`);
  worksheet.getCell(`E${r}`).value = companyName;
  worksheet.getCell(`E${r}`).alignment = { horizontal: 'center' };
  worksheet.getCell(`E${r}`).font = { bold: true };
  r++;

  worksheet.mergeCells(`E${r}:F${r}`);
  worksheet.getCell(`E${r}`).value = 'GIÁM ĐỐC';
  worksheet.getCell(`E${r}`).alignment = { horizontal: 'center' };
  worksheet.getCell(`E${r}`).font = { bold: true };
  r++;

  worksheet.mergeCells(`E${r}:F${r}`);
  worksheet.getCell(`E${r}`).value = '(Ký, đóng dấu)';
  worksheet.getCell(`E${r}`).alignment = { horizontal: 'center' };
  worksheet.getCell(`E${r}`).font = { italic: true, size: 10 };
  r += 4;

  worksheet.mergeCells(`E${r}:F${r}`);
  worksheet.getCell(`E${r}`).value = directorName;
  worksheet.getCell(`E${r}`).alignment = { horizontal: 'center' };
  worksheet.getCell(`E${r}`).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

module.exports = {
  exportFuelReport,
  exportCashFlowReport,
  exportCashFlowConsolidatedReport,
  exportExpenseReport,
  exportQuoteReport,
  exportTableWorkbook,
  exportMultiSheetWorkbook
};
