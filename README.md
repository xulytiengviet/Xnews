# Xnews · Trạm tin an ninh mạng

Dashboard tiếng Việt theo dõi 100 tài khoản X và hiển thị bài có liên kết GitHub. Long Ngo thiết kế. MIT.

## Kích hoạt

1. Tạo ứng dụng X Developer có quyền đọc user timelines; kiểm tra ngân sách và điều kiện API trong tài khoản. Không giả định API miễn phí hoặc một mức giá cố định.
2. Trong repo → Settings → Secrets and variables → Actions → New repository secret, thêm `X_BEARER_TOKEN`. Không commit token, không nhập vào trình duyệt.
3. Settings → Pages → Source: **GitHub Actions**.
4. Actions → **Xnews monitor and Pages** → Run workflow, nhánh main.
5. Mở https://xulytiengviet.github.io/Xnews/ sau khi deploy thành công.

## Kiến trúc

X API v2 → `monitor.py` → `tweets.json` → dashboard HTML/CSS/JS. Không cần thư viện Python bên ngoài, database hoặc máy chủ thường trực.

- `accounts.json`: chỉnh danh sách username (không có @).
- GitHub Actions chạy phút 17 và 47 mỗi giờ UTC; lịch có thể trễ, không phải realtime. Lịch chỉ chạy trên nhánh mặc định, có thể bị tắt khi repo không hoạt động theo chính sách GitHub.
- Dashboard đọc JSON mỗi 60 giây khi tab đang hiển thị. Nút Làm mới không gọi X API. Tạm dừng chỉ dừng đọc tự động ở trình duyệt.
- Lần đầu đọc 24 giờ gần nhất; các lần sau dùng `since_id`; loại replies/retweets.
- Cache user ID; phân trang tối đa 20 trang × 100 bài/tài khoản/lượt. Nếu chưa đọc hết hoặc lỗi, không nâng mốc tài khoản đó. Không cam kết khôi phục bài ngoài giới hạn lịch sử của X API.
- Lưu 200 bài mới nhất chứa URL HTTPS với hostname chính xác github.com/www.github.com. Xử lý URL mở rộng từ entities.
- HTTP 401/402/403/429 dừng lượt, giữ dữ liệu cũ và báo lỗi; thử lại theo lịch kế tiếp. Các lỗi mạng khác giữ mốc tài khoản tương ứng.
- Trạng thái kết nối, lỗi từng tài khoản, lần thành công và dữ liệu quá 90 phút được hiển thị rõ ràng. Không tạo tweet giả.
- Deploy artifact chỉ chứa 6 tệp giao diện/dữ liệu. Mỗi workflow tự deploy sau thu thập, không phụ thuộc push của GITHUB_TOKEN kích hoạt workflow mới.

## Chạy tại máy

Python 3.11+; đặt X_BEARER_TOKEN qua môi trường rồi chạy `python monitor.py`. Xem dashboard bằng `python -m http.server 8000`. Kiểm thử: `python -m unittest discover -s tests -v`.

## Dữ liệu và vận hành

Repo và Pages công khai: nội dung thu thập có thể được mọi người đọc. Không dùng nguồn riêng tư. Bài xóa/sửa trên X không được tự đối soát ở phiên bản này; quản trị viên cần xóa dữ liệu tương ứng khỏi JSON và cân nhắc lịch sử Git trước khi dùng lưu trữ dài hạn. Giấy phép MIT áp dụng mã nguồn, không chuyển quyền sở hữu nội dung bài X.

API có thể tính phí, giới hạn quyền hoặc lưu lượng; kiểm tra trên https://console.x.com/ và https://docs.x.com/. Tham khảo phân trang: https://docs.x.com/xdks/python/pagination.

## Mở rộng danh mục — 16/10/2026

Giữ 30 tài khoản cũ và thêm 70 tài khoản cá nhân không trùng. `accounts.json` chứa username, tên hiển thị, nhóm chuyên môn và nguồn tham khảo; `topics.json` chứa 9 bộ từ khóa bài viết. Bộ lọc chủ đề là heuristic, không phải phân loại khoa học hay xác nhận chuyên môn của tác giả. Tìm kiếm danh mục hoạt động ngay cả khi chưa có tweet.

Không chuyển các mục ecosystem, tập thể, người đã có trong danh sách hoặc handle mơ hồ thành tài khoản giả. Chưa thêm MG, Nicholas Carlini, Andrew Morris, Chris Sanders và Sammy Azdoufal do chưa chốt handle trong lần cập nhật này. Thay chỗ trùng/không cụ thể bằng 12 hồ sơ mật mã và Ivan Fratric. Katie Nickels dùng `likethecoins`. Matt Huang được xếp Blockchain, không ghi là chuyên gia kiểm toán mật mã.

Phần lớn handle do người dùng cung cấp; chỉ một số đã đối chiếu nguồn công khai, ghi rõ ở từng hồ sơ. Không gắn nhãn “đã xác minh” cho toàn bộ 100 người và chưa xác nhận tài khoản còn hoạt động bằng X API. Danh mục không phải chứng nhận đạo đức hoặc bảo chứng cho mọi nội dung của các tài khoản.

100 tài khoản có thể tăng số lượt API và chi phí so với 30. Lọc GitHub/chủ đề diễn ra sau khi X trả dữ liệu, không làm giảm số bài bị API tính phí. Giữ lịch 30 phút theo cấu hình hiện tại; cân nhắc giảm tần suất trong workflow nếu cần.
