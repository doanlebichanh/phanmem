# 📝 CẢI TIẾN MODULE GHI THU/CHI

## ✅ VẤN ĐỀ ĐÃ GIẢI QUYẾT

### Trước đây:
- ❌ Chỉ có thể chọn 1 danh mục
- ❌ Phải tự nhập số tiền thủ công
- ❌ Không tự động tính tổng
- ❌ Khó ghi chi phí nhiều loại cùng lúc
- ❌ Dữ liệu rời rạc, thiếu logic liên kết

### Bây giờ:
- ✅ **Chọn nhiều danh mục** trong 1 giao dịch
- ✅ **Tự động tính tổng tiền** theo thời gian thực
- ✅ **Thêm/Xóa danh mục** linh hoạt
- ✅ **Mô tả riêng** cho từng danh mục
- ✅ **Nhóm giao dịch liên quan** với transaction_group
- ✅ **Liên kết logic** với Đơn hàng/Tài xế/Xe

## 🎯 CÁCH SỬ DỤNG

### 1. Ghi chi phí đơn giản (1 danh mục)

**Bước 1:** Vào menu **"💰 Thu Chi"** → Click **"➕ Ghi Thu/Chi"**

**Bước 2:** Điền thông tin cơ bản:
- **Ngày giao dịch**: Chọn ngày
- **Loại**: Chọn "💸 Chi" hoặc "💵 Thu"

**Bước 3:** Chọn danh mục và nhập số tiền:
- Danh mục sẽ tự động hiển thị theo loại đã chọn
- Nhập số tiền
- Mô tả chi tiết (tùy chọn)
- **Tổng cộng** sẽ tự động cập nhật

**Bước 4:** Điền thông tin khác:
- Mô tả chung
- Phương thức thanh toán
- Liên kết với Đơn hàng/Tài xế/Xe (nếu có)

**Bước 5:** Click **"💾 Lưu"**

### 2. Ghi chi phí nhiều danh mục (VÍ DỤ: Đổ xăng + Bảo dưỡng)

**Ví dụ thực tế:** Xe đi đổ xăng 2 triệu, vừa bảo dưỡng thêm 1.5 triệu

**Bước 1:** Vào **"Ghi Thu/Chi"**

**Bước 2:** Chọn **"💸 Chi"**

**Bước 3:** Dòng đầu tiên:
- Chọn **"⛽ Chi phí nhiên liệu"**
- Nhập **2,000,000**
- Mô tả: "Đổ xăng tại trạm PTT"

**Bước 4:** Click **"➕ Thêm danh mục"**

**Bước 5:** Dòng thứ 2:
- Chọn **"🔧 Bảo dưỡng"**
- Nhập **1,500,000**
- Mô tả: "Thay dầu động cơ"

**Bước 6:** Xem tổng cộng:
- Hệ thống tự động tính: **3,500,000 đ**

**Bước 7:** Điền thông tin chung:
- Mô tả chung: "Chi phí xe 50E21256 ngày 07/01/2026"
- Liên kết Xe: Chọn "50E21256"
- Phương thức: Chuyển khoản

**Bước 8:** Click **"💾 Lưu"**

Hệ thống sẽ tạo **2 giao dịch riêng biệt** nhưng được nhóm lại với nhau.

### 3. Sửa/Xóa danh mục

**Xóa danh mục:**
- Click nút **🗑️** bên phải dòng muốn xóa
- Lưu ý: Phải có ít nhất 1 danh mục

**Thêm danh mục:**
- Click nút **"➕ Thêm danh mục"** phía trên
- Dòng mới sẽ xuất hiện ở cuối

**Sửa số tiền:**
- Nhập số tiền mới → Tổng cộng tự động cập nhật

## 💡 CÁC DANH MỤC CHI PHÍ

