# 🔧 HƯỚNG DẪN SỬ DỤNG MODULE QUẢN LÝ LƯƠNG

## 📋 Tổng quan

Module Quản lý Lương giúp bạn:
- Tính lương tháng cho tài xế dựa trên số chuyến hoàn thành
- Quản lý thưởng/phạt
- Xem chi tiết và xuất báo cáo Excel
- Tự động cập nhật khi có thay đổi thưởng/phạt

## ✅ VẤN ĐỀ ĐÃ ĐƯỢC GIẢI QUYẾT

### Vấn đề trước đây:
- Tài xế xuất hiện 2 lần trong bảng lương
- Một dòng hiển thị lương tháng, một dòng hiển thị thưởng riêng lẻ
- Thưởng/phạt không được tự động cập nhật vào bản lương

### Giải pháp đã áp dụng:
1. ✅ **Tách biệt 2 tab**: "Bảng lương" và "Thưởng/Phạt"
2. ✅ **Tự động cập nhật**: Khi thêm/xóa thưởng phạt, bản lương tự động tính lại (nếu ở trạng thái Nháp)
3. ✅ **Nút "Tính lại"**: Cho phép tính lại bản lương bất kỳ lúc nào
4. ✅ **Nút "Xem chi tiết"**: Xem chi tiết chuyến hàng, thưởng/phạt của từng tháng
5. ✅ **Export Excel**: Xuất toàn bộ dữ liệu lương ra file Excel

## 🎯 CÁCH SỬ DỤNG

### 1. Tính lương tháng cho tài xế

**Bước 1:** Click nút **"➕ Tính lương tháng"**

**Bước 2:** Chọn thông tin:
- **Tài xế**: Chọn tài xế cần tính lương
- **Tháng**: Chọn tháng (mặc định là tháng trước)
- **Lương cơ bản**: Nhập lương cơ bản (mặc định 8.000.000 đ)

**Bước 3:** Click **"🔍 Tính toán"** để xem preview

Hệ thống sẽ tự động:
- Đếm số chuyến hoàn thành trong tháng
- Tính tổng thưởng từ bảng Thưởng/Phạt
- Tính tổng phạt từ bảng Thưởng/Phạt
- Tính tạm ứng chưa quyết toán
- Tính tổng lương = Cơ bản + Thưởng - Phạt - Tạm ứng

**Bước 4:** Nếu đồng ý, click **"💾 Lưu bản lương"**

> **Lưu ý:** Bản lương mới được tạo ở trạng thái "Nháp". Bạn có thể sửa hoặc xóa.

### 2. Thêm thưởng/phạt cho tài xế

**Bước 1:** Click nút **"⭐ Thưởng/Phạt"**

**Bước 2:** Điền thông tin:
- **Tài xế**: Chọn tài xế
- **Loại**: Thưởng hoặc Phạt
- **Ngày**: Ngày thưởng/phạt
- **Số tiền**: Nhập số tiền (VNĐ)
- **Lý do**: Mô tả lý do (ví dụ: "Hoàn thành tốt nhiệm vụ được giao")
- **Đơn hàng liên quan** (tùy chọn): Nếu có

**Bước 3:** Click **"💾 Lưu"**

> **✨ TỰ ĐỘNG CẬP NHẬT**: Nếu đã có bản lương tháng đó ở trạng thái "Nháp", hệ thống sẽ **tự động tính lại** và cập nhật thưởng/phạt vào bản lương!

### 3. Xem chi tiết bản lương

**Bước 1:** Trong bảng lương, click nút **"👁️ Xem chi tiết"**

Modal chi tiết sẽ hiển thị:
- **Thông tin tổng quan**: Lương cơ bản, số chuyến, trạng thái
- **Danh sách chuyến hàng hoàn thành**: Mã đơn, ngày, khách hàng, giá trị
- **Danh sách thưởng/phạt**: Ngày, loại, số tiền, lý do
- **Bảng tổng kết**: Chi tiết tính toán từng khoản

**Cảnh báo thông minh:**
- Nếu có thưởng/phạt nhưng chưa được tính vào bản lương, hệ thống sẽ hiển thị cảnh báo màu vàng
- Click nút **"🔄 Tính lại bản lương"** để cập nhật

### 4. Tính lại bản lương

**Khi nào cần tính lại?**
- Thêm/xóa thưởng phạt sau khi đã tạo bản lương
- Cập nhật trạng thái đơn hàng (từ "Đang vận chuyển" → "Hoàn thành")
- Phát hiện số liệu không chính xác

**Cách 1:** Trong modal chi tiết, click **"🔄 Tính lại"**

**Cách 2:** Trong tab "Bảng lương", click nút **"✏️ Sửa"**, sau đó click **"🔄 Tính lại"**

> **Lưu ý:** Chỉ có thể tính lại bản lương ở trạng thái "Nháp". Bản lương đã "Duyệt" hoặc "Đã trả" không thể tính lại.

### 5. Duyệt và trả lương

**Duyệt bản lương:**
- Click nút **"✅ Duyệt"** trong cột Thao tác
- Sau khi duyệt, bản lương không thể sửa hoặc xóa

**Trả lương:**
- Click nút **"💰 Trả lương"**
- Chọn ngày trả và phương thức thanh toán (Tiền mặt/Chuyển khoản)
- Sau khi trả, trạng thái chuyển sang "Đã trả"

### 6. Export dữ liệu ra Excel

