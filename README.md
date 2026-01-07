# FreightManager – Phần mềm quản lý vận chuyển (Web + Electron)

Ứng dụng quản lý vận chuyển container chạy **local** (SQLite), giao diện Web (HTML/JS) và có thể đóng gói **Desktop bằng Electron**.

Trọng tâm của hệ thống:
- Quản lý **đơn hàng (orders)**, **khách hàng**, **tài xế**, **xe**, **container**, **tuyến đường**
- Theo dõi **chi phí chuyến**, **thanh toán khách hàng**, **tạm ứng tài xế**
- Module **lương tài xế** (tính theo số chuyến hoàn thành + thưởng/phạt – tạm ứng)
- Module vận hành: **nhiên liệu**, **bảo dưỡng**, **phí xe**, **cảnh báo sắp hết hạn**
- **Dòng tiền**: tổng hợp tự động từ nhiều nguồn + ghi thu/chi thủ công
- **Báo cáo** + **xuất Excel**
- **Audit log** và cảnh báo hành vi bất thường (security alert)

---

## 1) Kiến trúc & công nghệ

### Thành phần
- **Backend**: Node.js + Express (REST API), file: `server.js`
- **Database**: SQLite (`freight.db`), file kết nối/khởi tạo: `database.js`
- **Frontend**: HTML/CSS/JS thuần (không framework)
  - Trang chính: `public/index.html`
  - Trang login: `public/login.html`
  - Logic UI: `public/js/app.js` + `public/js/phase1-features.js` + `public/js/phase2-features.js` + `public/js/phase3-features.js`
- **Desktop app**: Electron wrapper (mở `http://localhost:3000`), file: `main.js`

### Thư viện chính
- `express`, `cors`
- `sqlite3`
- `jsonwebtoken` (JWT)
- `bcryptjs` (hash mật khẩu)
- `exceljs` (xuất báo cáo Excel) – file: `excel-export.js`

---

## 2) Chạy dự án (local)

### Yêu cầu
- Node.js (khuyến nghị LTS)

### Cài dependency
```bash
npm install
```

### Chạy dạng Web (Express server)
```bash
npm run dev
```

Mở trình duyệt:
- `http://localhost:3000`

### Chạy dạng Desktop (Electron)
```bash
npm run electron
```

### Build file cài đặt Windows (NSIS)
```bash
npm run build
```

Output nằm trong thư mục `dist/`.

---

## 3) Tài khoản & đăng nhập

Khi server khởi động, `database.js` sẽ đảm bảo có tài khoản mặc định:

- Username: `admin`
- Password: `admin123`

Luồng đăng nhập:
1) `public/login.html` gọi `POST /api/auth/login`
2) Server kiểm tra user, so khớp mật khẩu bằng `bcrypt.compareSync`
3) Server phát JWT (hạn 24h), frontend lưu `token` + `user` vào `localStorage`
4) Mọi API call tiếp theo dùng header: `Authorization: Bearer <token>`

Frontend có helper `apiCall()` trong `public/js/app.js`:
- auto attach token
- timeout mặc định 30s
- nếu server trả 401 → tự logout

---

## 4) Phân quyền (roles) & nguyên tắc truy cập

Trong backend có 2 lớp:
- `authenticateToken`: bắt buộc token hợp lệ
- `requireRole(...roles)`: hạn chế theo vai trò

Vai trò được sử dụng trong code:
- `admin` – toàn quyền
- `dispatcher` – điều độ (tạo/sửa đơn, quản lý tài xế/xe/container/tuyến…)
- `accountant` – kế toán (thu/chi, thanh toán, lương…)
- `staff` – nhân viên (bị hạn chế nhiều thao tác)
- `sales` – được tham chiếu trong module CRM/Khách hàng & báo giá (lưu ý: UI tạo user hiện validate role theo danh sách cố định; nếu cần `sales` bạn có thể tạo trực tiếp trong DB hoặc cập nhật phần tạo user)

Frontend cũng ẩn/hiện menu dựa theo role (ví dụ staff bị ẩn menu lương, kế toán/nhân viên bị ẩn menu bảo dưỡng…).

---

## 5) Điều hướng UI (các trang chính)

Sidebar nằm trong `public/index.html`, các trang được render bằng `loadPage(page)` trong `public/js/app.js`.

Danh sách page key (menu → renderer):
- `dashboard` → `renderDashboard()`
- `orders` → `renderOrders()`
- `customers` → `renderCustomers()` (CRM cũng có tab customers riêng)
- `drivers` → `renderDrivers()`
- `vehicles` → `renderVehicles()`
- `containers` → `renderContainers()`
- `routes` → `renderRoutes()`
- `reports` → `renderReports()`
- `accounting` → `renderAccounting()`
- `salaries` → `window.renderSalaries()` (phase 1)
- `maintenance` → `window.renderMaintenance()` (phase 2/3)
- `fuel` → `window.renderFuelManagement()` (phase 2)
- `cashflow` → `window.renderCashFlow()` (phase 2)
- `expense-reports` → `window.renderExpenseReports()` (phase 3)
- `crm` → `window.renderCRM()` (phase 3)
- `users` → `renderUsers()`
- `audit-logs` → `renderAuditLogs()`

---

## 6) Tính năng & cách triển khai (theo module)

Phần này mô tả **tính năng** và **cách đã áp dụng trong code** (UI → API → DB).

### 6.1 Dashboard tổng quan
UI:
- `renderDashboard()` gọi song song nhiều API để dựng thống kê.

