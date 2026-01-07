# 📥 HƯỚNG DẪN XUẤT BÁO CÁO EXCEL CHI TIẾT

## 📊 **TỔNG QUAN**

Hệ thống hỗ trợ xuất báo cáo Excel chi tiết cho **3 loại báo cáo chính**:

1. **⛽ Báo Cáo Nhiên Liệu** - Chi tiết lịch sử đổ xăng
2. **💰 Báo Cáo Dòng Tiền** - Chi tiết thu/chi với phân loại màu sắc
3. **📊 Báo Cáo Chi Phí Vận Hành** - Tổng hợp tất cả chi phí theo xe

---

## 1. ⛽ **BÁO CÁO NHIÊN LIỆU**

### **Truy cập:**
- Menu → **⛽ Nhiên liệu**

### **Bộ lọc:**
- **Xe:** Chọn xe cụ thể hoặc "Tất cả"
- **Tháng:** Chọn tháng cần xem (VD: 2026-01)

### **Xuất Excel:**
```
1. Chọn bộ lọc (nếu muốn)
2. Click nút "📥 Xuất Excel" (góc trên bên phải)
3. File Excel sẽ tự động tải về
4. Tên file: BaoCaoNhienLieu_[Tháng]_[Timestamp].xlsx
```

### **Nội dung báo cáo Excel:**

#### **Sheet: "Báo Cáo Nhiên Liệu"**

**Tiêu đề:**
- Tên báo cáo
- Thông tin bộ lọc (Xe, Tháng)
- Ngày xuất báo cáo

**Các cột dữ liệu:**
| STT | Ngày | Xe | Loại NL | Số lít | Giá/lít | Tổng tiền | Số Km | Trạm xăng | Ghi chú |
|-----|------|----|---------|----|---------|-----------|--------|-----------|---------|
| 1 | 15/01/2026 | 29A-123.45 | RON95 | 50.5 | 23,500 | 1,186,750 | 125,450 | Petrolimex | - |
| 2 | 10/01/2026 | 29A-123.45 | RON95 | 48.2 | 23,200 | 1,118,240 | 124,950 | Shell | - |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Tổng cộng:**
- **Tổng số lít:** XXX lít
- **Tổng chi phí:** XXX,XXX,XXX đ

**Format:**
- ✅ Header màu xanh dương đậm
- ✅ Số tiền format có dấu phẩy (1,186,750)
- ✅ Dòng tổng cộng màu vàng đậm
- ✅ Cột tự động điều chỉnh độ rộng

---

## 2. 💰 **BÁO CÁO DÒNG TIỀN**

### **Truy cập:**
- Menu → **💰 Dòng tiền**

### **Bộ lọc:**
- **Loại:** Thu / Chi / Tất cả
- **Từ ngày:** Ngày bắt đầu
- **Đến ngày:** Ngày kết thúc

### **Phân quyền:**
- ⚠️ **Chỉ Admin và Kế toán** mới xuất được báo cáo dòng tiền

### **Xuất Excel:**
```
1. Chọn bộ lọc (Loại, Từ ngày, Đến ngày)
2. Click "📥 Xuất Excel"
3. File Excel tải về tự động
4. Tên file: BaoCaoDongTien_[TuNgay]_[DenNgay]_[Timestamp].xlsx
```

### **Nội dung báo cáo Excel:**

#### **Sheet: "Báo Cáo Dòng Tiền"**

**Tiêu đề:**
- Tên báo cáo
- Khoảng thời gian
- Ngày xuất

**Các cột dữ liệu:**
| STT | Ngày | Loại | Danh mục | Số tiền | Mô tả | Đơn hàng | Tài xế | Xe | Ghi chú |
|-----|------|------|----------|---------|-------|----------|--------|-------|---------|
| 1 | 20/01/2026 | Thu | Doanh thu vận chuyển | **+15,000,000** (màu xanh) | Thu từ ĐH001 | DH2026001 | Nguyễn Văn A | 29A-123.45 | - |
| 2 | 18/01/2026 | Chi | Nhiên liệu | **-1,200,000** (màu đỏ) | Đổ xăng | - | - | 29A-123.45 | - |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

