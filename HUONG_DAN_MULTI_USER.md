# HƯỚNG DẪN TRIỂN KHAI MULTI-USER (ĐA NGƯỜI DÙNG)

## 📋 TỔNG QUAN

### Tình trạng hiện tại:
- ✅ Phần mềm là **Electron Desktop App** (ứng dụng cài đặt trên từng máy)
- ✅ Database SQLite lưu local tại: `C:\Users\[TenUser]\AppData\Roaming\freight-management-system\freight.db`
- ✅ Express Server chạy local trên port 3000
- ❌ **MỖI MÁY CÓ DATABASE RIÊNG - KHÔNG ĐỒNG BỘ**

### Câu trả lời:
**KHÔNG**, phần mềm hiện tại **CHƯA ĐÁप ỨNG** yêu cầu 3 nhân viên đăng nhập đồng thời với dữ liệu đồng bộ. Mỗi máy sẽ có database riêng biệt.

---

## 🔄 CÁC GIẢI PHÁP TRIỂN KHAI

### ✅ GIẢI PHÁP 1: CHUYỂN ĐỔI SANG WEB APP (KHUYẾN NGHỊ)

#### Ưu điểm:
- ✅ Dữ liệu tập trung, đồng bộ real-time
- ✅ Không cần cài đặt trên từng máy
- ✅ Truy cập từ bất kỳ máy nào trong LAN/Internet
- ✅ Dễ bảo trì và cập nhật
- ✅ Hỗ trợ nhiều người dùng đồng thời tốt

#### Các bước thực hiện:

**BƯỚC 1: Cài đặt máy chủ trung tâm**
```bash
# Chọn 1 máy làm server (máy phải luôn bật)
# Cài đặt Node.js 18+ trên máy server
```

**BƯỚC 2: Chuyển đổi database**
```bash
# Option A: Giữ SQLite (đơn giản, phù hợp <10 users)
- Để database trên máy server
- Các máy client kết nối qua API

# Option B: Chuyển sang PostgreSQL/MySQL (tốt hơn)
- Cài PostgreSQL/MySQL trên server
- Migrate dữ liệu từ SQLite
- Sửa code database.js
```

**BƯỚC 3: Deploy server**
```bash
# Trên máy server
cd c:\FreightServer
npm install
npm install -g pm2

# Chạy server với PM2 (auto-restart)
pm2 start server.js --name freight-server
pm2 startup
pm2 save

# Mở firewall cho port 3000
netsh advfirewall firewall add rule name="Freight Server" dir=in action=allow protocol=TCP localport=3000
```

**BƯỚC 4: Cấu hình client**
```javascript
// Sửa file public/js/app.js
// Thay đổi API_BASE_URL từ:
const API_BASE_URL = 'http://localhost:3000/api';

// Thành:
const API_BASE_URL = 'http://192.168.1.100:3000/api'; // IP của máy server
```

**BƯỚC 5: Truy cập từ các máy client**
- Mở trình duyệt: `http://192.168.1.100:3000`
- Đăng nhập với tài khoản của mình
- Tất cả dữ liệu đồng bộ từ server trung tâm

#### Chi phí ước tính:
- 💰 Miễn phí nếu dùng máy tính hiện có làm server
- ⏱️ Thời gian chuyển đổi: 4-8 giờ
- 🔧 Độ khó: Trung bình

---

### ⚠️ GIẢI PHÁP 2: SHARED DATABASE TRÊN NETWORK DRIVE (KHÔNG KHUYẾN NGHỊ)

#### Cách thực hiện:
```javascript
// 1. Tạo thư mục chia sẻ trên máy chủ
// Ví dụ: \\SERVER\FreightData

// 2. Sửa file database.js
const dbPath = process.env.DB_PATH || '\\\\SERVER\\FreightData\\freight.db';

// 3. Cài đặt ứng dụng trên 3 máy, tất cả trỏ đến database chung
```