API backend:
- `GET /api/reports/overview`: tổng đơn, doanh thu, chi phí, thanh toán, lợi nhuận
- `GET /api/orders`, `GET /api/customers`, `GET /api/vehicles`, `GET /api/drivers`
- `GET /api/alerts/vehicle-expiry`: cảnh báo đăng kiểm/bảo hiểm/bảo dưỡng sắp đến hạn (hiển thị cho admin/dispatcher)

Ý tưởng triển khai:
- Dashboard tính số đơn theo status (`pending`, `in-transit`, `completed`)
- Thống kê xe theo `available`, `in-use`, `maintenance`
- Top khách hàng theo doanh thu, top khách hàng công nợ cao

---

### 6.2 Quản lý đơn hàng (Orders)
UI:
- Trang `orders` trong `public/js/app.js`.

API backend (chính):
- `GET /api/orders` (lọc theo customer/date/status)
- `GET /api/orders/:id` (chi tiết đơn + list chi phí + list thanh toán)
- `POST /api/orders` (admin/dispatcher)
- `PUT /api/orders/:id` (admin/dispatcher)
- `DELETE /api/orders/:id` (admin)

Điểm đáng chú ý trong triển khai:
- Khi tạo đơn: tự sinh `order_code` kiểu `ORDxxxxxxxx`.
- Tính tiền & VAT:
  - `subtotal_amount = price + neo_xe + chi_ho`
  - `vat_rate` mặc định `0.1` (VAT 10%)
  - `final_amount = round(subtotal_amount * (1 + vat_rate))` (nếu không nhập tay)
  - Lưu thêm `vat_amount = final_amount - subtotal_amount` để phục vụ báo cáo VAT/công nợ
- Khi tạo/sửa/xóa đơn: cập nhật `customers.current_debt` để phản ánh công nợ.
- Hỗ trợ các trường mở rộng: `booking_number`, `bill_of_lading`, `seal_number`, `cargo_type`.

---

### 6.3 Chi phí chuyến (Trip costs)
UI:
- Gắn theo đơn hàng (thường thao tác trong trang chi tiết đơn).

API backend:
- `GET /api/orders/:orderId/costs`
- `POST /api/orders/:orderId/costs` (admin/dispatcher/accountant)
- `DELETE /api/costs/:id` (admin/dispatcher)
- `GET /api/costs` (phục vụ báo cáo/dashboard, có filter)

Dữ liệu:
- Lưu chi phí theo `cost_type`, có thể kèm thông tin nhiên liệu (`fuel_liters`, `fuel_price_per_liter`), quãng đường (`distance_km`), số biên lai, file hoá đơn.

---

### 6.4 Thanh toán khách hàng (Payments) & công nợ
UI:
- Gắn theo đơn hàng.

API backend:
- `GET /api/orders/:orderId/payments`
- `POST /api/orders/:orderId/payments` (admin/accountant)
- `DELETE /api/payments/:id` (admin/accountant)

Cách tính công nợ:
- Khi ghi nhận thanh toán: trừ `customers.current_debt`.
- Khi xóa thanh toán: cộng trả lại vào `customers.current_debt`.

Lưu ý quan trọng:
- `customer_id` của thanh toán được lấy theo `orders.customer_id` (không tin dữ liệu client) để tránh lệch công nợ khi đổi khách/nhập sai.
- Khi xóa đơn hàng, hệ thống hoàn trả lại ảnh hưởng của các phiếu thu trước khi trừ `final_amount`.

---

### 6.5 Tạm ứng tài xế (Driver advances)
UI:
- Tạm ứng theo đơn, và có màn hình/luồng quyết toán.

API backend:
- `GET /api/orders/:orderId/advances`
- `GET /api/drivers/:driverId/advances`
- `POST /api/orders/:orderId/advances` (admin/dispatcher/accountant)
- `PUT /api/advances/:id/settle` (admin/accountant)
- `DELETE /api/advances/:id` (admin)
- `GET /api/reports/unsettled-advances`

Gắn kết với lương:
- Khi tính lương tháng, hệ thống lấy tổng tạm ứng chưa quyết toán (`settled = 0`) để trừ vào lương.
- Khi bản lương chuyển `paid`, hệ thống tự đánh dấu các tạm ứng liên quan là `settled` (theo tháng lương) và ghi `salary_id` để truy vết.

---

### 6.6 Upload chứng từ (Documents/POD)
UI:
- Upload file ảnh, convert sang base64.

API backend:
- `GET /api/orders/:orderId/documents`
- `POST /api/orders/:orderId/documents` (admin/dispatcher)
- `DELETE /api/documents/:id` (admin)
- `GET /api/documents/:id/download`

Cách lưu:
- Lưu trực tiếp base64 vào DB (trường `file_url`), không lưu ra filesystem.

---

### 6.7 Quản lý lương tài xế (Phase 1)
UI:
- `public/js/phase1-features.js` → `window.renderSalaries()`
- Có 2 tab:
  - Bảng lương
  - Thưởng/Phạt

API backend:
- `GET /api/salaries` (admin/accountant)
- `POST /api/salaries/calculate` (admin/accountant) → trả preview tính lương
- `POST /api/salaries` (admin/accountant) → lưu bản lương (mặc định `draft`)
- `PUT /api/salaries/:id` (admin/accountant) → đổi trạng thái (approve/pay…)
- `PUT /api/salaries/:id/update-details` (admin/accountant) → chỉnh base/overtime/notes (chỉ khi `draft`)
- `DELETE /api/salaries/:id` (admin, chỉ khi `draft`)
- `GET /api/salaries/:id`

Công thức tính (từ code):
- `trip_count`: số đơn `completed` theo `delivery_date` trong tháng
- `trip_bonus`: tổng thưởng trong tháng
- `deductions`: tổng phạt trong tháng
- `advances_deducted`: tổng tạm ứng chưa quyết toán (đến thời điểm tháng tính)
- `total_salary = base_salary + trip_bonus - deductions - advances_deducted`

