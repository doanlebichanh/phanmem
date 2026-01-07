# HỆ THỐNG QUẢN LÝ VẬN CHUYỂN HÀNG HÓA
## Hướng Dẫn Tổng Hợp Chi Tiết

**Phiên bản:** 1.0.0  
**Ngày cập nhật:** January 6, 2025  
**Tác giả:** Ngọc Anh Transport  
**Trạng thái:** ✅ Hoàn chỉnh - Sẵn sàng sản xuất

---

## 📋 MỤC LỤC

1. [Tổng quan hệ thống](#tổng-quan)
2. [Kiến trúc kỹ thuật](#kiến-trúc)
3. [Database schema](#database)
4. [APIs và Endpoints](#apis)
5. [Features - Phase 1](#features-phase-1)
6. [Features - Phase 2](#features-phase-2)
7. [Features - Phase 3](#features-phase-3)
8. [Hệ thống phân quyền](#phân-quyền)
9. [Hướng dẫn sử dụng](#hướng-dẫn)
10. [Deployment & Maintenance](#deployment)
11. [Xử lý lỗi và khắc phục](#troubleshooting)

---

## <a name="tổng-quan"></a>1. TỔNG QUAN HỆ THỐNG

### 1.1 Mô Tả

Hệ thống quản lý vận chuyển hàng hóa toàn diện dành cho công ty vận tải. Gồm các module quản lý:
- **Đơn hàng & Công việc**: Tiếp nhận, giao phó, theo dõi tình trạng
- **Tài xế & Xe**: Quản lý nhân sự, xe cộ, giấy tờ, bảo dưỡng
- **Tài chính**: Dòng tiền, chi phí, lương, thanh toán
- **CRM**: Khách hàng, báo giá, chuyên đơn hàng
- **Báo cáo**: Nhiên liệu, chi phí, dòng tiền, lợi nhuận

### 1.2 Đặc Điểm Chính

| Tính năng | Mô tả |
|-----------|-------|
| **Multi-user** | Hỗ trợ 5 roles với quyền khác nhau |
| **Desktop App** | Electron - chạy trên Windows 10/11 |
| **Database** | SQLite3 - nhúng trong ứng dụng |
| **Export** | Excel (.xlsx) cho tất cả báo cáo |
| **Audit Log** | Ghi nhật ký tất cả thao tác |
| **Dashboard** | Thống kê realtime, biểu đồ |
| **Mobile Ready** | API cho phát triển mobile sau |

### 1.3 Stack Công Nghệ

```
Frontend: HTML5, CSS3, Vanilla JavaScript
Backend: Node.js + Express.js 4.18.2
Database: SQLite3 5.1.7
Desktop: Electron 39.2.7
Excel: ExcelJS 4.3.0
Security: JWT + bcryptjs
```

---

## <a name="kiến-trúc"></a>2. KIẾN TRÚC KỸ THUẬT

### 2.1 Sơ Đồ Kiến Trúc

```
┌─────────────────────────────────────────────────────┐
│           ELECTRON DESKTOP APP                      │
│  (main.js - Quản lý cửa sổ, preload.js)            │
└───────────┬─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│         EXPRESS.JS API SERVER (server.js)           │
│  - Port: 3000                                       │
│  - Authentication: JWT                              │
│  - Role-based Access Control                        │
└───────────┬─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────┐
│     SQLITE3 DATABASE (freight.db)                   │
│  - Location: AppData\Roaming\freight-management     │
│  - 15 bảng chính + bảng phụ                        │
│  - Foreign keys enabled                             │
└─────────────────────────────────────────────────────┘
```

### 2.2 Cấu Trúc Thư Mục

```
21/
├── main.js                    # Electron main process
├── preload.js                 # Electron preload script
├── server.js                  # Express.js API server (3300+ dòng)
├── database.js                # SQLite initialization (481 dòng)
├── excel-export.js            # Excel export functions (481 dòng)
├── audit-logger.js            # Audit logging
├── app.js                      # Setup app
│
├── public/                     # Frontend
│   ├── index.html             # Main dashboard
│   ├── login.html             # Login page
│   ├── style.css              # Global styles
│   ├── app-main.js            # Main app JS
│   ├── js/
│   │   ├── app.js             # App initialization (4187 dòng)
│   │   ├── phase1-features.js # Phase 1 UI (2500+ dòng)
│   │   ├── phase2-features.js # Phase 2 UI (843 dòng)
│   │   └── phase3-features.js # Phase 3 UI (772 dòng)
│   └── css/
│       └── style.css          # Styles
│
├── package.json               # Dependencies
├── HUONG_DAN_*.md            # Documentation files
└── freight.db                 # SQLite database (runtime)
```

### 2.3 Luồng Dữ Liệu

```
User Action (UI)
    ↓
JavaScript Event Handler
    ↓
API Call (with JWT Token)
    ↓
Express Route Handler
    ↓
Authentication Check
    ↓
Role-based Authorization
    ↓
Database Query
    ↓
Audit Logging
    ↓
Response JSON
    ↓
Frontend Update
```

---

## <a name="database"></a>3. DATABASE SCHEMA

### 3.1 Bảng Chính (15 bảng)

#### A. Quản Lý Người Dùng
```sql
users (id, username, password, fullname, role, status, created_at)
```
- Roles: admin, accountant, dispatcher, sales, staff
- Mật khẩu bcrypt hash, JWT token

#### B. Quản Lý Tài Xế & Xe
```sql
drivers (id, name, phone, license_number, id_number, status, ...)
vehicles (id, plate_number, vehicle_type, capacity, status, ...)
containers (id, container_number, status, current_location)
```

#### C. Tuyến Đường & Giá Cước
```sql
routes (id, route_name, origin, destination, distance_km, ...)
pricing (id, route_id, customer_id, price, effective_from/to)
```

#### D. Đơn Hàng & Chi Phí
```sql
orders (id, order_code, customer_id, vehicle_id, driver_id, status, ...)
trip_costs (id, order_id, cost_type, amount, fuel_liters, ...)
```

#### E. Thanh Toán & Tạm Ứng
```sql
payments (id, order_id, customer_id, amount, payment_date, ...)
driver_advances (id, order_id, driver_id, amount, settled, ...)
```

#### F. Tài Liệu & Chứng từ
```sql
documents (id, order_id, document_type, file_path)
```

#### G. Lương & Thưởng Phạt
```sql
driver_salaries (id, driver_id, salary_month, base_salary, trip_bonus, ...)
driver_bonuses_penalties (id, driver_id, date, type, amount, ...)
```

#### H. Bảo Dưỡng & Phí Xe
```sql
vehicle_maintenance (id, vehicle_id, maintenance_type, cost, ...)
vehicle_fees (id, vehicle_id, fee_type, amount, valid_from/to)
```

#### I. Phase 2 - Tài Chính
```sql
fuel_records (id, vehicle_id, fuel_date, liters, price_per_liter, ...)
cash_flow (id, transaction_date, type, category, amount, ...)
```

#### J. Phase 3 - CRM
```sql
customers (id, company_name, contact_person, phone, email, ...)
quotes (id, quote_number, customer_id, total_amount, status, ...)
notifications (id, user_id, type, message, is_read)
```

#### K. Tracking & Logs
```sql
gps_locations (id, vehicle_id, latitude, longitude, timestamp)
audit_logs (id, user_id, action, entity, old_value, new_value)
```

### 3.2 Mối Quan Hệ

```
users
  ├── audit_logs
  ├── driver_salaries
  └── (created_by)

drivers
  ├── orders
  ├── driver_salaries
  ├── driver_bonuses_penalties
  └── driver_advances

vehicles
  ├── orders
  ├── fuel_records
  ├── vehicle_maintenance
  ├── vehicle_fees
  └── gps_locations

orders
  ├── trip_costs
  ├── payments
  ├── driver_advances
  ├── documents
  ├── quotes (converted_order_id)
  └── cash_flow

customers
  ├── orders
  ├── quotes
  └── pricing
```

---

## <a name="apis"></a>4. APIs VÀ ENDPOINTS

### 4.1 Tổng Quan API

**Base URL:** `http://localhost:3000/api`  
**Authentication:** JWT Bearer Token (header: `Authorization: Bearer {token}`)  
**Format:** JSON (Content-Type: application/json)

### 4.2 Danh Sách Endpoints (93 endpoints)

#### Authentication (1)
```
POST   /auth/login                  - Đăng nhập
```

#### User Management (5)
```
GET    /users                       - Lấy danh sách users
POST   /users                       - Tạo user mới
PUT    /users/:id                   - Cập nhật user
PUT    /users/:id/password          - Đổi mật khẩu
DELETE /users/:id                   - Xóa user
```

#### Driver Management (5)
```
GET    /drivers                     - Lấy danh sách tài xế
GET    /drivers/:id                 - Chi tiết tài xế
POST   /drivers                     - Thêm tài xế
PUT    /drivers/:id                 - Cập nhật tài xế
DELETE /drivers/:id                 - Xóa tài xế
```

#### Vehicle Management (5)
```
GET    /vehicles                    - Lấy danh sách xe
POST   /vehicles                    - Thêm xe
PUT    /vehicles/:id                - Cập nhật xe
DELETE /vehicles/:id                - Xóa xe
GET    /alerts/vehicle-expiry       - Cảnh báo xe hết hạn
```

#### Container Management (3)
```
GET    /containers                  - Danh sách container
PUT    /containers/:id              - Cập nhật container
POST   /containers                  - Thêm container
DELETE /containers/:id              - Xóa container
```

#### Route Management (5)
```
GET    /routes                      - Danh sách tuyến
POST   /routes                      - Thêm tuyến
PUT    /routes/:id                  - Cập nhật tuyến
DELETE /routes/:id                  - Xóa tuyến
GET    /pricing                     - Giá cước
```

#### Order Management (9)
```
GET    /orders                      - Danh sách đơn hàng
GET    /orders/:id                  - Chi tiết đơn hàng
POST   /orders                      - Tạo đơn hàng
PUT    /orders/:id                  - Cập nhật đơn hàng
DELETE /orders/:id                  - Xóa đơn hàng
GET    /orders/:orderId/costs       - Chi phí chuyến
POST   /orders/:orderId/costs       - Thêm chi phí
DELETE /costs/:id                   - Xóa chi phí
```

#### Payment & Advance (9)
```
GET    /orders/:orderId/payments    - Thanh toán đơn hàng
POST   /orders/:orderId/payments    - Ghi nhận thanh toán
DELETE /payments/:id                - Xóa thanh toán
GET    /orders/:orderId/advances    - Tạm ứng đơn hàng
GET    /drivers/:driverId/advances  - Tạm ứng tài xế
POST   /orders/:orderId/advances    - Thêm tạm ứng
PUT    /advances/:id/settle         - Thanh toán tạm ứng
DELETE /advances/:id                - Xóa tạm ứng
GET    /reports/unsettled-advances  - Tạm ứng chưa thanh toán
```

#### Salary Management (9)
```
GET    /salaries                    - Lương tài xế
POST   /salaries/calculate          - Tính toán lương
POST   /salaries                    - Lưu lương
PUT    /salaries/:id                - Cập nhật lương
PUT    /salaries/:id/update-details - Cập nhật chi tiết lương
DELETE /salaries/:id                - Xóa lương
GET    /salaries/:id                - Chi tiết lương
GET    /bonuses-penalties           - Thưởng/phạt
POST   /bonuses-penalties           - Thêm thưởng/phạt
DELETE /bonuses-penalties/:id       - Xóa thưởng/phạt
```

#### Maintenance & Fees (8)
```
GET    /maintenance                 - Bảo dưỡng xe
POST   /maintenance                 - Thêm bảo dưỡng
PUT    /maintenance/:id             - Cập nhật bảo dưỡng
DELETE /maintenance/:id             - Xóa bảo dưỡng
GET    /vehicle-fees                - Phí xe
POST   /vehicle-fees                - Thêm phí
DELETE /vehicle-fees/:id            - Xóa phí
```

#### Fuel Management (5)
```
GET    /fuel-records                - Nhiên liệu
GET    /fuel-records/stats          - Thống kê nhiên liệu
GET    /fuel-records/:id            - Chi tiết
POST   /fuel-records                - Thêm mới
PUT    /fuel-records/:id            - Cập nhật
DELETE /fuel-records/:id            - Xóa
```

#### Cash Flow (5)
```
GET    /cash-flow                   - Dòng tiền
GET    /cash-flow/:id               - Chi tiết
POST   /cash-flow                   - Thêm mới
PUT    /cash-flow/:id               - Cập nhật
DELETE /cash-flow/:id               - Xóa
```

#### Reports & Export (9)
```
GET    /expense-reports             - Báo cáo chi phí (JSON)
GET    /reports/overview            - Dashboard tổng quan
GET    /reports/customers           - Báo cáo khách hàng
GET    /reports/containers          - Báo cáo container
GET    /reports/costs-by-type       - Chi phí theo loại
GET    /reports/profit-by-order     - Lợi nhuận từng đơn
GET    /export/fuel-records         - Export nhiên liệu (Excel)
GET    /export/cash-flow            - Export dòng tiền (Excel)
GET    /export/expense-reports      - Export chi phí (Excel)
```

#### Document Management (4)
```
GET    /orders/:orderId/documents   - Chứng từ đơn hàng
POST   /orders/:orderId/documents   - Upload chứng từ
DELETE /documents/:id               - Xóa chứng từ
GET    /documents/:id/download      - Download chứng từ
```

#### CRM Management (9)
```
GET    /customers                   - Danh sách khách hàng
GET    /customers/:id               - Chi tiết khách hàng
POST   /customers                   - Thêm khách hàng
PUT    /customers/:id               - Cập nhật khách hàng
GET    /quotes                      - Danh sách báo giá
GET    /quotes/:id                  - Chi tiết báo giá
POST   /quotes                      - Tạo báo giá
PUT    /quotes/:id                  - Cập nhật báo giá
PUT    /quotes/:id/approve          - Phê duyệt báo giá
POST   /quotes/:id/convert          - Chuyển báo giá thành đơn
```

#### Audit & Admin (1)
```
GET    /audit-logs                  - Ghi nhật ký (Admin only)
```

### 4.3 Ví Dụ API Calls

#### Login
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullname": "Quản trị viên",
    "role": "admin"
  }
}
```

#### Lấy danh sách đơn hàng
```bash
GET /api/orders
Headers: Authorization: Bearer {token}

Response:
[
  {
    "id": 1,
    "order_code": "DH001",
    "customer_id": 1,
    "vehicle_id": 1,
    "driver_id": 1,
    "order_date": "2025-12-01",
    "status": "completed",
    ...
  },
  ...
]
```

#### Tạo đơn hàng mới
```bash
POST /api/orders
Headers: Authorization: Bearer {token}
{
  "order_code": "DH002",
  "customer_id": 1,
  "vehicle_id": 1,
  "driver_id": 1,
  "route_id": 1,
  "order_date": "2025-12-05",
  "price": 5000000,
  "status": "pending"
}
```

---

## <a name="features-phase-1"></a>5. FEATURES - PHASE 1 (Cơ Bản)

### 5.1 Quản Lý Đơn Hàng
- ✅ Tạo/sửa/xóa đơn hàng
- ✅ Ghi nhận chi phí chuyến (nhiên liệu, phí)
- ✅ Thanh toán từ khách hàng
- ✅ Tạm ứng tài xế
- ✅ Thanh toán tạm ứng
- ✅ Tìm kiếm/lọc đơn hàng
- ✅ Dashboard tổng quan

**Bảng:** orders, trip_costs, payments, driver_advances

### 5.2 Quản Lý Tài Xế
- ✅ Thêm/sửa/xóa tài xế
- ✅ Lưu trữ giấy phép, căn cước
- ✅ Theo dõi trạng thái (active/inactive)
- ✅ Ghi chú thông tin liên hệ

**Bảng:** drivers

### 5.3 Quản Lý Xe Cộ
- ✅ Quản lý xe đầu kéo
- ✅ Theo dõi giấy tờ (đăng kiểm, bảo hiểm)
- ✅ Cảnh báo hết hạn
- ✅ Quản lý container (rơ moóc)
- ✅ Bảo dưỡng xe (lịch sử)
- ✅ Phí xe (đăng kiểm, bảo hiểm, thuế)

**Bảng:** vehicles, containers, vehicle_maintenance, vehicle_fees

### 5.4 Quản Lý Tuyến Đường & Giá Cước
- ✅ Lập tuyến đường (origin, destination)
- ✅ Quản lý giá cước theo tuyến
- ✅ Giá theo khách hàng
- ✅ Giá theo loại container

**Bảng:** routes, pricing

### 5.5 Quản Lý Lương Tài Xế
- ✅ Tính lương hàng tháng
- ✅ Lương cơ bản + thưởng chuyến
- ✅ Tăng ca + thanh toán
- ✅ Kế toán các khoản ứng
- ✅ Thưởng/phạt tài xế

**Bảng:** driver_salaries, driver_bonuses_penalties

### 5.6 Quản Lý Người Dùng
- ✅ Tạo/sửa/xóa user
- ✅ Phân quyền theo role
- ✅ Đổi mật khẩu
- ✅ Khóa/mở khóa user

**Bảng:** users

### 5.7 Báo Cáo Cơ Bản
- ✅ Tổng quan hôm nay
- ✅ Doanh thu/chi phí
- ✅ Danh sách khách hàng
- ✅ Danh sách container
- ✅ Lợi nhuận từng đơn

**Files:** phase1-features.js (2500+ dòng)

---

## <a name="features-phase-2"></a>6. FEATURES - PHASE 2 (Tài Chính Nâng Cao)

### 6.1 Quản Lý Nhiên Liệu (⛽ Nhiên liệu)
- ✅ Ghi nhận chi tiêu nhiên liệu
- ✅ Tính toán lít/km tiêu hao
- ✅ So sánh tiêu hao xe
- ✅ Thống kê theo tháng/năm
- ✅ Theo dõi trạm xăng
- ✅ **Export Excel** với định dạng chuyên nghiệp

**Bảng:** fuel_records

**API:**
```
GET    /api/fuel-records            - Danh sách nhiên liệu
GET    /api/fuel-records/stats      - Thống kê
POST   /api/fuel-records            - Thêm mới
PUT    /api/fuel-records/:id        - Cập nhật
DELETE /api/fuel-records/:id        - Xóa
GET    /api/export/fuel-records     - Export Excel
```

**Excel Export Fields:**
```
STT | Ngày | Xe | Loại nhiên liệu | Số lít | Giá/lít | Tổng tiền | Số Km | Trạm xăng | Ghi chú
```

### 6.2 Dòng Tiền (💰 Dòng tiền)
- ✅ Ghi nhận thu/chi
- ✅ Phân loại chi tiêu (lương, nhiên liệu, phí, bảo dưỡng)
- ✅ Theo dõi nguồn (đơn hàng, tài xế, xe)
- ✅ Dashboard dòng tiền realtime
- ✅ Biểu đồ thu/chi theo thời gian
- ✅ **Export Excel** với tóm tắt tài chính

**Bảng:** cash_flow

**API:**
```
GET    /api/cash-flow               - Danh sách giao dịch
GET    /api/cash-flow/:id           - Chi tiết
POST   /api/cash-flow               - Thêm mới
PUT    /api/cash-flow/:id           - Cập nhật
DELETE /api/cash-flow/:id           - Xóa
GET    /api/export/cash-flow        - Export Excel
```

**Excel Export Fields:**
```
Ngày | Loại | Danh mục | Số tiền | Mô tả | Liên kết | Phương thức | Ghi chú
(Bảng tóm tắt: Tổng thu, Tổng chi, Chênh lệch)
```

### 6.3 Báo Cáo Chi Phí Vận Hành (📊 Chi phí)
- ✅ Tổng hợp chi phí từ 4 nguồn:
  - Nhiên liệu (fuel_records)
  - Bảo dưỡng (vehicle_maintenance)
  - Phí xe (vehicle_fees)
  - Lương tài xế (driver_salaries - liên kết qua orders)
- ✅ Chi phí tính theo xe
- ✅ Tính theo khoảng thời gian
- ✅ **Export Excel** chi tiết từng hạng mục

**API:**
```
GET    /api/expense-reports         - Báo cáo chi phí (JSON)
GET    /api/export/expense-reports  - Export Excel
```

**Excel Export Fields:**
```
Xe | Nhiên liệu | Bảo dưỡng | Phí xe | Lương TX | Tổng | % Tổng
(Query tính tổng từ 4 bảng khác nhau, kết hợp qua bảng orders)
```

**Files:** 
- phase2-features.js (843 dòng)
- excel-export.js (481 dòng)

---

## <a name="features-phase-3"></a>7. FEATURES - PHASE 3 (CRM & Nâng Cao)

### 7.1 Quản Lý Khách Hàng (👥 CRM)
- ✅ Thêm/sửa/xóa khách hàng
- ✅ Lưu trữ công ty, MST, liên hệ
- ✅ Lịch sử giao dịch
- ✅ Hạn mức tín dụng
- ✅ Điều khoản thanh toán

**Bảng:** customers

**API:**
```
GET    /api/customers               - Danh sách khách
POST   /api/customers               - Thêm khách
PUT    /api/customers/:id           - Cập nhật khách
GET    /api/customers/:id           - Chi tiết khách
```

### 7.2 Báo Giá & Chuyên Đơn (📄 Báo giá)
- ✅ Tạo báo giá từ tuyến/container
- ✅ Định giá uốn theo khách
- ✅ Tính thuế/chiết khấu
- ✅ Phê duyệt báo giá
- ✅ Chuyển báo giá thành đơn hàng
- ✅ Lịch sử báo giá

**Bảng:** quotes

**API:**
```
GET    /api/quotes                  - Danh sách báo giá
GET    /api/quotes/:id              - Chi tiết báo giá
POST   /api/quotes                  - Tạo báo giá
PUT    /api/quotes/:id              - Cập nhật
PUT    /api/quotes/:id/approve      - Phê duyệt
POST   /api/quotes/:id/convert      - Chuyển đơn hàng
```

### 7.3 Thông Báo Hệ Thống (🔔 Thông báo)
- ✅ Thông báo hạn bảo hiểm/đăng kiểm
- ✅ Thông báo đơn hàng mới
- ✅ Thông báo lương chưa trả
- ✅ Thông báo tạm ứng chưa thanh toán
- ✅ Đánh dấu đã đọc

**Bảng:** notifications

### 7.4 GPS Tracking (Optional) 🛰️
- 🔲 Giám sát vị trí xe realtime
- 🔲 Lịch sử di chuyển
- 🔲 Playback lộ trình
- 🔲 Cảnh báo xe quá tốc độ

**Bảng:** gps_locations

**Files:** phase3-features.js (772 dòng)

---

## <a name="phân-quyền"></a>8. HỆ THỐNG PHÂN QUYỀN

### 8.1 Các Role Trong Hệ Thống

| Role | Mô tả | Quyền |
|------|-------|-------|
| **admin** | Quản trị viên | Truy cập toàn bộ, quản lý user, xem audit log |
| **accountant** | Kế toán | Quản lý lương, tài chính, thanh toán, export |
| **dispatcher** | Điều độ | Tạo đơn, giao phó tài xế, quản lý xe, chi phí |
| **sales** | Bán hàng | CRM, báo giá, khách hàng |
| **staff** | Nhân viên | Chỉ xem dữ liệu cơ bản |

### 8.2 Bảng Phân Quyền Chi Tiết

```
MENU/FEATURE           | Admin | Account | Dispatch | Sales | Staff
─────────────────────────────────────────────────────────────────────
Dashboard              |   ✓   |    ✓    |    ✓     |   ✓   |   ✓
Users Management       |   ✓   |    ✗    |    ✗     |   ✗   |   ✗
Drivers                |   ✓   |    ✓    |    ✓     |   ✓   |   ✓
Vehicles               |   ✓   |    ✓    |    ✓     |   ✓   |   ✓
Orders                 |   ✓   |    ✓    |    ✓     |   ✓   |   ✓
Orders Create          |   ✓   |    ✗    |    ✓     |   ✗   |   ✗
Costs & Advances       |   ✓   |    ✓    |    ✓     |   ✗   |   ✗
Salaries               |   ✓   |    ✓    |    ✗     |   ✗   |   ✗
Fuel Records           |   ✓   |    ✓    |    ✓     |   ✗   |   ✗
Cash Flow              |   ✓   |    ✓    |    ✗     |   ✗   |   ✗
Expense Reports        |   ✓   |    ✓    |    ✓     |   ✗   |   ✗
CRM (Customers)        |   ✓   |    ✗    |    ✗     |   ✓   |   ✗
Quotes                 |   ✓   |    ✗    |    ✗     |   ✓   |   ✗
Maintenance            |   ✓   |    ✓    |    ✓     |   ✗   |   ✗
Audit Logs             |   ✓   |    ✗    |    ✗     |   ✗   |   ✗
Export Excel           |   ✓   |    ✓    |    ✓     |   ✗   |   ✗
```

### 8.3 Implementation

**Middleware Authentication (server.js line 56)**
```javascript
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Không có token' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token không hợp lệ' });
    req.user = user;
    next();
  });
}
```

**Middleware Authorization (server.js line 80)**
```javascript
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
    next();
  };
}
```

**Sử dụng (server.js line 798)**
```javascript
app.post('/api/orders', 
  authenticateToken, 
  requireRole(['admin', 'dispatcher']), 
  async (req, res) => { ... }
);
```

---

## <a name="hướng-dẫn"></a>9. HƯỚNG DẪN SỬ DỤNG

### 9.1 Cài Đặt & Khởi Động

#### Bước 1: Cài đặt lần đầu
```bash
# Vào thư mục dự án
cd c:\Users\nguye\Downloads\21

# Cài đặt dependencies
npm install

# Khởi động ứng dụng
npm run electron
```

#### Bước 2: Đăng nhập
- **Username:** admin
- **Password:** admin123
- **Role:** admin (toàn quyền)

#### Bước 3: Tạo tài khoản khác
1. Menu → Quản lý → Người dùng
2. Click "Thêm mới"
3. Nhập thông tin: tên đăng nhập, mật khẩu, họ tên, role
4. Click "Lưu"

### 9.2 Quy Trình Công Việc Hàng Ngày

#### A. Tạo Đơn Hàng Mới

**Bước 1:** Điều độ (dispatcher) tạo đơn
```
Menu → Đơn hàng → Thêm mới
├── Mã đơn: DH001
├── Khách hàng: Công ty ABC
├── Xe: BKS-123
├── Tài xế: Nguyễn Văn A
├── Tuyến: Hà Nội → TP.HCM
├── Ngày pickup: 01/12/2025
├── Ngày giao: 05/12/2025
├── Giá: 5,000,000 VNĐ
└── Click "Lưu"
```

**Bước 2:** Ghi nhận chi phí
```
Menu → Đơn hàng → Chọn đơn → Chi phí
├── Loại: Nhiên liệu
├── Số lượng: 100 lít
├── Giá: 20,000/lít
├── Tổng: 2,000,000 VNĐ
└── Click "Lưu"
```

**Bước 3:** Thanh toán từ khách
```
Menu → Đơn hàng → Chọn đơn → Thanh toán
├── Ngày thanh toán: 10/12/2025
├── Số tiền: 5,000,000 VNĐ
├── Phương thức: Chuyển khoản
├── Số chứng từ: CT001
└── Click "Lưu"
```

**Bước 4:** Thanh toán tạm ứng tài xế
```
Menu → Đơn hàng → Chọn đơn → Tạm ứng
├── Tài xế: Nguyễn Văn A
├── Số tiền: 3,000,000 VNĐ
├── Ngày ứng: 01/12/2025
└── Click "Lưu"

Sau khi hoàn công:
Menu → Tạm ứng → Chọn ứng → Thanh toán
├── Số tiền thanh toán: 3,000,000 VNĐ
├── Ngày thanh toán: 10/12/2025
└── Click "Thanh toán"
```

#### B. Quản Lý Nhiên Liệu

```
Menu → ⛽ Nhiên liệu
├── Thêm mới: Click nút "Thêm"
│   ├── Xe: BKS-123
│   ├── Ngày: 01/12/2025
│   ├── Loại: Diesel
│   ├── Số lít: 50
│   ├── Giá/lít: 25,000
│   ├── Tổng: 1,250,000 (tự tính)
│   ├── Km: 100,000
│   ├── Trạm: Shell Hà Nội
│   └── Click "Lưu"
│
├── Xem báo cáo: Chọn xe, tháng → Click "Xem"
├── Thống kê: Xem tiêu hao theo xe/tháng
└── Export Excel: Click nút "📥 Xuất Excel"
    └── Tải file BaoCaoNhienLieu_2025-12_[timestamp].xlsx
```

#### C. Quản Lý Lương Tài Xế

```
Menu → Lương
├── Tính lương: Chọn tháng → Click "Tính lương"
│   ├── Hệ thống tự tính:
│   │   - Lương cơ bản
│   │   - Thưởng chuyến (số chuyến × giá)
│   │   - Tăng ca (giờ × giá/giờ)
│   │   - Trừ khoản ứng
│   │   - Trừ phạt
│   │   = Lương ròng
│   └── Duyệt thông tin
│
├── Lưu lương: Click "Lưu"
│   ├── Trạng thái: draft → saved
│   └── Audit log tự ghi nhận
│
└── Thanh toán: 
    ├── Chọn tài xế
    ├── Nhập ngày thanh toán
    ├── Chọn phương thức
    └── Click "Thanh toán"
```

#### D. Export Báo Cáo

```
A. Báo cáo Nhiên liệu:
   Menu → ⛽ Nhiên liệu → Click "📥 Xuất Excel"
   - Lựa chọn xe (optional)
   - Lựa chọn tháng (optional)
   - File tải: BaoCaoNhienLieu_[tháng]_[timestamp].xlsx
   - Nội dung: 10 cột, tổng cộng, format tiền tệ

B. Báo cáo Dòng tiền:
   Menu → 💰 Dòng tiền → Click "📥 Xuất Excel"
   - Lựa chọn từ/đến tháng
   - File tải: BaoCaoDongTien_[khoảng]_[timestamp].xlsx
   - Nội dung: Thu/chi chi tiết, bảng tóm tắt 3 dòng

C. Báo cáo Chi phí:
   Menu → 📊 Chi phí → Click "📥 Xuất Excel"
   - Lựa chọn xe, tháng
   - File tải: BaoCaoChiPhiVanHanh_[dates]_[timestamp].xlsx
   - Nội dung: Chi phí theo từng hạng mục, tổng, %
```

### 9.3 Tips & Mẹo

1. **Tìm kiếm nhanh:** Sử dụng Ctrl+F để tìm trong bảng
2. **Lọc dữ liệu:** Chọn bộ lọc trên đầu trang, click "Xem"
3. **Sắp xếp:** Click vào header cột để sắp xếp (chưa hỗ trợ)
4. **Phím tắt:** Không hỗ trợ hiện tại (có thể thêm)
5. **Backup dữ liệu:** Copy file `freight.db` định kỳ

---

## <a name="deployment"></a>10. DEPLOYMENT & MAINTENANCE

### 10.1 Cấu Hình Ban Đầu

#### Tạo Database Mới
```bash
# Database sẽ được tạo tự động khi khởi động lần đầu
# Vị trí: C:\Users\{username}\AppData\Roaming\freight-management-system\freight.db

# Hoặc xóa database cũ để reset:
Remove-Item "$env:APPDATA\freight-management-system\freight.db" -Force
```

#### Tạo Admin User
Database sẽ tự tạo admin user:
- Username: `admin`
- Password: `admin123` (bcrypt hash)

#### Thêm Container
12 container (40ft) được thêm tự động:
```
50E21256, 50E33148, 50E40752, 50E53027,
50E53401, 50H11147, 50H51109, 50H68598,
51D44553, 50E33681, 50H11701, 50H43593
```

### 10.2 Build & Distribution

#### Build Standalone EXE
```bash
# Build installer Windows
npm run build

# Output: dist\FreightManager Setup 1.0.0.exe
```

#### Cấu Hình Build (package.json)
```json
{
  "build": {
    "appId": "com.ngocanh.freight",
    "productName": "FreightManager",
    "win": {
      "target": ["nsis"],
      "icon": "icon.ico"
    }
  }
}
```

### 10.3 Maintenance

#### Backup Database
```bash
# Backup định kỳ
Copy-Item "$env:APPDATA\freight-management-system\freight.db" `
          "D:\Backup\freight_$(Get-Date -Format yyyyMMdd).db"
```

#### Xem Logs
```bash
# Logs được ghi vào console khi chạy
# Hoặc lưu vào file:
npm run electron > logs.txt 2>&1
```

#### Xóa Dữ Liệu Cũ
```sql
-- Xóa đơn hàng cũ (giữ 1 năm)
DELETE FROM orders 
WHERE order_date < date('now', '-1 year');

-- Xóa audit logs cũ (giữ 3 tháng)
DELETE FROM audit_logs 
WHERE created_at < datetime('now', '-3 months');

-- Xóa fuel records cũ (giữ 2 năm)
DELETE FROM fuel_records 
WHERE fuel_date < date('now', '-2 years');
```

---

## <a name="troubleshooting"></a>11. XỬ LÝ LỖI VÀ KHẮC PHỤC

### 11.1 Lỗi Phổ Biến

| Lỗi | Nguyên Nhân | Cách Khắc Phục |
|-----|-----------|-----------------|
| "Lỗi lấy báo cáo chi phí" | Query SQL sai | ✅ Đã sửa: loại bỏ JOIN sai với driver_salaries.order_id, sử dụng subquery qua orders.driver_id |
| "Bạn không có quyền" | Role không đủ | Kiểm tra quyền user, hoặc yêu cầu admin cấp quyền |
| "Token không hợp lệ" | JWT hết hạn | Đăng nhập lại |
| "Database bị khóa" | Nhiều kết nối | Đóng app, restart |
| "Port 3000 đã dùng" | Server khác chạy | Dùng netstat kiểm tra, kill process |
| "Không tìm thấy node_modules" | Dependencies thiếu | Chạy `npm install` |

### 11.2 Kiểm Tra Sức Khỏe Hệ Thống

#### A. Check Server
```bash
# Kiểm tra port 3000
netstat -ano | findstr :3000

# Kiểm tra database
sqlite3 "C:\Users\[username]\AppData\Roaming\freight-management-system\freight.db" "SELECT COUNT(*) FROM users;"
```

#### B. Check Log
```bash
# Khởi động app, mở DevTools: F12 → Console
# Xem logs trong console
```

#### C. Verify Database Integrity
```sql
-- Kiểm tra table
SELECT name FROM sqlite_master WHERE type='table';

-- Kiểm tra constraints
PRAGMA foreign_key_check;

-- Kiểm tra dữ liệu
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM orders;
SELECT COUNT(*) FROM fuel_records;
```

### 11.3 Performance Optimization

#### A. Indexes
Database đã có indexes cho:
- `gps_locations(vehicle_id, timestamp)`
- Các foreign keys tự động

#### B. Query Optimization
- Sử dụng WHERE để filter trước
- LIMIT khi load data lớn
- Batch insert cho dữ liệu hàng loạt

#### C. Frontend Performance
- Lazy load data khi cần
- Cache API results
- Pagination cho bảng lớn

### 11.4 Security Best Practices

1. **Password Policy**
   - Min 8 ký tự
   - Phải có chữ hoa, chữ thường, số
   - Thay đổi 3 tháng/lần

2. **JWT Token**
   - Lưu trữ ở localStorage (hiện tại)
   - Có thể nâng cấp dùng httpOnly cookie
   - Token expiry: 24 giờ

3. **API Security**
   - CORS enabled (localhost only)
   - SQL injection: Dùng parameterized queries (✅ Implemented)
   - XSS: Escape HTML output

4. **Database**
   - Foreign keys: ON (✅ Enabled)
   - Backup: Định kỳ
   - Encryption: Upgrade trong tương lai

---

## 📊 THỐNG KÊ HỆ THỐNG

### Kích Thước Code
```
server.js:           3,300+ dòng (API & Database)
public/js/app.js:    4,200+ dòng (Frontend)
phase1-features.js:  2,500+ dòng (Orders, salary)
phase2-features.js:  843 dòng (Fuel, cash flow)
phase3-features.js:  772 dòng (CRM, quotes)
database.js:         481 dòng (Schema)
excel-export.js:     481 dòng (Export)
─────────────────────────────────────────
TỔNG:                ~12,600 dòng code
```

### Database
```
Bảng:                15 bảng chính
Columns:             ~150 cột
Relationships:       Phức tạp (orders ← → nhiều bảng)
Capacity:            Thiết kế cho 100,000+ records
```

### APIs
```
Endpoints:           93 endpoints
CRUD Operations:     ✅ Đầy đủ
Authentication:      ✅ JWT
Authorization:       ✅ Role-based (5 roles)
Audit Logging:       ✅ Tất cả thao tác ghi log
```

### Features
```
Phase 1:             ✅ 100% - 7 features
Phase 2:             ✅ 100% - 3 features + Excel export
Phase 3:             ✅ 60% - CRM, quotes (GPS pending)
```

---

## 🎯 TUYÊN BỐ CHẤT LƯỢNG

✅ **Hoàn chỉnh & Ổn định**
- Tất cả features chính đã triển khai
- Database schema đúng, không còn lỗi
- APIs test và hoạt động tốt
- Phân quyền chặt chẽ

✅ **Sẵn sàng sản xuất**
- Build EXE standalone
- Cấu hình database tự động
- Error handling & validation
- Audit logging đầy đủ

✅ **Dễ bảo trì**
- Code modular, tách Phase
- Documentation chi tiết
- Logs rõ ràng
- API RESTful chuẩn

---

## 📞 HƯỚNG DẪN LIÊN HỆ & HỖ TRỢ

**Lỗi hoặc câu hỏi?**
1. Kiểm tra section "Troubleshooting" (11.1-11.4)
2. Xem console logs (F12)
3. Kiểm tra database (SQLite3 CLI)
4. Restart app & database

**Tính năng mới?**
- GPS Tracking (Phase 3.4) - Chuẩn bị
- Mobile App - Dùng API hiện tại
- Cloud Backup - Nâng cấp sau
- Advanced Analytics - Phase 4

---

**Ende File**  
*Tài liệu này cập nhật lần cuối: January 6, 2025*  
*Version: 1.0.0 - Production Ready* ✅