#### ⚠️ Hạn chế:
- ❌ SQLite **KHÔNG THIẾT KẾ** cho concurrent writes (ghi đồng thời)
- ❌ Có thể bị lỗi database lock khi 2 người sửa cùng lúc
- ❌ Hiệu suất kém qua network
- ❌ Dễ bị hỏng database nếu mất kết nối đột ngột
- ⚠️ **CHỈ DÙNG NẾU <3 USERS VÀ ÍT THAO TÁC GHI**

---

### 🔥 GIẢI PHÁP 3: HYBRID (DESKTOP APP + SERVER)

#### Cách thực hiện:
```bash
# 1. Deploy server trên máy trung tâm (như Giải pháp 1)
# 2. Sửa Electron app để kết nối đến server thay vì local

# Sửa file main.js
app.on('ready', () => {
  // Không khởi động local server nữa
  // server = require('./server');
  
  // Chỉ mở window và kết nối đến remote server
  mainWindow.loadURL('http://192.168.1.100:3000');
});
```

#### Ưu điểm:
- ✅ Giữ được trải nghiệm desktop app
- ✅ Dữ liệu đồng bộ từ server trung tâm
- ✅ Có thể offline với local cache

#### Nhược điểm:
- ⚠️ Vẫn phải cài đặt app trên từng máy
- ⚠️ Cập nhật phải deploy lại từng máy

---

## 🎯 KHUYẾN NGHỊ

### Cho 3 nhân viên trong cùng văn phòng:

**👉 GIẢI PHÁP 1: WEB APP** (khuyến nghị mạnh)

**Lý do:**
1. ✅ Đơn giản nhất - chỉ cần 1 máy server + mở browser
2. ✅ Không cần cài đặt gì trên máy nhân viên
3. ✅ Dễ bảo trì - chỉ cập nhật 1 nơi
4. ✅ An toàn dữ liệu - backup tập trung
5. ✅ Mở rộng dễ dàng (10, 20, 50 users)

### Cấu hình server tối thiểu:
- CPU: Core i3 hoặc tương đương
- RAM: 4GB (khuyến nghị 8GB)
- Ổ cứng: 100GB SSD
- Hệ điều hành: Windows 10/11 hoặc Ubuntu Server
- Kết nối mạng: LAN 100Mbps+

---

## 📦 CÁC BƯỚC TRIỂN KHAI WEB APP

### 1. Chuẩn bị máy server

```powershell
# Tạo thư mục dự án
mkdir C:\FreightServer
cd C:\FreightServer

# Copy toàn bộ code hiện tại (trừ node_modules)
# Từ: c:\Users\nguye\Downloads\21
# Đến: C:\FreightServer
```

### 2. Sửa đổi code (nếu cần)

```javascript
// server.js - Thay đổi CORS nếu cần
const cors = require('cors');
app.use(cors({
  origin: '*', // Hoặc chỉ định domain cụ thể
  credentials: true
}));

// Cho phép listen trên tất cả network interfaces
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 3. Cài đặt và chạy

```powershell
# Cài dependencies
npm install

# Option 1: Chạy thủ công (dùng test)
npm run server

# Option 2: Chạy với PM2 (production)
npm install -g pm2
pm2 start server.js --name freight-server
pm2 startup windows
pm2 save

# Kiểm tra
pm2 status
```

### 4. Cấu hình firewall

```powershell
# Mở port 3000
netsh advfirewall firewall add rule name="Freight Management System" dir=in action=allow protocol=TCP localport=3000

# Kiểm tra IP của server
ipconfig
# Ghi nhận địa chỉ IPv4, ví dụ: 192.168.1.100
```

### 5. Truy cập từ máy client

```
Mở trình duyệt Chrome/Edge tại:
http://192.168.1.100:3000

Đăng nhập:
- admin/admin123 (Quản trị)
- Hoặc tạo user cho kế toán, điều độ, nhân viên
```

### 6. Backup tự động

```powershell
# Tạo script backup: C:\FreightServer\backup.ps1
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$dbPath = "$env:APPDATA\freight-management-system\freight.db"
$backupPath = "C:\FreightBackup\freight_$date.db"

Copy-Item $dbPath $backupPath -Force

# Xóa backup cũ hơn 30 ngày
Get-ChildItem "C:\FreightBackup\*.db" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item