Thưởng/Phạt:
- `GET /api/bonuses-penalties`
- `POST /api/bonuses-penalties` (admin/accountant/dispatcher)
- `DELETE /api/bonuses-penalties/:id` (admin)

---

### 6.8 Nhiên liệu (Fuel management – Phase 2.1)
UI:
- `public/js/phase2-features.js` → `window.renderFuelManagement()`
- Có tab danh sách đổ xăng + tab thống kê tiêu hao.

API backend:
- `GET /api/fuel-records`
- `GET /api/fuel-records/stats` (tính `L/100km` nếu đủ dữ liệu đồng hồ)
- `GET /api/fuel-records/:id`
- `POST /api/fuel-records` (admin/dispatcher/accountant)
- `PUT /api/fuel-records/:id` (admin/dispatcher/accountant)
- `DELETE /api/fuel-records/:id` (admin/accountant)

Xuất Excel:
- `GET /api/export/fuel-records`

---

### 6.9 Bảo dưỡng xe, phí xe & cảnh báo hết hạn
API backend:
- Bảo dưỡng:
  - `GET /api/maintenance`
  - `POST /api/maintenance` (admin/dispatcher)
  - `PUT /api/maintenance/:id` (admin/dispatcher)
  - `DELETE /api/maintenance/:id` (admin)
- Phí xe:
  - `GET /api/vehicle-fees`
  - `POST /api/vehicle-fees` (admin/accountant)
  - (khi tạo phí đăng kiểm/bảo hiểm → tự update expiry trong `vehicles`)
- Cảnh báo:
  - `GET /api/alerts/vehicle-expiry` (đăng kiểm/bảo hiểm 30 ngày, bảo dưỡng 15 ngày)

---

### 6.10 Dòng tiền (Cash flow – Phase 2.2)
UI:
- `public/js/phase2-features.js` → `window.renderCashFlow()`
- Dùng API consolidated để “tự tổng hợp” dữ liệu.

API backend:
- `GET /api/cash-flow/consolidated` (tổng hợp từ: payments, lương đã trả, nhiên liệu, bảo dưỡng, phí xe, trip_costs, tạm ứng, và các khoản nhập thủ công)

Quy ước dòng tiền (cash-basis):
- Các khoản `Chi hộ/Nẹo xe` không tự lấy từ trường `orders.chi_ho/neo_xe` (vì không có ngày chi thực tế).
- Nếu phát sinh chi hộ/nẹo xe, hãy nhập vào `trip_costs` (có `cost_date`) hoặc nhập Thu/Chi thủ công để lên dòng tiền đúng ngày.
- CRUD thu/chi thủ công:
  - `GET /api/cash-flow`
  - `GET /api/cash-flow/:id`
  - `POST /api/cash-flow` (admin/accountant)
  - `PUT /api/cash-flow/:id` (admin/accountant)
  - `DELETE /api/cash-flow/:id` (admin)

Migration liên quan:
- `migrate-cash-flow.js` thêm `transaction_group` + `category_details` để hỗ trợ ghi nhiều danh mục trong 1 giao dịch.

Xuất Excel:
- `GET /api/export/cash-flow` (admin/accountant)

---

### 6.11 Báo cáo chi phí vận hành (Expense reports – Phase 2.3)
UI:
- `public/js/phase3-features.js` → `window.renderExpenseReports()`

API backend:
- `GET /api/expense-reports`
- `GET /api/export/expense-reports` (admin/accountant/dispatcher)

Cách tính:
- Tổng hợp chi phí theo xe từ `fuel_records`, `vehicle_maintenance`, `vehicle_fees`.
- Phần lương tài xế được cộng thêm theo các tài xế đã từng chạy đơn của xe.

---

### 6.12 CRM & Báo giá (Phase 3)
UI:
- `public/js/phase3-features.js` → `window.renderCRM()`
- Tab Customers + Quotes.

API backend:
- Customers:
  - `GET /api/customers`
  - `GET /api/customers/:id`
  - `POST /api/customers` (admin/sales)
  - `PUT /api/customers/:id` (admin/sales)
- Quotes:
  - `GET /api/quotes` (nếu chưa có bảng `quotes` → trả `[]`)
  - `GET /api/quotes/:id`
  - `POST /api/quotes` (admin/sales)
  - `PUT /api/quotes/:id` (admin/sales, chỉ khi draft)
  - `PUT /api/quotes/:id/approve` (admin/sales)
  - `POST /api/quotes/:id/convert` (admin/sales)

Lưu ý:
- Tính năng chuyển báo giá → đơn hàng hiện có dấu hiệu đang dùng một “schema order” khác với phần Orders chính (đây là phần cần rà soát thêm nếu bạn dùng conversion thường xuyên).

---

### 6.13 Quản lý user
API backend:
- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `PUT /api/users/:id` (admin)
- `PUT /api/users/:id/password` (user tự đổi, hoặc admin đổi)
- `DELETE /api/users/:id` (admin)

---

### 6.14 Audit log & cảnh báo bất thường
File liên quan:
- `audit-logger.js`

Cách hoạt động:
- Nhiều API trong `server.js` gọi `logAudit(...)` khi tạo/sửa/xóa.
- `audit-logger.js` còn có `checkSuspiciousActivity()` để phát hiện hành vi nhạy cảm, ví dụ:
  - kế toán cố tạo/sửa đơn
  - điều độ cố xóa thanh toán
  - staff cố create/update/delete
  - xóa nhiều bản ghi trong thời gian ngắn
  - thanh toán số tiền lớn

