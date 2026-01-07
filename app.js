// Danh sách xe container cố định
const CONTAINERS = [
  "50E21256",
  "50E33148",
  "50E40752",
  "50E53027",
  "50E53401",
  "50H11147",
  "50H51109",
  "50H68598",
  "51D44553",
  "50E33681",
  "50H11701",
  "50H43593"
];

// Lưu bảng kê trong localStorage
const STORAGE_KEY = "freight_waybills";

/** @type {Array} */
let waybills = [];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      waybills = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Lỗi đọc dữ liệu:", e);
    waybills = [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(waybills));
}

function formatMoney(value) {
  if (!value && value !== 0) return "";
  return Number(value).toLocaleString("vi-VN");
}

function initContainerSelects() {
  const containerSelect = document.getElementById("containerNumber");
  const filterContainer = document.getElementById("filterContainer");

  // Xóa option cũ nếu có
  containerSelect.innerHTML = "";
  filterContainer.innerHTML = "";

  // Option mặc định
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- Chọn xe --";
  containerSelect.appendChild(placeholder);

  const filterAll = document.createElement("option");
  filterAll.value = "";
  filterAll.textContent = "Tất cả xe";
  filterContainer.appendChild(filterAll);

  CONTAINERS.forEach((id) => {
    const opt1 = document.createElement("option");
    opt1.value = id;
    opt1.textContent = id;
    containerSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = id;
    opt2.textContent = id;
    filterContainer.appendChild(opt2);
  });
}

function handleAutoTotal() {
  const quantity = parseFloat(document.getElementById("quantity").value || "0");
  const unitPrice = parseFloat(document.getElementById("unitPrice").value || "0");
  if (quantity > 0 && unitPrice > 0) {
    const total = Math.round(quantity * unitPrice);
    document.getElementById("totalCharge").value = total;
  }
}

function handleSubmitForm(event) {
  event.preventDefault();

  const customerName = document.getElementById("customerName").value.trim();
  const customerPhone = document.getElementById("customerPhone").value.trim();
  const customerAddress = document.getElementById("customerAddress").value.trim();

  const shipmentDate = document.getElementById("shipmentDate").value;
  const containerNumber = document.getElementById("containerNumber").value;
  const origin = document.getElementById("origin").value.trim();
  const destination = document.getElementById("destination").value.trim();
  const cargoDescription = document.getElementById("cargoDescription").value.trim();

  const quantity = parseFloat(document.getElementById("quantity").value || "0");
  const unitPrice = parseFloat(document.getElementById("unitPrice").value || "0");
  const totalCharge = parseFloat(document.getElementById("totalCharge").value || "0");

  if (!customerName || !shipmentDate || !containerNumber || !origin || !destination || !totalCharge) {
    alert("Vui lòng điền đầy đủ các trường bắt buộc (*) và Thành tiền.");
    return;
  }

  const id = Date.now().toString();

  const waybill = {
    id,
    customerName,
    customerPhone,
    customerAddress,
    shipmentDate,
    containerNumber,
    origin,
    destination,
    cargoDescription,
    quantity,
    unitPrice,
    totalCharge,
    createdAt: new Date().toISOString()
  };

  waybills.push(waybill);
  saveToStorage();
  renderWaybillTable();
  renderContainerSummary();

  (document.getElementById("waybillForm") as HTMLFormElement).reset?.();
  // Đặt lại select số xe về mặc định
  document.getElementById("containerNumber").value = "";

  alert("Đã lưu bảng kê.");
}

function renderWaybillTable() {
  const tbody = document.querySelector("#waybillTable tbody");
  if (!tbody) return;

  const filterContainer = (document.getElementById("filterContainer") as HTMLSelectElement).value;
  const filterCustomer = (document.getElementById("filterCustomer") as HTMLInputElement).value.trim().toLowerCase();
  const filterFrom = (document.getElementById("filterFrom") as HTMLInputElement).value;
  const filterTo = (document.getElementById("filterTo") as HTMLInputElement).value;

  tbody.innerHTML = "";

  const filtered = waybills.filter((w) => {
    if (filterContainer && w.containerNumber !== filterContainer) return false;
    if (filterCustomer && !w.customerName.toLowerCase().includes(filterCustomer)) return false;
    if (filterFrom && w.shipmentDate < filterFrom) return false;
    if (filterTo && w.shipmentDate > filterTo) return false;
    return true;
  });

  filtered
    .sort((a, b) => (a.shipmentDate < b.shipmentDate ? -1 : a.shipmentDate > b.shipmentDate ? 1 : 0))
    .forEach((w) => {
      const tr = document.createElement("tr");

      const dateCell = document.createElement("td");
      dateCell.textContent = w.shipmentDate;

      const containerCell = document.createElement("td");
      containerCell.textContent = w.containerNumber;

      const customerCell = document.createElement("td");
      customerCell.textContent = w.customerName;

      const originCell = document.createElement("td");
      originCell.textContent = w.origin;

      const destCell = document.createElement("td");
      destCell.textContent = w.destination;

      const chargeCell = document.createElement("td");
      chargeCell.textContent = formatMoney(w.totalCharge);
      chargeCell.className = "number";

      const actionsCell = document.createElement("td");
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Xuất bảng kê";
      exportBtn.className = "small";
      exportBtn.addEventListener("click", () => exportWaybill(w));
      actionsCell.appendChild(exportBtn);

      tr.appendChild(dateCell);
      tr.appendChild(containerCell);
      tr.appendChild(customerCell);
      tr.appendChild(originCell);
      tr.appendChild(destCell);
      tr.appendChild(chargeCell);
      tr.appendChild(actionsCell);

      tbody.appendChild(tr);
    });
}