### Khi chọn "💸 Chi":
1. **⛽ Chi phí nhiên liệu** - Đổ xăng, dầu diesel
2. **💵 Lương** - Trả lương tài xế, nhân viên
3. **🔧 Bảo dưỡng** - Sửa chữa, bảo dưỡng xe
4. **🛡️ Bảo hiểm** - Bảo hiểm xe, bảo hiểm tài xế
5. **💰 Thuế** - Thuế đường bộ, phí đăng kiểm
6. **⚠️ Phạt** - Phạt nguội, phạt vi phạm giao thông
7. **➖ Chi khác** - Chi phí khác

### Khi chọn "💵 Thu":
1. **🚚 Cước vận chuyển** - Thu từ khách hàng
2. **➕ Thu khác** - Thu khác

## 🔗 LIÊN KẾT DỮ LIỆU

### Liên kết với Đơn hàng
**Khi nào dùng:**
- Chi phí liên quan đến đơn hàng cụ thể
- VD: Xăng xe cho đơn #DH2026001

**Lợi ích:**
- Theo dõi chi phí theo đơn hàng
- Tính lãi/lỗ chính xác
- Báo cáo chi tiết theo đơn

### Liên kết với Tài xế
**Khi nào dùng:**
- Chi phí liên quan đến tài xế
- VD: Trả lương, phạt, thưởng

**Lợi ích:**
- Theo dõi chi phí theo tài xế
- Tự động cập nhật khi tính lương
- Báo cáo hiệu suất tài xế

### Liên kết với Xe
**Khi nào dùng:**
- Chi phí liên quan đến xe cụ thể
- VD: Bảo dưỡng, sửa chữa, đổ xăng

**Lợi ích:**
- Theo dõi chi phí theo xe
- Lịch sử bảo trì xe
- Tính khấu hao

## 📊 XEM DỮ LIỆU

### Trong bảng Thu Chi
Mỗi dòng hiển thị:
- **Ngày**: Ngày giao dịch
- **Loại**: Thu/Chi
- **Danh mục**: Loại chi phí
- **Số tiền**: Số tiền với màu sắc (đỏ = chi, xanh = thu)
- **Mô tả**: Mô tả chi tiết
- **Liên kết**: Đơn hàng/Tài xế/Xe (nếu có)

### Xem chi tiết
Click vào dòng → Xem đầy đủ thông tin:
- Ngày giao dịch
- Phương thức thanh toán
- Số tham chiếu
- Ghi chú
- Người tạo

### Các giao dịch cùng nhóm
Nếu ghi nhiều danh mục cùng lúc, các giao dịch sẽ có:
- **Cùng ngày**
- **Cùng phương thức thanh toán**
- **Cùng liên kết** (đơn hàng/tài xế/xe)
- **Mô tả tương tự**

## 🎨 GIAO DIỆN MỚI

### Tổng cộng tự động
```
┌─────────────────────────────────────┐
│  💰 TỔNG CỘNG:        3,500,000 đ   │
└─────────────────────────────────────┘
```
- Màu gradient đẹp mắt
- Cập nhật theo thời gian thực
- Font chữ lớn, dễ nhìn

### Dòng danh mục
```
┌──────────────────────────────────────────────────┐
│ [Danh mục ▼]  [Số tiền]  [Mô tả chi tiết]  [🗑️] │
└──────────────────────────────────────────────────┘
```
- Layout ngang, dễ nhìn
- Nút xóa bên phải
- Hover hiển thị hiệu ứng

### Nút thêm danh mục
```
┌─────────────────────────────────────┐
│        ➕ Thêm danh mục             │
└─────────────────────────────────────┘
```

## ⚙️ KỸ THUẬT

### Database Schema
```sql
ALTER TABLE cash_flow ADD COLUMN transaction_group INTEGER;
ALTER TABLE cash_flow ADD COLUMN category_details TEXT;
```

- **transaction_group**: Timestamp để nhóm các giao dịch liên quan
- **category_details**: JSON chứa chi tiết từng danh mục

### Logic lưu dữ liệu

**Trường hợp 1: Tạo mới (nhiều danh mục)**
```javascript
// Lưu 3 giao dịch riêng biệt
// Cùng transaction_group
{
  category: 'fuel_cost',
  amount: 2000000,
  transaction_group: 1736236800000
}
{
  category: 'maintenance',
  amount: 1500000,
  transaction_group: 1736236800000
}
```