**Bước 1:** Lọc dữ liệu (tùy chọn):
- Chọn tháng trong dropdown "-- Tất cả tháng --"
- Chọn tài xế trong dropdown "-- Tất cả tài xế --"

**Bước 2:** Click nút **"📊 Export Excel"**

File Excel sẽ được tải xuống với tên: `Luong_TaiXe_2026-01_[timestamp].xls`

File bao gồm:
- Tiêu đề: "BẢNG LƯƠNG TÀI XẾ - THÁNG [tháng]"
- Ngày xuất
- Bảng dữ liệu đầy đủ
- Dòng tổng cộng ở cuối

## 📊 HIỂU VỀ CÁC TAB

### Tab "Bảng lương"
Hiển thị **bản lương tổng hợp theo tháng** cho từng tài xế:
- Mỗi tài xế có **1 dòng duy nhất** cho mỗi tháng
- Hiển thị: Tháng, Tài xế, Lương cơ bản, Số chuyến, Thưởng, Phạt, Tạm ứng, Tổng lương
- Đây là bảng **chính thức** để duyệt và trả lương

### Tab "Thưởng/Phạt"
Hiển thị **từng khoản thưởng/phạt riêng lẻ**:
- Mỗi khoản thưởng/phạt là 1 dòng riêng
- Hiển thị: Ngày, Tài xế, Loại, Lý do, Số tiền, Đơn hàng
- Dùng để **xem chi tiết** và **quản lý** từng khoản

**❗ QUAN TRỌNG:**
- Thưởng/phạt trong tab "Thưởng/Phạt" sẽ **tự động được tính** vào "Bảng lương"
- Bạn KHÔNG cần nhập thưởng/phạt 2 lần
- Nếu thêm thưởng/phạt sau khi đã tạo bản lương, hãy click "Tính lại"

## 🔧 SCRIPT BẢO TRÌ

### Kiểm tra dữ liệu lương
```bash
node check-salary-duplicates.js
```
Kiểm tra:
- Bản lương trùng lặp (cùng tài xế + tháng)
- Bản lương đáng ngờ (không có lương cơ bản, không có chuyến)
- Thống kê thưởng/phạt

### Kiểm tra tính toán lương tháng cụ thể
```bash
node check-salary-calculation.js
```
Kiểm tra chi tiết tính toán lương tháng 2026-01:
- So sánh thưởng/phạt trong bảng lương vs thực tế
- Kiểm tra tổng lương có chính xác không
- Phát hiện thưởng/phạt chưa được tính vào

### Sửa bản lương không chính xác
```bash
node fix-salaries.js
```
Tự động:
- Quét tất cả bản lương
- Tính lại thưởng/phạt từ database
- Cập nhật bản lương nếu phát hiện sai lệch

## 💡 MẸO SỬ DỤNG

1. **Tạo bản lương định kỳ**: Mỗi đầu tháng, tính lương cho tất cả tài xế
2. **Giữ trạng thái "Nháp"**: Trong suốt tháng để có thể cập nhật khi có thưởng/phạt mới
3. **Duyệt cuối tháng**: Sau khi chắc chắn tất cả dữ liệu đã đúng
4. **Backup trước khi trả**: Export Excel để lưu trữ trước khi đánh dấu "Đã trả"
5. **Kiểm tra định kỳ**: Chạy script `check-salary-calculation.js` mỗi tháng

## ❓ GIẢI ĐÁP THẮC MẮC

### Q: Tại sao tài xế xuất hiện nhiều lần?
**A:** Kiểm tra bạn đang xem tab nào:
- **Tab "Bảng lương"**: Mỗi tài xế chỉ xuất hiện 1 lần cho mỗi tháng
- **Tab "Thưởng/Phạt"**: Mỗi khoản thưởng/phạt là 1 dòng riêng (bình thường)

### Q: Thêm thưởng rồi nhưng tổng lương không tăng?
**A:** Có 2 trường hợp:
1. **Bản lương ở trạng thái "Nháp"**: Hệ thống đã tự động cập nhật (reload lại trang)
2. **Bản lương đã "Duyệt" hoặc "Đã trả"**: Không thể tự động cập nhật, cần tạo bản lương mới hoặc điều chỉnh thủ công

### Q: Làm sao để sửa bản lương đã duyệt?
**A:** Bản lương đã duyệt không thể sửa trực tiếp. Giải pháp:
1. Xóa bản lương cũ (cần quyền admin)
2. Tạo bản lương mới với số liệu chính xác
3. Hoặc tạo khoản thưởng/phạt điều chỉnh trong tháng sau

### Q: Số chuyến không khớp với đơn hàng?
**A:** Hệ thống chỉ đếm đơn hàng có:
- **Tài xế** được gán
- **Trạng thái** = "Hoàn thành"
- **Ngày giao hàng** trong tháng tính lương

Kiểm tra 3 điều kiện trên trong module "Quản lý Đơn hàng".

### Q: Tính lại bản lương bị lỗi?
**A:** Chạy script kiểm tra:
```bash
node check-salary-calculation.js
```
Nếu vẫn lỗi, liên hệ admin để kiểm tra database.

## 📞 HỖ TRỢ

Nếu gặp vấn đề, vui lòng:
1. Chạy script kiểm tra: `node check-salary-duplicates.js`
2. Chụp màn hình lỗi
3. Kiểm tra console log (F12 → Console)
4. Liên hệ bộ phận IT

---

**📅 Cập nhật lần cuối: 2026-01**  
**✍️ Phiên bản: 2.0**