# Tạo scheduled task chạy mỗi ngày 2h sáng
schtasks /create /tn "Freight Backup" /tr "powershell.exe -File C:\FreightServer\backup.ps1" /sc daily /st 02:00
```

---

## 🔐 BẢO MẬT

### Nếu truy cập qua Internet (không chỉ LAN):

1. **Sử dụng HTTPS**
```bash
# Cài SSL certificate (Let's Encrypt hoặc tự ký)
npm install --save express-ssl
```

2. **Thêm rate limiting**
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100 // 100 requests
});
app.use('/api/', limiter);
```

3. **Cấu hình VPN** nếu nhân viên làm remote

---

## 📱 TRUY CẬP TỪ ĐIỆN THOẠI

Với Giải pháp Web App, có thể truy cập từ:
- ✅ Máy tính (Windows/Mac/Linux)
- ✅ Tablet (iPad/Android)
- ✅ Điện thoại (iOS/Android)

Chỉ cần mở browser và truy cập: `http://[IP_SERVER]:3000`

---

## ❓ CÂU HỎI THƯỜNG GẶP

**Q: Có cần Internet không?**
- A: KHÔNG. Chỉ cần mạng LAN (mạng nội bộ) trong văn phòng.

**Q: Máy server bị tắt thì sao?**
- A: Các máy client không truy cập được cho đến khi server bật lại.

**Q: Có bị chậm không?**
- A: Rất nhanh nếu trong mạng LAN. Nhanh hơn cả desktop app vì không cần khởi động Electron.

**Q: Chi phí bao nhiêu?**
- A: MIỄN PHÍ. Chỉ cần 1 máy tính hiện có làm server (không cần mua server chuyên dụng).

**Q: Nâng cấp code thì phải làm gì?**
- A: Chỉ cần cập nhật code trên server, tất cả client tự động dùng phiên bản mới.

**Q: Backup như thế nào?**
- A: Chỉ cần backup database trên server (1 file duy nhất), không phải backup 3 máy.

---

## 📞 HỖ TRỢ TRIỂN KHAI

Nếu cần hỗ trợ chuyển đổi sang multi-user:
1. Chuẩn bị 1 máy làm server (Windows 10/11, RAM 4GB+)
2. Đảm bảo 3 máy trong cùng mạng LAN
3. Follow các bước trong phần "CÁC BƯỚC TRIỂN KHAI WEB APP"
4. Test kỹ trước khi chuyển data thật

---

## 📊 SO SÁNH CÁC GIẢI PHÁP

| Tiêu chí | Desktop hiện tại | Shared SQLite | Web App | Hybrid |
|----------|------------------|---------------|---------|---------|
| Đồng bộ dữ liệu | ❌ Không | ⚠️ Có (không ổn định) | ✅ Có | ✅ Có |
| Số người dùng | 1 | 2-3 | 10+ | 10+ |
| Cài đặt client | Phải cài | Phải cài | Không cần | Phải cài |
| Bảo trì | Khó (nhiều máy) | Khó | Dễ (1 nơi) | Trung bình |
| Chi phí | Thấp | Thấp | Thấp | Trung bình |
| Độ tin cậy | ✅ Cao | ❌ Thấp | ✅ Cao | ✅ Cao |
| **Khuyến nghị** | 1 user | ❌ Không nên | ✅ TỐT NHẤT | ⚠️ OK |

---

## ✅ KẾT LUẬN

**TRẢ LỜI CÂU HỎI CỦA BẠN:**
- ❌ Phần mềm **HIỆN TẠI CHƯA** đáp ứng 3 người dùng đồng thời
- ✅ CẦN chuyển sang **WEB APP** (Giải pháp 1)
- ⏱️ Thời gian chuyển đổi: **1 ngày làm việc**
- 💰 Chi phí: **MIỄN PHÍ** (dùng máy tính hiện có)

**NEXT STEPS:**
1. Quyết định chọn giải pháp nào (khuyến nghị: Web App)
2. Chuẩn bị máy server
3. Thông báo để được hỗ trợ chi tiết về code migration nếu cần

---

*Tài liệu được tạo ngày: 04/01/2026*