**Tổng cộng (3 dòng):**
1. **TỔNG THU** (nền xanh lá): XXX,XXX,XXX đ
2. **TỔNG CHI** (nền đỏ nhạt): XXX,XXX,XXX đ
3. **DÒNG TIỀN RÒNG** (nền vàng): XXX,XXX,XXX đ

**Format đặc biệt:**
- ✅ Số tiền THU màu xanh lá
- ✅ Số tiền CHI màu đỏ
- ✅ 3 dòng tổng với màu nền khác nhau
- ✅ Dễ phân biệt trực quan

---

## 3. 📊 **BÁO CÁO CHI PHÍ VẬN HÀNH**

### **Truy cập:**
- Menu → **📊 Báo cáo chi phí**

### **Bộ lọc:**
- **Xe:** Chọn xe cụ thể hoặc "Tất cả"
- **Từ tháng:** Tháng bắt đầu (VD: 2026-01)
- **Đến tháng:** Tháng kết thúc (VD: 2026-03)

### **Phân quyền:**
- ✅ Admin, Kế toán, Điều độ được xuất

### **Xuất Excel:**
```
1. Chọn bộ lọc (Xe, Từ tháng, Đến tháng)
2. Click "📥 Xuất Excel"
3. File Excel tải về
4. Tên file: BaoCaoChiPhiVanHanh_[TuThang]_[DenThang]_[Timestamp].xlsx
```

### **Nội dung báo cáo Excel:**

#### **Sheet: "Báo Cáo Chi Phí Vận Hành"**

**Tiêu đề:**
- Tên báo cáo
- Khoảng thời gian
- Ngày xuất

**Các cột dữ liệu:**
| Xe | Nhiên liệu | Bảo dưỡng | Phí xe | Lương TX | Tổng | % Tổng |
|----|------------|-----------|--------|----------|------|--------|
| 29A-123.45 | 5,500,000 | 2,300,000 | 1,800,000 | 8,000,000 | 17,600,000 | 45.23% |
| 30B-456.78 | 4,200,000 | 1,500,000 | 1,600,000 | 7,500,000 | 14,800,000 | 38.04% |
| 31C-789.01 | 3,100,000 | 800,000 | 1,500,000 | 1,100,000 | 6,500,000 | 16.73% |
| **TỔNG CỘNG** | **12,800,000** | **4,600,000** | **4,900,000** | **16,600,000** | **38,900,000** | **100.00%** |

**Chi tiết các cột:**

1. **Nhiên liệu:** Tổng chi phí đổ xăng (từ bảng fuel_records)
2. **Bảo dưỡng:** Tổng chi phí bảo dưỡng (từ bảng vehicle_maintenance)
3. **Phí xe:** Bảo hiểm + Đăng kiểm + Phí đường (từ bảng vehicle_fees)
4. **Lương TX:** Tổng lương tài xế được gán cho xe (từ bảng driver_salaries)
5. **Tổng:** Tổng cộng 4 khoản trên
6. **% Tổng:** Tỷ lệ phần trăm so với tổng chi phí toàn bộ

**Format:**
- ✅ Dòng tổng cộng màu vàng đậm
- ✅ % được format với 2 chữ số thập phân
- ✅ Tất cả số tiền có dấu phẩy

---

## 🎯 **ĐỘ CHÍNH XÁC CAO**

### **Dữ liệu được tổng hợp từ:**

#### **Báo cáo Nhiên liệu:**
- ✅ Bảng: `fuel_records`
- ✅ JOIN: `vehicles` để lấy biển số xe
- ✅ Filter: vehicle_id, fuel_date (tháng)
- ✅ Tính: Tổng lít, Tổng chi phí

