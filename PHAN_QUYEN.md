# PHÂN QUYỀN HỆ THỐNG

## Các vai trò (Roles)

### 1. Admin (Quản trị viên)
- **Toàn quyền**: Truy cập mọi chức năng
- **Đặc quyền**:
  - Quản lý user (thêm/sửa/xóa/đổi mật khẩu)
  - Xóa đơn hàng
  - Xóa khách hàng
  - Xóa tài xế, xe, container

### 2. Accountant (Kế toán)
- **Chức năng tài chính**:
  - ✅ Ghi nhận thanh toán
  - ✅ Xóa thanh toán
  - ✅ Xem báo cáo tài chính
  - ✅ Xuất bảng kê, hóa đơn
  - ✅ Quản lý công nợ
  - ✅ Thêm/sửa khách hàng (để ghi nhận thông tin thanh toán)
  - ❌ Không thể tạo/sửa đơn hàng
  - ❌ Không thể phân công xe/tài xế

### 3. Dispatcher (Điều độ)
- **Chức năng vận hành**:
  - ✅ Tạo đơn hàng mới
  - ✅ Cập nhật đơn hàng (trạng thái, thông tin vận chuyển)
  - ✅ Phân công xe, tài xế, container
  - ✅ Quản lý lộ trình
  - ✅ Thêm/sửa khách hàng
  - ✅ Quản lý tài xế, xe, container
  - ❌ Không thể ghi nhận thanh toán
  - ❌ Không thể xem báo cáo tài chính chi tiết

### 4. Staff (Nhân viên)
- **Chức năng cơ bản**:
  - ✅ Xem danh sách đơn hàng
  - ✅ Xem thông tin khách hàng
  - ✅ Xem thông tin tài xế, xe
  - ❌ Không thể tạo/sửa/xóa bất kỳ dữ liệu nào

## Ma trận phân quyền chi tiết

| Chức năng | Admin | Accountant | Dispatcher | Staff |
|-----------|-------|------------|------------|-------|
| **Đơn hàng** |
| Xem danh sách | ✅ | ✅ | ✅ | ✅ |
| Tạo mới | ✅ | ❌ | ✅ | ❌ |
| Cập nhật | ✅ | ❌ | ✅ | ❌ |
| Xóa | ✅ | ❌ | ❌ | ❌ |
| **Thanh toán** |
| Xem | ✅ | ✅ | ✅ | ✅ |
| Ghi nhận | ✅ | ✅ | ❌ | ❌ |
| Xóa | ✅ | ✅ | ❌ | ❌ |
| **Khách hàng** |
| Xem | ✅ | ✅ | ✅ | ✅ |
| Thêm/Sửa | ✅ | ✅ | ✅ | ❌ |
| Xóa | ✅ | ❌ | ❌ | ❌ |
| **Tài xế/Xe/Container** |
| Xem | ✅ | ✅ | ✅ | ✅ |
| Thêm/Sửa | ✅ | ❌ | ✅ | ❌ |
| Xóa | ✅ | ❌ | ❌ | ❌ |
| **Báo cáo** |
| Doanh thu/Chi phí | ✅ | ✅ | ✅ | ✅ |
| Lợi nhuận chi tiết | ✅ | ✅ | ❌ | ❌ |
| Báo cáo thuế | ✅ | ✅ | ❌ | ❌ |
| **Quản lý User** |
| Xem danh sách | ✅ | ❌ | ❌ | ❌ |
| Thêm/Sửa/Xóa | ✅ | ❌ | ❌ | ❌ |
| Đổi mật khẩu bản thân | ✅ | ✅ | ✅ | ✅ |

## Hướng dẫn sử dụng

### Tạo tài khoản mới
1. Đăng nhập với tài khoản Admin
2. Vào menu **Quản lý User**
3. Click **Thêm user**
4. Nhập thông tin:
   - Username: Tên đăng nhập (không trùng)
   - Mật khẩu: Tối thiểu 6 ký tự
   - Họ tên: Tên đầy đủ của nhân viên
   - Vai trò: Chọn vai trò phù hợp
5. Click **Lưu**

### Phân quyền hợp lý
- **Kế toán viên**: Chọn role "Accountant"
- **Nhân viên điều độ**: Chọn role "Dispatcher"
- **Nhân viên văn phòng**: Chọn role "Staff"
- **Quản lý cao cấp**: Chọn role "Admin" (hạn chế số lượng)

### Đổi mật khẩu
- Admin có thể đổi mật khẩu cho bất kỳ user nào
- User thường chỉ đổi được mật khẩu của chính mình

## Lưu ý bảo mật
1. ⚠️ Không chia sẻ tài khoản Admin
2. ⚠️ Đổi mật khẩu định kỳ (3-6 tháng)
3. ⚠️ Vô hiệu hóa user khi nhân viên nghỉ việc
4. ⚠️ Review quyền hạn định kỳ
5. ⚠️ Chỉ cấp quyền tối thiểu cần thiết cho công việc
