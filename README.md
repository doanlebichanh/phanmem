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

## Mục lục

- [1) Kiến trúc & công nghệ](#1-kiến-trúc--công-nghệ)
- [2) Chạy dự án (local)](#2-chạy-dự-án-local)
- [3) Tài khoản & đăng nhập](#3-tài-khoản--đăng-nhập)
- [4) Phân quyền (roles) & nguyên tắc truy cập](#4-phân-quyền-roles--nguyên-tắc-truy-cập)
- [5) Điều hướng UI (các trang chính)](#5-điều-hướng-ui-các-trang-chính)
- [6) Tính năng & cách triển khai (theo module)](#6-tính-năng--cách-triển-khai-theo-module)
- [7) Xuất Excel/PDF](#7-xuất-excelpdf)
- [8) Database & migrations](#8-database--migrations)
- [9) Cấu trúc thư mục](#9-cấu-trúc-thư-mục-các-file-quan-trọng)
- [10) Ghi chú bảo mật / cấu hình](#10-ghi-chú-bảo-mật--cấu-hình)
- [11) Troubleshooting nhanh](#11-troubleshooting-nhanh)
- [12) Triển khai nhiều máy (LAN)](#12-triển-khai-nhiều-máy-lan)
- [13) Tài liệu hướng dẫn](#13-tài-liệu-hướng-dẫn)

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

## 7) Xuất Excel/PDF

### Excel (server-side)

Các endpoint export trả về file `.xlsx`:
- `GET /api/export/fuel-records`
- `GET /api/export/cash-flow`
- `GET /api/export/expense-reports`
- `GET /api/export/quotes/:id/excel`

Implementation:
- `excel-export.js` dùng `exceljs` để dựng workbook, style header/title, format ngày/tiền.

### PDF

Hiện tại PDF được triển khai theo hướng **In → Save as PDF** (từ trình duyệt/Electron), phù hợp chạy offline và không cần thêm thư viện render PDF.

Các chức năng đã có luồng in/PDF:
- Bảng kê / phiếu (từ trang chi tiết đơn hàng)
- Sao kê khách hàng (Customer Statement)
- Báo giá: In / Save as PDF (kèm khối chữ ký)

Ghi chú:
- Nhiều màn hình nhập liệu hiện **chưa có nút export Excel/PDF** theo danh sách (sẽ bổ sung theo từng module nếu bạn muốn “export mọi màn nhập liệu”).

---

## 8) Database & migrations

### Vị trí file database (quan trọng khi build/cài đặt)

- Khi chạy dev trong source: DB nằm tại `freight.db` ngay trong thư mục dự án.
- Khi chạy bản Desktop (Electron build/cài đặt): DB sẽ được đặt trong thư mục userData của Windows (Roaming AppData), để **không bị mất khi update** và **có quyền ghi**.
  - Thường là: `C:\Users\<user>\AppData\Roaming\FreightManager\freight.db` (tuỳ theo tên app).

Bạn có thể override đường dẫn bằng biến môi trường:
- `FREIGHT_DB_PATH`: chỉ định full path file `.db`
- `FREIGHT_DB_DIR`: chỉ định thư mục chứa DB (sẽ tạo `freight.db` bên trong)

### Backup dữ liệu (Windows)

Khuyến nghị: đóng app trước khi backup.

Ghi chú (bản Desktop): trong app có nút **Backup/Restore** và có thể bật **tự động backup**.
- Tự động backup chỉ chạy khi ứng dụng đang mở.
- Chỉ tạo backup khi DB có thay đổi so với lần backup trước.
- Cơ chế giữ bản: luôn giữ **5** bản gần nhất + giữ thêm **12** bản theo tháng (12 tháng gần nhất).

Script có sẵn: `tools/backup-freight-db.ps1`

Ví dụ backup từ ổ C sang ổ D (tạo thư mục backup theo timestamp):

```powershell
cd D:\APP\NGOCANH\phanmem
powershell -ExecutionPolicy Bypass -File tools\backup-freight-db.ps1 -DestDir "D:\FreightManager_Backups" -Zip
```

Nếu DB nằm ở vị trí khác, truyền rõ nguồn:

```powershell
powershell -ExecutionPolicy Bypass -File tools\backup-freight-db.ps1 -SourcePath "C:\Users\<user>\AppData\Roaming\FreightManager\freight.db" -DestDir "D:\FreightManager_Backups"
```

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

---

## 12) Triển khai nhiều máy (LAN)

Mặc định app chạy local trên 1 máy. Nếu muốn nhiều máy trong cùng mạng LAN truy cập chung:

1) Cho server lắng nghe tất cả IP (ví dụ `0.0.0.0`).
2) Mở port firewall (TCP 3000).
3) Máy client truy cập bằng IP máy chủ: `http://<IP-MAY-CHU>:3000`.

Gợi ý:
- Nên dùng 1 máy làm “server máy chủ” (chứa DB) để dữ liệu tập trung.
- Nếu triển khai LAN, cân nhắc backup định kỳ file `freight.db`.

---

## 13) Tài liệu hướng dẫn

- Hướng dẫn Thu/Chi: xem [HUONG_DAN_THU_CHI.md](HUONG_DAN_THU_CHI.md)
- Hướng dẫn Lương: xem [HUONG_DAN_LUONG.md](HUONG_DAN_LUONG.md)

Nếu bạn muốn mình bổ sung thêm tài liệu “quy trình nghiệp vụ” dạng ngắn gọn theo đúng flow của app hiện tại, nói mình biết các màn bạn dùng thường xuyên nhất.
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