#### **Báo cáo Dòng tiền:**
- ✅ Bảng: `cash_flow`
- ✅ JOIN: `orders`, `drivers`, `vehicles`
- ✅ Filter: type (income/expense), transaction_date
- ✅ Tính: Tổng Thu, Tổng Chi, Dòng tiền ròng

#### **Báo cáo Chi phí vận hành:**
- ✅ Bảng: `fuel_records` + `vehicle_maintenance` + `vehicle_fees` + `driver_salaries`
- ✅ JOIN phức tạp qua `orders` để link lương với xe
- ✅ Filter: vehicle_id, từ tháng đến tháng
- ✅ GROUP BY: vehicle_id
- ✅ Tính: 4 khoản chi phí + Tổng + Tỷ lệ %

---

## 📂 **CẤU TRÚC FILE EXCEL**

### **Định dạng chuẩn:**
```
📄 BaoCaoNhienLieu_2026-01_1234567890.xlsx
   └── Sheet "Báo Cáo Nhiên Liệu"
       ├── A1: Tiêu đề (merge A1:J1, font 16pt, màu xanh)
       ├── A2-A4: Thông tin bộ lọc
       ├── A6-J6: Header (màu xanh đậm, chữ trắng, bold)
       ├── A7-J[n]: Dữ liệu chi tiết
       └── A[n+1]-J[n+1]: Tổng cộng (màu vàng, bold)
```

### **Mở bằng:**
- ✅ Microsoft Excel (2016+)
- ✅ Google Sheets
- ✅ LibreOffice Calc
- ✅ WPS Office

### **Kích thước file:**
- 📦 Trung bình: 50-200 KB
- 📦 Nhiều dữ liệu: 200-500 KB
- 📦 Rất nhiều: 500KB-1MB

---

## 🔥 **TÍNH NĂNG ĐẶC BIỆT**

### **1. Format Số Tiền Tự Động**
```
Trước: 1186750
Sau:   1,186,750
```

### **2. Màu Sắc Phân Loại**
- 🟢 **Xanh lá:** Thu nhập, Dương
- 🔴 **Đỏ:** Chi phí, Âm
- 🟡 **Vàng:** Tổng cộng
- 🔵 **Xanh dương:** Header

### **3. Cột Tự Động Điều Chỉnh**
- Độ rộng cột tự động theo nội dung
- Không bị cắt chữ
- Dễ đọc, dễ in

### **4. Ngày Tháng Format VN**
- DD/MM/YYYY (15/01/2026)
- Không phải MM/DD/YYYY

### **5. Tổng Cộng Tự Động**
- Tính toán chính xác
- Không cần formula
- Giá trị cố định (không bị lỗi khi copy)

---

## ⚠️ **LƯU Ý QUAN TRỌNG**

### **Phân Quyền:**
1. **Báo cáo Nhiên liệu:** 
   - ✅ Tất cả user đã đăng nhập

2. **Báo cáo Dòng tiền:**
   - ✅ Admin
   - ✅ Kế toán
   - ❌ Điều độ, Tài xế

3. **Báo cáo Chi phí:**
   - ✅ Admin
   - ✅ Kế toán
   - ✅ Điều độ
   - ❌ Tài xế

### **Bộ lọc:**
- ⚠️ Nếu không chọn bộ lọc → Xuất **TẤT CẢ** dữ liệu
- ⚠️ File có thể rất lớn nếu dữ liệu nhiều
- ✅ Nên chọn bộ lọc để giới hạn phạm vi

### **Tên File:**
- Tự động sinh với timestamp
- Không trùng lặp
- Dễ phân biệt theo thời gian

### **Audit Log:**
- Mọi thao tác xuất báo cáo đều được ghi log
- Admin có thể kiểm tra ai xuất báo cáo gì, khi nào

---

## 🎓 **VÍ DỤ THỰC TẾ**

### **Tình huống 1: Báo cáo nhiên liệu tháng 01/2026 cho xe 29A-123.45**