function renderContainerSummary() {
  const tbody = document.querySelector("#containerSummaryTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  CONTAINERS.forEach((id) => {
    const trips = waybills.filter((w) => w.containerNumber === id);
    const count = trips.length;
    const total = trips.reduce((sum, w) => sum + (w.totalCharge || 0), 0);

    const tr = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.textContent = id;

    const countCell = document.createElement("td");
    countCell.textContent = String(count);
    countCell.className = "number";

    const totalCell = document.createElement("td");
    totalCell.textContent = formatMoney(total);
    totalCell.className = "number";

    tr.appendChild(idCell);
    tr.appendChild(countCell);
    tr.appendChild(totalCell);

    tbody.appendChild(tr);
  });
}

function clearFilters() {
  (document.getElementById("filterContainer") as HTMLSelectElement).value = "";
  (document.getElementById("filterCustomer") as HTMLInputElement).value = "";
  (document.getElementById("filterFrom") as HTMLInputElement).value = "";
  (document.getElementById("filterTo") as HTMLInputElement).value = "";
  renderWaybillTable();
}

function exportWaybill(w) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Trình duyệt chặn cửa sổ mới. Vui lòng cho phép pop-up.");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Bảng kê cước vận chuyển - ${w.customerName}</title>
<style>
body { font-family: Arial, sans-serif; margin: 20px; }
h1 { text-align: center; }
.table { border-collapse: collapse; width: 100%; margin-top: 20px; }
.table th, .table td { border: 1px solid #333; padding: 8px; }
.table th { background: #eee; }
.text-right { text-align: right; }
.section-title { margin-top: 16px; font-weight: bold; }
</style>
</head>
<body>
  <h1>BẢNG KÊ CƯỚC VẬN CHUYỂN</h1>
  <p><strong>Ngày vận chuyển:</strong> ${w.shipmentDate}</p>

  <div class="section-title">1. Thông tin khách hàng</div>
  <p><strong>Tên khách hàng:</strong> ${w.customerName}</p>
  <p><strong>Điện thoại:</strong> ${w.customerPhone || ""}</p>
  <p><strong>Địa chỉ:</strong> ${w.customerAddress || ""}</p>

  <div class="section-title">2. Thông tin chuyến xe</div>
  <p><strong>Số xe container:</strong> ${w.containerNumber}</p>
  <p><strong>Nơi nhận hàng:</strong> ${w.origin}</p>
  <p><strong>Nơi giao hàng:</strong> ${w.destination}</p>

  <table class="table">
    <thead>
      <tr>
        <th>Mô tả hàng hóa</th>
        <th>Số lượng</th>
        <th>Đơn giá (VND)</th>
        <th>Thành tiền (VND)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${w.cargoDescription || ""}</td>
        <td class="text-right">${w.quantity || ""}</td>
        <td class="text-right">${formatMoney(w.unitPrice) || ""}</td>
        <td class="text-right">${formatMoney(w.totalCharge)}</td>
      </tr>
    </tbody>
  </table>

  <p class="section-title">3. Ghi chú</p>
  <p>(Ký, ghi rõ họ tên và đóng dấu nếu có)</p>

  <script>
    window.print();
  <\/script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
}

function initEvents() {
  const form = document.getElementById("waybillForm");
  if (form) {
    form.addEventListener("submit", handleSubmitForm);
  }

  const quantityInput = document.getElementById("quantity");
  const unitPriceInput = document.getElementById("unitPrice");

  quantityInput?.addEventListener("input", handleAutoTotal);
  unitPriceInput?.addEventListener("input", handleAutoTotal);

  document.getElementById("filterContainer")?.addEventListener("change", renderWaybillTable);
  document.getElementById("filterCustomer")?.addEventListener("input", renderWaybillTable);
  document.getElementById("filterFrom")?.addEventListener("change", renderWaybillTable);
  document.getElementById("filterTo")?.addEventListener("change", renderWaybillTable);
  document.getElementById("clearFilters")?.addEventListener("click", clearFilters);
}

window.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  initContainerSelects();
  initEvents();
  renderWaybillTable();
  renderContainerSummary();
});
