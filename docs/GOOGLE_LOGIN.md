# Đăng nhập Google

FE dùng nút chính thức của Google Identity Services, mở hộp chọn tài khoản và gửi `credential` đến `POST /api/Auth/google` dưới dạng `{ "idToken": "..." }`. BE xác minh token, tạo Member nếu email chưa tồn tại, hoặc giữ role của tài khoản hiện có. FE lưu phiên do BE trả về và điều hướng theo role, giống đăng nhập bằng mật khẩu. Lựa chọn ghi nhớ đăng nhập và đường dẫn quay lại được giữ nguyên.

## Cấu hình môi trường

1. Trong Google Cloud, tạo OAuth client loại **Web application**, cấu hình Branding/Audience. Khi ứng dụng đang ở chế độ Testing, thêm email thử nghiệm nếu Google yêu cầu.
2. Thêm `http://localhost` và `http://localhost:3000` vào **Authorized JavaScript origins**. Khi triển khai, thêm origin HTTPS của FE.
3. Chạy cả FE và BE local: cấu hình FE `.env.local` như sau:

   ```dotenv
   VITE_API_BASE=
   API_PROXY_TARGET=https://sportscenterbe-2.onrender.com
   VITE_GOOGLE_CLIENT_ID=CLIENT_ID_GOOGLE_THAT
   ```

   Thay `CLIENT_ID_GOOGLE_THAT` bằng toàn bộ Client ID Google cấp, thường có dạng `1234567890-abc123.apps.googleusercontent.com`. FE chạy tại `http://localhost:3000`, gửi API đến `/api` và Vite chuyển tiếp sang BE đã deploy tại `https://sportscenterbe-2.onrender.com`.

   `.env.local` được ưu tiên hơn `.env` và được Git bỏ qua. Điền Client ID trong `.env.local` để tránh bị giá trị trống ghi đè. Khi thiếu Client ID thật, terminal Vite sẽ nhắc cấu hình và nút Google vẫn hiển thị chưa sẵn sàng.
4. Đặt cùng Client ID trong cấu hình BE `GoogleAuth:ClientId` (User Secrets hoặc biến môi trường `GoogleAuth__ClientId`). Luồng ID token này không cần Client Secret trên FE.
5. Chạy `npm run dev` trong thư mục FE và mở `http://localhost:3000/login`; không cần khởi động BE local. Khởi động lại Vite sau khi sửa `.env.local`. Với FE build tĩnh, build lại sau khi đổi biến `VITE_...`.

Nếu thiếu Client ID hoặc còn dùng giá trị mẫu, nút Google hiển thị chưa sẵn sàng. SDK bị chặn hoặc mất mạng có nút thử lại; đăng nhập bằng mật khẩu vẫn sử dụng được.

## Kiểm tra với Google thật

- Mở `http://localhost:3000/login`, chọn Google và tài khoản được phép. Kiểm tra request `/api/Auth/google` chỉ gửi `idToken`; BE trả `token`, thông tin người dùng và refresh token.
- Email mới vào trang Member; email đã tồn tại vào trang đúng role. Tài khoản bị khóa hiển thị lỗi.
- Bỏ chọn ghi nhớ đăng nhập: phiên chỉ nằm trong session storage. Chọn ghi nhớ: phiên được lưu theo cơ chế hiện có. Google ID token không được lưu vào storage.
- Đóng hộp chọn Google rồi đăng nhập bằng mật khẩu. Thử mất kết nối hoặc BE trả lỗi: không tạo phiên đăng nhập sai.
- Kiểm tra đường dẫn quay lại khi đăng nhập để tiếp tục đăng ký gói/thanh toán.

Kiểm thử tự động sử dụng SDK và API giả lập; xác thực Google thật cần Client ID hợp lệ và BE chạy với cấu hình tương ứng.

Tài liệu: [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference).
