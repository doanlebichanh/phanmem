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