Khi phát hiện, hệ thống ghi thêm bản ghi `security_alert` vào `audit_logs`.

API backend:
- `GET /api/audit-logs` (admin)

---

## 7) Xuất Excel (Excel export)

Các endpoint export trả về file `.xlsx`:
- `GET /api/export/fuel-records`
- `GET /api/export/cash-flow`
- `GET /api/export/expense-reports`

Implementation:
- `excel-export.js` dùng `exceljs` để dựng workbook, style header/title, format ngày/tiền.

---

## 8) Database & migrations

### File DB
- SQLite file: `freight.db` tại thư mục root.
- Repo đã `.gitignore` toàn bộ `*.db` (đúng để tránh commit dữ liệu thật).

### Khởi tạo DB
`server.js` gọi `initDatabase()` (từ `database.js`) khi start.

Lưu ý quan trọng:
- Code hiện tại có **nhiều bảng nghiệp vụ** (orders, vehicles, routes, trip_costs, driver_salaries, cash_flow, fuel_records, vehicle_maintenance, vehicle_fees, documents, driver_advances, audit_logs, quotes, …).
- `database.js` hiện chỉ tạo một số bảng cơ bản (và có phần “legacy” như `shipments`).

Vì vậy, trong thực tế bạn sẽ cần **schema đầy đủ** (thường là DB đã có sẵn trước đó) hoặc bổ sung script tạo schema đầy đủ.

### Các file migration đang có trong repo
- `migrate-add-fields.js`: thêm `orders.final_amount` và `customers.current_debt` + tính lại dữ liệu
- `migrate-fix-customers.js`: thêm cột cho customers (contact_person, customer_type, payment_terms, status)
- `migrate-cash-flow.js`: thêm `transaction_group`, `category_details`
- `migrate-improvements.js`: bổ sung nhiều field cho orders/drivers/vehicles/trip_costs

---

## 9) Cấu trúc thư mục (các file quan trọng)

- `server.js`: Express server + toàn bộ REST API
- `database.js`: SQLite connection + init admin/container seed
- `audit-logger.js`: audit log + security alerts
- `excel-export.js`: xuất Excel cho các báo cáo
- `public/index.html`: layout, sidebar menu
- `public/login.html`: màn hình login
- `public/js/app.js`: routing UI + các màn CRUD core
- `public/js/phase1-features.js`: module Lương
- `public/js/phase2-features.js`: Nhiên liệu + Dòng tiền
- `public/js/phase3-features.js`: Báo cáo chi phí + CRM/Báo giá
- `main.js`: Electron wrapper
- `preload.js`: expose API tối thiểu cho renderer

---

## 10) Ghi chú bảo mật / cấu hình

- `JWT_SECRET` đang được hardcode trong `server.js`. Khi triển khai thực tế, nên đưa vào biến môi trường và không commit secret.
- Password được hash bằng `bcryptjs`.
- Hệ thống có audit log và phát hiện một số hành vi bất thường.

---

## 11) Troubleshooting nhanh

### Không login được / lỗi 401
- Xóa `token` trong localStorage (hoặc bấm Đăng xuất) rồi login lại.

### Lỗi “no such table …”
- DB của bạn thiếu bảng mà API đang query.
- Cần restore DB đầy đủ hoặc bổ sung script tạo schema đầy đủ trước khi dùng.
# 🚛 HỆ THỐNG QUẢN LÝ VẬN CHUYỂN HÀNG HÓA

**Phần mềm quản lý toàn diện cho công ty vận chuyển container**  
*Ngọc Anh Transport - Freight Management System*

---

## 📋 MỤC LỤC