```
Bước 1: Vào menu "⛽ Nhiên liệu"
Bước 2: Chọn bộ lọc:
  - Xe: 29A-123.45
  - Tháng: 2026-01
Bước 3: Click "📥 Xuất Excel"
Bước 4: Mở file BaoCaoNhienLieu_2026-01_xxxxx.xlsx

Kết quả:
- 8 lần đổ xăng trong tháng
- Tổng: 385.2 lít
- Chi phí: 9,042,200 đ
- Trung bình: 48.15 lít/lần, 1,130,275 đ/lần
```

### **Tình huống 2: Báo cáo dòng tiền quý 1/2026**

```
Bước 1: Vào menu "💰 Dòng tiền"
Bước 2: Chọn bộ lọc:
  - Loại: Tất cả
  - Từ ngày: 01/01/2026
  - Đến ngày: 31/03/2026
Bước 3: Click "📥 Xuất Excel" (cần quyền Admin/Kế toán)
Bước 4: Mở file BaoCaoDongTien_2026-01-01_2026-03-31_xxxxx.xlsx

Kết quả:
- 127 giao dịch trong quý
- Tổng thu: 450,000,000 đ (màu xanh lá)
- Tổng chi: 312,500,000 đ (màu đỏ)
- Dòng tiền ròng: 137,500,000 đ (màu vàng)
```

### **Tình huống 3: Báo cáo chi phí tất cả xe Q1/2026**

```
Bước 1: Vào menu "📊 Báo cáo chi phí"
Bước 2: Chọn bộ lọc:
  - Xe: Tất cả
  - Từ tháng: 2026-01
  - Đến tháng: 2026-03
Bước 3: Click "📥 Xuất Excel"
Bước 4: Mở file BaoCaoChiPhiVanHanh_2026-01_2026-03_xxxxx.xlsx

Kết quả (5 xe):
┌──────────────┬────────────┬───────────┬─────────┬──────────┬────────────┬────────┐
│ Xe           │ Nhiên liệu │ Bảo dưỡng │ Phí xe  │ Lương TX │ Tổng       │ % Tổng │
├──────────────┼────────────┼───────────┼─────────┼──────────┼────────────┼────────┤
│ 29A-123.45   │ 27,500,000 │ 6,800,000 │5,400,000│24,000,000│ 63,700,000 │ 35.2%  │
│ 30B-456.78   │ 25,200,000 │ 4,500,000 │4,800,000│22,500,000│ 57,000,000 │ 31.5%  │
│ 31C-789.01   │ 18,600,000 │ 2,400,000 │4,500,000│18,000,000│ 43,500,000 │ 24.0%  │
│ 32D-111.22   │ 10,500,000 │ 1,200,000 │2,400,000│ 3,000,000│ 17,100,000 │  9.4%  │
│ TỔNG CỘNG    │ 81,800,000 │14,900,000 │17,100,00│67,500,000│181,300,000 │100.0%  │
└──────────────┴────────────┴───────────┴─────────┴──────────┴────────────┴────────┘

Phân tích:
- Xe 29A-123.45 tốn chi phí nhất (35.2%)
- Lương TX chiếm 37.2% tổng chi phí
- Nhiên liệu chiếm 45.1% tổng chi phí
```

---

## 📞 **HỖ TRỢ**

Nếu gặp vấn đề khi xuất Excel:

1. **Lỗi "Không có quyền":**
   - Kiểm tra phân quyền tài khoản
   - Liên hệ Admin để cấp quyền

2. **File không tải về:**
   - Kiểm tra trình duyệt có chặn popup không
   - Xem thư mục Downloads

3. **Dữ liệu không đúng:**
   - Kiểm tra lại bộ lọc
   - Xem log trong Console (F12)

4. **File Excel lỗi:**
   - Thử mở bằng Excel khác
   - Kiểm tra file có bị corrupt không

---

**Phiên bản:** 2.0  
**Ngày cập nhật:** 15/01/2025  
**Công ty:** CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT
