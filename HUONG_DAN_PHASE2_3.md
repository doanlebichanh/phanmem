# Hướng Dẫn Sử Dụng Phase 2 & 3 - FREIGHT MANAGEMENT SYSTEM

## 📋 **MỤC LỤC**

### **PHASE 2: QUẢN LÝ CHI TIẾT**
1. [⛽ Quản Lý Nhiên Liệu](#1-quản-lý-nhiên-liệu)
2. [💰 Dòng Tiền](#2-dòng-tiền)
3. [📊 Báo Cáo Chi Phí](#3-báo-cáo-chi-phí)

### **PHASE 3: TÍNH NĂNG NÂNG CAO**
4. [👔 CRM & Báo Giá](#4-crm--báo-giá)

---

## **PHASE 2: QUẢN LÝ CHI TIẾT**

### **1. QUẢN LÝ NHIÊN LIỆU**

#### **1.1. Lịch Sử Đổ Xăng**

**Xem lịch sử:**
- Truy cập: Sidebar → ⛽ **Nhiên liệu**
- Tab: **Lịch Sử Đổ Xăng**
- Bộ lọc:
  - Xe (chọn xe cụ thể hoặc xem tất cả)
  - Tháng (chọn tháng cần xem)

**Thêm mới đổ xăng:**
```
1. Click nút "➕ Thêm Đổ Xăng"
2. Điền thông tin:
   - Xe: Chọn xe từ danh sách
   - Ngày đổ: Chọn ngày
   - Loại nhiên liệu: Xăng RON95, Xăng RON92, Dầu Diesel
   - Số lít: Nhập số lít đổ
   - Giá/lít: Nhập giá tiền mỗi lít
   - Tổng tiền: Tự động tính
   - Số Km: Nhập số Km hiện tại của xe
   - Trạm xăng: Tên trạm (không bắt buộc)
   - Số biên lai: Mã biên lai (không bắt buộc)
   - Ghi chú: Ghi chú bổ sung (không bắt buộc)
3. Click "💾 Lưu"
```

**Sửa/Xóa:**
- Click nút **✏️ Sửa** trên dòng cần sửa → Điều chỉnh thông tin → Lưu
- Click nút **🗑️ Xóa** để xóa (chỉ Admin/Kế toán)

#### **1.2. Thống Kê Tiêu Hao**

**Xem thống kê:**
- Tab: **Thống Kê Tiêu Hao**
- Hiển thị:
  - **Tổng lít**: Tổng số lít đổ
  - **Tổng chi phí**: Tổng tiền đã chi cho xăng
  - **Số lần đổ**: Số lần đổ xăng
  - **Trung bình/lần**: Trung bình số lít mỗi lần đổ
  - **Quãng đường**: Tổng km đã chạy
  - **Mức tiêu hao**: L/100km (Lít trên 100 km)

**Lợi ích:**
- Theo dõi hiệu suất nhiên liệu của từng xe
- Phát hiện xe tiêu hao bất thường
- Lên kế hoạch chi phí nhiên liệu

---

### **2. DÒNG TIỀN**

#### **2.1. Tổng Quan**

**Màn hình chính:**
- Truy cập: Sidebar → 💰 **Dòng tiền**
- Hiển thị 3 chỉ số quan trọng:
  - 💰 **Tổng Thu**: Tổng tiền thu vào
  - 💸 **Tổng Chi**: Tổng tiền chi ra
  - 📊 **Dòng Tiền Ròng**: Thu - Chi

#### **2.2. Danh Sách Giao Dịch**

**Tab: Danh Sách**
- Xem tất cả giao dịch thu/chi
- Màu sắc:
  - 🟢 **Xanh lá**: Giao dịch Thu
  - 🔴 **Đỏ**: Giao dịch Chi

**Bộ lọc:**
- Loại: Thu / Chi / Tất cả
- Từ ngày → Đến ngày

**Thêm giao dịch:**
```
1. Click "➕ Thêm Giao Dịch"
2. Chọn loại: Thu hoặc Chi
3. Chọn danh mục:
   
   THU:
   - Doanh thu vận chuyển
   - Thu nhập khác
   
   CHI:
   - Chi phí nhiên liệu
   - Lương
   - Bảo dưỡng
   - Bảo hiểm
   - Thuế
   - Phạt nguội
   - Chi phí khác

4. Điền thông tin:
   - Ngày giao dịch
   - Số tiền
   - Mô tả chi tiết
   - Phương thức: Tiền mặt / Chuyển khoản / Thẻ
   - Mã tham chiếu (không bắt buộc)
   - Ghi chú (không bắt buộc)

5. Liên kết (không bắt buộc):
   - Đơn hàng
   - Tài xế
   - Xe

6. Click "💾 Lưu"
```

**Sửa/Xóa:**
- Click **✏️ Sửa** → Điều chỉnh → Lưu
- Click **🗑️ Xóa** (chỉ Admin/Kế toán)

#### **2.3. Biểu Đồ Trực Quan**

**Tab: Biểu Đồ**
- Biểu đồ cột: Thu vs Chi theo ngày
- Màu xanh: Thu
- Màu đỏ: Chi
- Dễ dàng so sánh xu hướng thu chi

---

### **3. BÁO CÁO CHI PHÍ**

#### **3.1. Xem Báo Cáo Tổng Hợp**

**Truy cập:**
- Sidebar → 📊 **Báo cáo chi phí**

**Chức năng:**
- Tổng hợp tất cả chi phí vận hành theo xe
- Khoảng thời gian: Chọn từ tháng → đến tháng

**Các khoản chi phí:**
1. **Nhiên liệu**: Từ lịch sử đổ xăng
2. **Bảo dưỡng**: Từ bảo dưỡng xe
3. **Phí xe**: Từ quản lý phí xe
4. **Lương TX**: Lương tài xế (nếu được gán cho xe)

**Hiển thị:**
- Bảng chi tiết từng xe với các khoản chi
- **Tổng cộng** tất cả chi phí
- **Stat boxes** hiển thị tổng và phân loại

**Xuất Excel:**
- Click nút **📥 Xuất Excel**
- Xuất báo cáo ra file Excel để báo cáo cho lãnh đạo
- *(Đang phát triển - hiện tại có thể copy bảng thủ công)*

**Lợi ích:**
- Biết chính xác chi phí vận hành từng xe
- So sánh hiệu quả chi phí giữa các xe
- Lập ngân sách và dự toán cho các tháng tiếp theo

---

## **PHASE 3: TÍNH NĂNG NÂNG CAO**

### **4. CRM & BÁO GIÁ**

#### **4.1. Quản Lý Khách Hàng**

**Truy cập:**
- Sidebar → 👔 **CRM & Báo giá**
- Tab: **👥 Khách Hàng**

**Thêm khách hàng:**
```
1. Click "➕ Thêm Khách Hàng"
2. Điền thông tin:
   - 🏢 Tên công ty * (bắt buộc)
   - 🔢 Mã số thuế
   - 👤 Người liên hệ
   - 📞 Điện thoại
   - 📧 Email
   - 🏠 Địa chỉ
   - 💼 Loại: Cá nhân / Công ty
   - 📊 Trạng thái: Hoạt động / Ngưng
   - 📝 Ghi chú
3. Click "💾 Lưu"
```

**Chức năng trên danh sách:**
- **✏️ Sửa**: Chỉnh sửa thông tin khách hàng
- **📄 Báo giá**: Tạo báo giá cho khách hàng này (nhanh)

**Phân loại:**
- 👤 **Cá nhân**: Khách lẻ
- 🏢 **Công ty**: Khách hàng doanh nghiệp

**Trạng thái:**
- 🟢 **Hoạt động**: Khách hàng đang giao dịch
- 🔴 **Ngưng**: Khách hàng ngưng hợp tác

---

#### **4.2. Quản Lý Báo Giá**

**Tab: 📄 Báo Giá**

##### **A. Tạo Báo Giá Mới**

```
1. Click "📄 Tạo Báo Giá"
2. Điền thông tin:

   📋 THÔNG TIN CƠ BẢN:
   - Số báo giá: Tự động sinh (VD: BG2025123456)
   - Khách hàng: Chọn từ danh sách *
   - Ngày báo giá: Ngày tạo *
   - Hiệu lực đến: Ngày hết hạn

   🗺️ THÔNG TIN VẬN CHUYỂN:
   - Điểm đi: Địa điểm bốc hàng *
   - Điểm đến: Địa điểm giao hàng *
   - Loại container: 20ft / 40ft / 40HC
   - Số lượng: Số chuyến
   - Mô tả hàng hóa: Loại hàng vận chuyển

   💰 GIÁ CẢ:
   - Đơn giá: Giá cho 1 chuyến *
   - Thành tiền: Tự động = Đơn giá × Số lượng
   - Giảm giá: Số tiền giảm
   - Thuế VAT (%): Mặc định 10%
   - Tổng cuối cùng: Tự động tính

   📝 Ghi chú: Thông tin bổ sung

3. Click "💾 Lưu báo giá"
```

**Tự động tính toán:**
- Thành tiền = Đơn giá × Số lượng
- Sau giảm = Thành tiền - Giảm giá
- Thuế = Sau giảm × (Thuế % ÷ 100)
- **Tổng cuối** = Sau giảm + Thuế

##### **B. Quy Trình Làm Việc Với Báo Giá**

**Trạng thái báo giá:**

1. **📝 Nháp** (Draft):
   - Báo giá mới tạo
   - Có thể sửa/xóa
   - Chưa gửi cho khách

2. **✅ Đã duyệt** (Approved):
   - Đã được duyệt và gửi khách
   - Có thể chuyển thành đơn hàng
   - Không thể sửa

3. **🔄 Đã chuyển đơn** (Converted):
   - Đã chuyển thành đơn hàng
   - Có mã đơn hàng liên kết
   - Quy trình hoàn tất

**Các thao tác:**

1. **👁️ Xem chi tiết:**
   - Click nút **👁️** trên dòng báo giá
   - Hiển thị báo giá dạng in đẹp với:
     - Header công ty
     - Thông tin khách hàng
     - Chi tiết vận chuyển
     - Bảng giá
     - Tổng kết tiền
     - Chữ ký và lời cảm ơn

2. **Duyệt báo giá (Status = Nháp):**
   - Trong màn xem chi tiết
   - Click "Duyệt & Gửi"
   - Báo giá chuyển sang trạng thái **Đã duyệt**
   - Sẵn sàng gửi cho khách hàng

3. **✅ Chuyển thành đơn hàng (Status = Đã duyệt):**
   - Click nút **✅** trên danh sách
   - Hoặc trong màn xem chi tiết
   - Xác nhận chuyển đổi
   - Hệ thống tự động:
     - Tạo đơn hàng mới với mã tự động
     - Copy thông tin từ báo giá
     - Ghi ghi chú "Từ báo giá [Số BG]"
     - Cập nhật báo giá với mã đơn hàng
     - Đơn hàng ở trạng thái "Pending"

##### **C. Ví Dụ Thực Tế**

**Tình huống:** Công ty ABC cần vận chuyển 2 container 40ft từ Hà Nội đi Hải Phòng

```
BƯỚ1: Tạo khách hàng (nếu chưa có)
- Công ty: CÔNG TY ABC
- Mã số thuế: 0123456789
- Người liên hệ: Nguyễn Văn A
- SĐT: 0901234567

BƯỚC 2: Tạo báo giá
- Số BG: BG2025123456 (tự động)
- Khách: CÔNG TY ABC
- Ngày: 15/01/2025
- Hiệu lực: 30/01/2025
- Điểm đi: Hà Nội
- Điểm đến: Hải Phòng
- Container: 40ft
- Số lượng: 2
- Đơn giá: 5,000,000đ
- Thành tiền: 10,000,000đ
- Giảm giá: 500,000đ
- Thuế 10%: 950,000đ
- Tổng: 10,450,000đ

BƯỚC 3: Duyệt báo giá
- Xem lại thông tin
- Click "Duyệt & Gửi"
- Gửi báo giá cho khách (email/in)

BƯỚC 4: Khách đồng ý → Chuyển đơn
- Click ✅ Chuyển đơn hàng
- Hệ thống tạo đơn DH2025xxxxxx
- Gán tài xế, xe như bình thường
- Theo dõi tiến trình giao hàng
```

---

#### **4.3. Lợi Ích Của CRM**

**Quản lý khách hàng tập trung:**
- Lưu trữ đầy đủ thông tin liên hệ
- Dễ tìm kiếm và liên lạc
- Phân loại khách theo loại và trạng thái

**Báo giá chuyên nghiệp:**
- Số báo giá tự động, không trùng
- Định dạng in đẹp, chuyên nghiệp
- Tính toán chính xác, tự động
- Theo dõi trạng thái rõ ràng

**Quy trình rõ ràng:**
- Nháp → Duyệt → Gửi khách → Chuyển đơn
- Không bỏ sót báo giá nào
- Quản lý thời hạn hiệu lực

**Chuyển đổi nhanh:**
- Từ báo giá thành đơn hàng chỉ 1 click
- Không cần nhập lại thông tin
- Liên kết rõ ràng giữa báo giá và đơn

---

## **🎯 TÓM TẮT WORKFLOW HOÀN CHỈNH**

### **Kịch Bản: Từ Khách Hàng Mới Đến Hoàn Thành Đơn**

```
1. KHÁCH HÀNG LIÊN HỆ
   ↓
2. TẠO KHÁCH HÀNG TRONG CRM
   - Lưu thông tin công ty, người liên hệ
   ↓
3. TẠO BÁO GIÁ
   - Điểm đi/đến, loại container
   - Tính giá, thuế, giảm giá
   ↓
4. DUYỆT & GỬI BÁO GIÁ
   - Xem trước định dạng chuyên nghiệp
   - Gửi cho khách (email/in)
   ↓
5. KHÁCH ĐỒNG Ý → CHUYỂN ĐƠN HÀNG
   - 1 click chuyển thành đơn
   - Gán tài xế, xe
   ↓
6. THEO DÕI CHI PHÍ THỰC TẾ
   - Đổ xăng → Ghi vào Nhiên liệu
   - Bảo dưỡng → Ghi vào Bảo dưỡng
   - Chi phí khác → Ghi vào Dòng tiền
   ↓
7. KẾT THÚC THÁNG → XEM BÁO CÁO CHI PHÍ
   - Tổng hợp tất cả chi phí theo xe
   - So sánh doanh thu vs chi phí
   - Tính lợi nhuận
   ↓
8. TRẢ LƯƠNG TÀI XẾ
   - Tính lương dựa trên đơn hoàn thành
   - Duyệt và trả lương
   - Ghi nhận vào Dòng tiền
```

---

## **👥 PHÂN QUYỀN**

| Chức năng | Admin | Kế toán | Điều độ | Tài xế |
|-----------|-------|---------|---------|--------|
| **Nhiên liệu**        |
| - Thêm/Sửa           | ✅     | ✅       | ✅      | ❌      |
| - Xóa                 | ✅     | ✅       | ❌      | ❌      |
| - Xem                 | ✅     | ✅       | ✅      | ✅      |
| **Dòng tiền**         |
| - Thêm/Sửa           | ✅     | ✅       | ❌      | ❌      |
| - Xóa                 | ✅     | ❌       | ❌      | ❌      |
| - Xem                 | ✅     | ✅       | ✅      | ❌      |
| **Báo cáo chi phí**   |
| - Xem                 | ✅     | ✅       | ✅      | ❌      |
| - Xuất Excel          | ✅     | ✅       | ❌      | ❌      |
| **CRM**               |
| - Quản lý KH          | ✅     | ❌       | ❌      | ❌      |
| - Tạo báo giá         | ✅     | ❌       | ❌      | ❌      |
| - Duyệt báo giá       | ✅     | ❌       | ❌      | ❌      |
| - Chuyển đơn          | ✅     | ❌       | ❌      | ❌      |

---

## **📞 HỖ TRỢ**

Nếu gặp vấn đề hoặc cần hỗ trợ:
1. Kiểm tra lại phân quyền của tài khoản
2. Xem lại các bước trong hướng dẫn
3. Kiểm tra log lỗi trong Console (F12)
4. Liên hệ IT support

---

**Phiên bản:** 2.0  
**Ngày cập nhật:** 15/01/2025  
**Công ty:** CÔNG TY TNHH MTV TMDV VẬN TẢI NGỌC ANH TRANSPORT