1. [Giới thiệu](#-giới-thiệu)
2. [Tính năng chính](#-tính-năng-chính)
3. [Công nghệ](#-công-nghệ)
4. [Cài đặt](#-cài-đặt)
5. [Sử dụng](#-hướng-dẫn-sử-dụng)
6. [Quy trình nghiệp vụ](#-quy-trình-nghiệp-vụ)
7. [Phân quyền](#-phân-quyền)
8. [Cấu trúc dữ liệu](#-cấu-trúc-dữ-liệu)
9. [Triển khai multi-user](#-triển-khai-multi-user)

---

## 🎯 GIỚI THIỆU

Hệ thống quản lý vận chuyển hàng hóa là ứng dụng desktop (Electron) được xây dựng theo quy trình nghiệp vụ chuẩn của ngành vận tải container, giúp doanh nghiệp:

- ✅ Quản lý đơn hàng và chuyến xe
- ✅ Theo dõi khách hàng và công nợ
- ✅ Quản lý tài xế, xe đầu kéo, container
- ✅ Tính toán chi phí và lợi nhuận chi tiết
- ✅ Quản lý tạm ứng và quyết toán tài xế
- ✅ Xuất báo cáo kế toán có VAT 10%
- ✅ Ghi nhật ký hoạt động đầy đủ
- ✅ Bảo mật với phân quyền 4 cấp

---

## 🌟 TÍNH NĂNG CHÍNH

### 1. **Quản lý Master Data**

#### 👥 Khách hàng
- Thông tin công ty (tên, MST, địa chỉ)
- Người liên hệ (tên, SĐT, email)
- Hạn mức công nợ
- Lịch sử giao dịch

#### 🚗 Tài xế
- Hồ sơ cá nhân (CMND, GPLX)
- Trạng thái hoạt động
- Lịch sử chuyến xe
- Quản lý tạm ứng

#### 🚛 Xe đầu kéo
- Biển số xe (VD: 51A-12345)
- Loại xe, trọng tải
- Hạn đăng kiểm/bảo hiểm
- Trạng thái sử dụng

#### 📦 Container (Rơ moóc)
- Số container (VD: 50E21256)
- Loại: 20ft, 40ft, 40HC, 45ft
- Trạng thái: Khả dụng/Đang dùng
- **Lưu ý:** Container là thùng hàng/rơ-moóc, không phải xe đầu kéo

#### 🛣️ Tuyến đường
- Điểm đi - Điểm đến
- Khoảng cách (km)
- Thời gian dự kiến

### 2. **Quản lý Đơn hàng / Chuyến xe**

#### Tạo đơn hàng
- Mã đơn hàng tự động/thủ công
- Gắn khách hàng, tuyến đường
- Mô tả hàng hóa, trọng lượng
- Giá cước vận chuyển
- Chi phí neo xe, chi hộ khách

#### Điều xe
- Gán container (rơ moóc)
- Gán xe đầu kéo
- Gán tài xế
- **Công thức:** 1 chuyến = 1 xe + 1 container + 1 tài xế

#### Theo dõi trạng thái
- ⏳ Chờ xử lý
- 🚚 Đang vận chuyển
- ✅ Hoàn thành

#### Tạm ứng tài xế ⭐
- Tạm ứng tiền trước khi xuất bến
- Dùng cho: dầu xe, cầu đường, bốc xếp
- Quyết toán sau khi hoàn thành
- Báo cáo tạm ứng chưa quyết toán

#### Quản lý chi phí
- **Dầu xe:** Chi phí nhiên liệu thực tế
- **Cầu đường:** BOT, phà
- **Bốc xếp:** Chi phí bốc/dỡ hàng
- **Chi phí khác:** Phát sinh

#### Tính lợi nhuận
```
Doanh thu = Giá cước + Neo xe + Chi hộ
Chi phí = Dầu xe + Cầu đường + Bốc xếp + Khác
Lợi nhuận = Doanh thu - Chi phí
```

#### Upload POD
- Chứng từ giao hàng (Proof of Delivery)
- Hỗ trợ: JPG, PNG, PDF
- Lưu trữ theo đơn hàng

### 3. **Kế toán & Thuế GTGT**

#### Công nợ khách hàng
- Theo dõi công nợ chi tiết theo từng đơn
- Tự động tính VAT 10%: (Giá + Neo xe + Chi hộ) × 1.1
- Lịch sử thanh toán đầy đủ

#### Thanh toán
- Ghi nhận thanh toán từng phần
- Nhiều phương thức: Tiền mặt, Chuyển khoản
- Cập nhật công nợ tự động
- Ghi log nhật ký

#### Xuất báo cáo
- **Phiếu xuất kho/bảng kê:** In hoặc xuất PDF
- **Sao kê công nợ:** Có VAT 10%, "Bằng chữ" hoàn toàn tiếng Việt
- **Bảng kê khách hàng:** 13 cột chuẩn với số xe
- **Chữ ký:** Tự động điền tên công ty + người liên hệ

### 4. **Báo cáo & Thống kê**

#### Dashboard tổng quan
- Tổng đơn hàng theo trạng thái
- Doanh thu tháng hiện tại
- Số lượng khách hàng
- Container khả dụng/đang sử dụng
- Biểu đồ doanh thu 6 tháng

#### Báo cáo theo xe (Container)
- Số chuyến của từng container
- Doanh thu từng xe
- Chi phí chi tiết (dầu, cầu đường, bốc xếp, khác)
- Lợi nhuận theo xe
- Tỷ suất lợi nhuận (%)

#### Báo cáo theo khách hàng
- Số đơn hàng
- Doanh thu tổng
- Công nợ hiện tại
- Lịch sử thanh toán

#### Lọc theo thời gian
- Ngày, tuần, tháng, quý, năm
- Khoảng thời gian tùy chỉnh

### 5. **Nhật ký hoạt động (Audit Logs)** 🔍

#### Ghi log toàn diện
- **Login:** Đăng nhập thành công/thất bại (với IP)
- **Users:** Tạo, sửa, xóa người dùng
- **Khách hàng:** Tạo, sửa, xóa, thanh toán
- **Đơn hàng:** Tạo, sửa, xóa (32 endpoints)
- **Chi phí:** Thêm, xóa chi phí
- **Tạm ứng:** Tạo, quyết toán, xóa
- **Tài xế, Xe, Container, Tuyến:** Mọi thay đổi

#### Tính năng
- Xem log với old_value và new_value
- Lọc theo ngày, user, action, entity
- Phát hiện hành vi bất thường:
  - Kế toán sửa đơn hàng → HIGH alert
  - Điều độ xóa thanh toán → HIGH alert
  - Staff thực hiện CUD → CRITICAL alert
  - Xóa hàng loạt ≥5 trong 5 phút → HIGH alert
  - Thanh toán >50M → MEDIUM alert

---

## 💻 CÔNG NGHỆ

### Backend
- **Node.js** 16+ (JavaScript runtime)
- **Express** 4.18.2 (Web framework)
- **SQLite3** 5.1.7 (Database - không cần cài đặt server)
- **JWT** (JSON Web Token - Authentication)
- **bcryptjs** (Mã hóa mật khẩu)

### Frontend
- **Electron** 39.2.7 (Desktop app framework)
- **HTML5, CSS3** (UI)
- **JavaScript** (Vanilla - không framework)

### Ưu điểm
- ✅ Không cần internet (hoạt động offline)
- ✅ Không cần cài database server
- ✅ Chạy như ứng dụng Windows thật
- ✅ Dễ triển khai, nhẹ (~100 MB)

---

## 🔧 CÀI ĐẶT

### **Phương án 1: Cài từ file installer (Khuyến nghị)**

#### Yêu cầu
- Windows 10/11 (64-bit)
- ~200 MB dung lượng trống

#### Các bước

**1. Build file installer (trên máy dev):**
```powershell
cd C:\Users\nguye\Downloads\21
npm install
npm run build
```
File installer sẽ được tạo tại:
```
C:\Users\nguye\Downloads\21\dist\FreightManager Setup 1.0.0.exe
```

**2. Cài đặt trên máy khách:**
- Copy file `.exe` qua USB/email/mạng
- Chạy file cài đặt
- Windows sẽ cảnh báo (app chưa có chữ ký số):
  - Click **"More info"** → **"Run anyway"**
- Chọn thư mục cài đặt → **Install**
- Khởi chạy và đăng nhập

**3. Vị trí sau khi cài:**
- App: `C:\Users\[User]\AppData\Local\Programs\freight-manager\`
- Database: `C:\Users\[User]\AppData\Roaming\freight-management-system\freight.db`

---

### **Phương án 2: Chạy từ source code (Development)**

#### Yêu cầu
- **Node.js** 16+ ([Tải tại đây](https://nodejs.org/))
- npm (đi kèm Node.js)

#### Các bước

**1. Clone/Download source code**
```powershell
cd C:\Users\nguye\Downloads\21
```

**2. Cài đặt dependencies**
```powershell
npm install
```

**3. Khởi động app (Electron)**
```powershell
npm run electron
```

Hoặc chạy riêng server + frontend:
```powershell
# Terminal 1: Chạy server
npm start

# Terminal 2: Mở Electron
npm run electron
```

---

### **Tài khoản mặc định**

Sau khi cài đặt/khởi động lần đầu, hệ thống tự động tạo:

| Username | Password | Vai trò |
|----------|----------|---------|
| `admin` | `admin123` | Quản trị viên (full quyền) |

**⚠️ Lưu ý:** Đổi mật khẩu ngay sau lần đăng nhập đầu tiên!

---

## 📖 HƯỚNG DẪN SỬ DỤNG

### 1. **Đăng nhập**
1. Khởi động ứng dụng
2. Nhập username: `admin`
3. Nhập password: `admin123`
4. Click **Đăng nhập**

### 2. **Tạo khách hàng**
1. Menu: **👥 Khách hàng** → **➕ Thêm khách hàng**
2. Điền thông tin:
   - Tên công ty
   - MST (Mã số thuế)
   - Địa chỉ
   - Người liên hệ, SĐT, Email
3. Click **Lưu**

### 3. **Tạo tài xế**
1. Menu: **🚗 Tài xế** → **➕ Thêm tài xế**
2. Điền: Tên, SĐT, GPLX, CMND
3. Click **Lưu**

### 4. **Tạo xe đầu kéo**
1. Menu: **🚛 Xe đầu kéo** → **➕ Thêm xe**
2. Nhập: Biển số (VD: 51A-12345), Loại xe
3. Click **Lưu**

### 5. **Thêm container**
1. Menu: **📦 Container** → **➕ Thêm container mới**
2. Nhập: Số container (VD: 50E21256)
3. Chọn loại: 20ft, 40ft, 40HC, 45ft
4. Click **Lưu**

### 6. **Tạo đơn hàng**
1. Menu: **📦 Đơn hàng** → **➕ Tạo đơn mới**
2. Chọn:
   - Khách hàng
   - Tuyến đường (Origin → Destination)
   - Container
   - Xe đầu kéo (nếu có)
   - Tài xế
3. Nhập:
   - Mô tả hàng, trọng lượng
   - Giá cước
   - Neo xe, Chi hộ (nếu có)
4. Click **Lưu**

### 7. **Tạm ứng tài xế**
1. Vào chi tiết đơn hàng
2. Phần **"Tạm ứng tài xế"** → Click **💰 Tạm ứng**
3. Nhập số tiền (VD: 5,000,000 đồng)
4. Ghi chú mục đích (VD: "Dầu xe + cầu đường")
5. Click **Tạm ứng**

### 8. **Quản lý chi phí**
1. Vào chi tiết đơn hàng
2. Click **➕ Thêm chi phí**
3. Chọn loại: Dầu xe / Cầu đường / Bốc xếp / Khác
4. Nhập số tiền
5. Click **Lưu**

### 9. **Quyết toán tạm ứng**
1. Vào chi tiết đơn hàng
2. Phần **"Tạm ứng tài xế"** → Click **Quyết toán**
3. Hệ thống so sánh:
   - Tạm ứng: 5,000,000
   - Chi phí thực tế: 4,500,000
   - **Chênh lệch:** +500,000 (thu hồi)
4. Xác nhận quyết toán

### 10. **Hoàn thành đơn hàng**
1. Click **Hoàn thành** trong chi tiết đơn
2. Upload POD (chứng từ giao hàng)
3. Trạng thái → ✅ **Hoàn thành**

### 11. **Thanh toán**
1. Menu: **💰 Kế toán & Thuế** → **Thanh toán**
2. Chọn khách hàng
3. Chọn đơn hàng cần thanh toán
4. Nhập số tiền
5. Chọn phương thức (Tiền mặt/Chuyển khoản)
6. Click **Lưu**

### 12. **Xuất báo cáo**
1. Vào chi tiết đơn hàng → **Xuất phiếu**
2. Hoặc: **💰 Kế toán & Thuế** → **Bảng kê khách hàng** → **In sao kê**
3. In trực tiếp hoặc **Ctrl+P** → Save as PDF

---

## 🔄 QUY TRÌNH NGHIỆP VỤ

### Luồng xử lý đơn hàng chuẩn

```
1. Khách hàng đặt hàng
   ↓
2. Tạo đơn hàng trong hệ thống
   - Chọn khách hàng
   - Chọn tuyến đường
   - Nhập mô tả hàng hóa, trọng lượng
   - Nhập giá cước, neo xe, chi hộ
   ↓
3. Điều xe
   - Gán container (rơ moóc)
   - Gán xe đầu kéo (nếu có)
   - Gán tài xế
   ↓
4. Tạm ứng cho tài xế (nếu cần)
   - Tiền dầu xe
   - Tiền cầu đường
   - Tiền bốc xếp
   ↓
5. Nhận container / Lấy hàng
   - Cập nhật ngày nhận hàng
   - Trạng thái: "Đang vận chuyển"
   ↓
6. Vận chuyển
   ↓
7. Giao hàng
   - Cập nhật ngày giao hàng
   - Upload POD (chứng từ giao hàng)
   - Trạng thái: "Hoàn thành"
   ↓
8. Quyết toán chuyến xe
   - Nhập chi phí thực tế: dầu, cầu đường, bốc xếp, khác
   - Quyết toán tạm ứng (thu hồi/bù thiếu)
   - Hệ thống tính lãi/lỗ tự động
   ↓
9. Xuất hóa đơn / Bảng kê cho khách hàng
   - In hoặc xuất PDF
   - Có VAT 10%, "Bằng chữ" tiếng Việt
   ↓
10. Khách hàng thanh toán
    - Ghi nhận thanh toán vào hệ thống
    - Công nợ tự động cập nhật
```

---

## 🔐 PHÂN QUYỀN

Hệ thống có **4 vai trò** với quyền hạn khác nhau:

### 1. **Admin (Quản trị viên)**
- ✅ Toàn quyền truy cập
- ✅ Quản lý người dùng
- ✅ Xem nhật ký hoạt động
- ✅ Cấu hình hệ thống
- ✅ Tạo/Sửa/Xóa tất cả dữ liệu

### 2. **Accountant (Kế toán)**
- ✅ Quản lý khách hàng
- ✅ Thanh toán, công nợ
- ✅ Xuất báo cáo kế toán
- ✅ Xem đơn hàng (không sửa/xóa)
- ❌ Không quản lý đơn hàng/tài xế/xe

### 3. **Dispatcher (Điều độ)**
- ✅ Quản lý đơn hàng
- ✅ Điều xe, gán tài xế
- ✅ Quản lý tài xế, xe, container
- ✅ Quản lý chi phí chuyến xe
- ❌ Không thanh toán, không xem công nợ

### 4. **Staff (Nhân viên)**
- ✅ Xem dữ liệu (read-only)
- ✅ Xem đơn hàng, khách hàng
- ❌ Không tạo/sửa/xóa bất kỳ dữ liệu nào

### Bảo mật
- 🔒 Mật khẩu mã hóa bcrypt
- 🔒 JWT token (24h hết hạn)
- 🔒 Middleware kiểm tra quyền trên mọi API
- 🔒 UI ẩn/hiện nút theo vai trò
- 🔒 403 error khi truy cập trái phép

Chi tiết xem file: [PHAN_QUYEN.md](PHAN_QUYEN.md)

---

## 📊 CẤU TRÚC DỮ LIỆU

### Database: SQLite3

File: `freight.db` (tự động tạo khi chạy lần đầu)

### Các bảng chính

#### 1. **users** (Người dùng)
- `id`, `username`, `password_hash`
- `fullname`, `role`, `email`
- `created_at`

#### 2. **customers** (Khách hàng)
- `id`, `company_name`, `tax_code`
- `address`, `contact_name`, `phone`, `email`
- `credit_limit`, `debt`

#### 3. **drivers** (Tài xế)
- `id`, `name`, `phone`
- `license_number`, `id_card`
- `status` (active/inactive)

#### 4. **vehicles** (Xe đầu kéo)
- `id`, `plate_number`, `vehicle_type`
- `capacity`, `status`
- `insurance_expiry`, `inspection_expiry`

#### 5. **containers** (Container/Rơ moóc)
- `id`, `container_number`
- `container_type` (20ft, 40ft, 40HC, 45ft)
- `status` (available/in-use)

#### 6. **routes** (Tuyến đường)
- `id`, `origin`, `destination`
- `distance_km`, `estimated_hours`

#### 7. **orders** (Đơn hàng)
- `id`, `order_number`, `customer_id`
- `route_id`, `container_id`, `vehicle_id`, `driver_id`
- `pickup_date`, `delivery_date`
- `cargo_description`, `weight`
- `price`, `neo_xe`, `chi_ho`
- `status` (pending/in-transit/completed)

#### 8. **costs** (Chi phí chuyến xe)
- `id`, `order_id`
- `cost_type` (fuel/toll/loading/other)
- `amount`, `description`

#### 9. **payments** (Thanh toán)
- `id`, `customer_id`, `order_id`
- `amount`, `payment_method`
- `payment_date`, `notes`

#### 10. **driver_advances** (Tạm ứng tài xế)
- `id`, `order_id`, `driver_id`
- `amount`, `advance_date`
- `settled` (0/1)
- `settled_date`, `notes`

#### 11. **documents** (POD - Chứng từ)
- `id`, `order_id`
- `filename`, `file_path`
- `uploaded_at`

#### 12. **audit_logs** (Nhật ký hoạt động)
- `id`, `user_id`, `username`, `role`
- `action` (login_success/create/update/delete)
- `entity` (orders/customers/payments...)
- `entity_id`, `old_value`, `new_value`
- `ip_address`, `created_at`

---

## 🌐 TRIỂN KHAI MULTI-USER

Hiện tại app chạy **standalone** (mỗi máy có database riêng). Để triển khai cho **3+ người dùng đồng thời**, có 3 phương án:

### **Phương án 1: Web App (Khuyến nghị)** ⭐

#### Mô hình
```
[Server máy chủ]
     │
     ├─ Node.js + Express (API)
     ├─ SQLite database
     │
     ▼
[Clients truy cập qua browser]
  - http://192.168.1.100:3000
  - Không cần cài đặt gì
```

#### Ưu điểm
- ✅ Dữ liệu tập trung, đồng bộ thời gian thực
- ✅ Không cần cài app trên máy client
- ✅ Dễ cập nhật (chỉ update server)
- ✅ An toàn trong mạng LAN

#### Các bước triển khai

**1. Máy chủ (Server):**
```powershell
# Cài đặt
npm install

# Chỉnh server.js để lắng nghe tất cả IP
# Tìm: app.listen(3000, 'localhost'...
# Đổi thành: app.listen(3000, '0.0.0.0'...

# Khởi động
npm start
```

**2. Cấu hình Firewall:**
```powershell
# Mở port 3000
netsh advfirewall firewall add rule name="Freight Management" dir=in action=allow protocol=TCP localport=3000
```

**3. Máy client:**
- Mở trình duyệt
- Truy cập: `http://[IP-máy-chủ]:3000`
- Đăng nhập bình thường

#### Chi phí
- **FREE** (dùng máy tính hiện có)
- Thời gian: 1 ngày setup

Chi tiết xem file: [HUONG_DAN_MULTI_USER.md](HUONG_DAN_MULTI_USER.md)

---

## 📁 CẤU TRÚC PROJECT

```
freight-management-system/
│
├── main.js                 # Electron main process
├── preload.js              # Electron preload script
├── server.js               # Express API server (1806 lines)
├── database.js             # SQLite connection & schema
├── create-db.js            # Database initialization
├── audit-logger.js         # Audit logging module (196 lines)
│
├── public/                 # Frontend files
│   ├── index.html          # Main app page
│   ├── login.html          # Login page
│   ├── css/
│   │   └── style.css       # Styles
│   └── js/
│       └── app.js          # Frontend logic (4124 lines)
│
├── package.json            # Dependencies & scripts
├── README.md               # This file
├── HUONG_DAN_MULTI_USER.md # Multi-user deployment guide
├── PHAN_QUYEN.md           # Permission system details
│
└── dist/                   # Build output (after npm run build)
    └── FreightManager Setup 1.0.0.exe
```

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### 1. **Lỗi: "Cannot find module 'sqlite3'"**
```powershell
# Cài lại dependencies
npm install
```

### 2. **Lỗi: "Port 3000 already in use"**
```powershell
# Tìm process đang dùng port
netstat -ano | findstr :3000

# Kill process (thay <PID> bằng số process)
taskkill /PID <PID> /F
```

### 3. **Lỗi: "Token expired" khi đăng nhập**
- Token JWT hết hạn sau 24h
- Đăng xuất và đăng nhập lại

### 4. **Database bị lỗi/corrupt**
```powershell
# Xóa database cũ (tạo lại từ đầu)
Remove-Item "$env:APPDATA\freight-management-system\freight.db" -Force

# Khởi động lại app
npm run electron
```

### 5. **Container không xóa được**
- Container đang được gán vào đơn hàng
- Kiểm tra: Menu → **Đơn hàng** → Tìm đơn có container đó
- Xóa đơn hàng trước, sau đó xóa container

### 6. **Số tiền "Bằng chữ" không hiển thị**
- Đảm bảo đã update code mới nhất
- Khởi động lại app
- Kiểm tra: Xuất phiếu → Phần "Bằng chữ" phải hoàn toàn tiếng Việt

### 7. **Không thấy nhật ký hoạt động**
- Chỉ **admin** mới thấy menu "📋 Nhật ký hoạt động"
- Đăng nhập bằng tài khoản `admin`

---

## 🔄 CẬP NHẬT & BẢO TRÌ

### Backup Database
```powershell
# Vị trí database
$dbPath = "$env:APPDATA\freight-management-system\freight.db"

# Backup
Copy-Item $dbPath "C:\Backup\freight-$(Get-Date -Format 'yyyy-MM-dd').db"
```

### Update Code
```powershell
# Pull code mới (nếu dùng Git)
git pull

# Cài dependencies mới (nếu có)
npm install

# Rebuild app
npm run build
```

### Reset Database (⚠️ Mất dữ liệu)
```powershell
# Xóa database cũ
Remove-Item "$env:APPDATA\freight-management-system\freight.db" -Force

# Khởi động lại → Tạo database mới với tài khoản admin mặc định
npm run electron
```

---

## 📞 THÔNG TIN LIÊN HỆ

**NGỌC ANH TRANSPORT**  
📍 Địa chỉ: B7/22B Khuất Văn Bức  
🏢 MST: 0317568930  
🏦 Ngân hàng: Sacombank  
💳 STK: 0500780826263  
👤 Chủ TK: TRẦN NGỌC TIẾN

---

## 📄 LICENSE

**ISC License**

Copyright (c) 2025 Ngọc Anh Transport

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.

---

## 🎉 HOÀN THÀNH

✅ Hệ thống đã sẵn sàng triển khai!  
✅ Tài liệu đầy đủ, dễ sử dụng  
✅ Bảo mật, nhật ký đầy đủ  
✅ Hỗ trợ multi-user

**Chúc bạn sử dụng hiệu quả!** 🚛📦