**Trường hợp 2: Sửa (backward compatible)**
```javascript
// Chỉ cập nhật 1 record
// Lưu chi tiết vào category_details
{
  category: 'fuel_cost', // danh mục đầu tiên
  amount: 3500000, // tổng
  category_details: JSON.stringify([
    {category: 'fuel_cost', amount: 2000000},
    {category: 'maintenance', amount: 1500000}
  ])
}
```

### Validation

1. **Phải có ít nhất 1 danh mục**
2. **Mỗi danh mục phải có:**
   - Loại danh mục được chọn
   - Số tiền > 0
3. **Mô tả chung bắt buộc**
4. **Ngày giao dịch bắt buộc**
5. **Loại (Thu/Chi) bắt buộc**

## 📱 RESPONSIVE

Form tự động điều chỉnh:
- Desktop: 3 cột (Danh mục | Số tiền | Mô tả)
- Tablet: 2 cột
- Mobile: 1 cột (xếp chồng)

## 🔒 BẢO MẬT

- Chỉ **Admin** và **Accountant** mới được thêm/sửa
- Chỉ **Admin** mới được xóa
- Audit log ghi lại mọi thao tác
- Token authentication

## 🐛 XỬ LÝ LỖI

### Lỗi: "Vui lòng thêm ít nhất 1 danh mục"
**Nguyên nhân:** Chưa có danh mục nào
**Giải pháp:** Click "➕ Thêm danh mục"

### Lỗi: "Vui lòng chọn danh mục cho dòng X"
**Nguyên nhân:** Dòng X chưa chọn danh mục
**Giải pháp:** Chọn danh mục từ dropdown

### Lỗi: "Vui lòng nhập số tiền cho dòng X"
**Nguyên nhân:** Số tiền = 0 hoặc chưa nhập
**Giải pháp:** Nhập số tiền > 0

### Lỗi khi lưu
**Nguyên nhân:** Lỗi server hoặc mất kết nối
**Giải pháp:**
1. Kiểm tra kết nối mạng
2. Reload trang
3. Thử lại

## 📈 BÁO CÁO

### Xem theo danh mục
```
⛽ Chi phí nhiên liệu: 45,000,000 đ (30%)
💵 Lương:              35,000,000 đ (23%)
🔧 Bảo dưỡng:         20,000,000 đ (13%)
```

### Xem theo xe
```
50E21256: 15,000,000 đ
50E33148: 12,000,000 đ
```

### Xem theo tài xế
```
NGUYỄN VĂN CHƠN: 8,000,000 đ
LÊ VĂN B: 7,500,000 đ
```

## 💡 MẸO SỬ DỤNG

1. **Ghi chi phí ngay khi phát sinh** - Không để tích lũy
2. **Liên kết đầy đủ** - Liên kết với đơn hàng/tài xế/xe để dễ theo dõi
3. **Mô tả chi tiết** - Viết rõ ràng để sau này dễ tìm
4. **Phân loại đúng** - Chọn đúng danh mục để báo cáo chính xác
5. **Lưu chứng từ** - Ghi số hóa đơn vào "Số tham chiếu"

## ❓ FAQ

**Q: Có thể sửa giao dịch đã lưu không?**
A: Có, click vào dòng → Sửa → Lưu

**Q: Xóa danh mục sẽ ảnh hưởng gì?**
A: Không ảnh hưởng gì. Dữ liệu cũ vẫn giữ nguyên.

**Q: Tối đa bao nhiêu danh mục?**
A: Không giới hạn, nhưng khuyến nghị < 10 để dễ quản lý

**Q: Có thể import từ Excel không?**
A: Hiện tại chưa có, đang phát triển

**Q: Làm sao biết các giao dịch cùng nhóm?**
A: Xem cột transaction_group trong database hoặc lọc theo ngày + mô tả tương tự

---

**📅 Cập nhật:** 07/01/2026  
**✍️ Phiên bản:** 3.0  
**🎯 Tính năng:** Multi-category Cash Flow
