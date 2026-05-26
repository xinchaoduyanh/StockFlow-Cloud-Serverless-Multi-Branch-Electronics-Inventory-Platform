# 📂 StockFlow Cloud - Test Datasets Cheat Sheet

Welcome to your inventory import testing folder! This folder contains curated, diverse, and robust `.xlsx` test files tailored specifically for the StockFlow import validation pipeline.

---

## ❓ Tại sao hệ thống không sử dụng file `.csv`?

Hệ thống **StockFlow Cloud** được thiết kế chuyên biệt cho việc quản lý chuỗi cung ứng thiết bị điện tử, nơi dữ liệu Excel `.xlsx` là tiêu chuẩn ngành:

1. **Kiểm soát kiểu dữ liệu mạnh mẽ:** File Excel (.xlsx) giúp lưu trữ định dạng ô (số, ngày tháng, văn bản) tốt hơn nhiều so với `.csv` (chỉ là văn bản thuần túy ngăn cách bởi dấu phẩy).
2. **Cấu trúc bảo vệ nhiều cột:** Với hơn 25 cột thuộc tính linh kiện điện tử chuyên biệt (RAM, CPU, GPU, v.v.), việc dùng Excel đảm bảo người dùng không bị lệch cột hoặc sai hàng.
3. **Bảo mật và Hiệu suất:** Toàn bộ API ký S3 URL (Presigned URL) và hàm Lambda Validator trên AWS đều được cấu hình kiểm tra định dạng đuôi file `.xlsx`. Nếu upload file `.csv`, hệ thống sẽ chặn và báo lỗi ngay lập tức để tiết kiệm chi phí băng thông và tài nguyên CPU Serverless.

---

## 📋 Danh sách các File Test trong thư mục

### 🟢 Nhóm 1: Dữ liệu hợp lệ 100% (Success Path)

#### 1. `01_all_valid_16_rows.xlsx`

- **Tổng số dòng:** 16 dòng
- **Số dòng Hợp lệ:** 16 | **Số dòng Lỗi:** 0
- **Nội dung:** Chứa đầy đủ sản phẩm thực tế thuộc tất cả **8 danh mục** linh kiện phần cứng (RAM, CPU, GPU, SSD, MAINBOARD, PSU, CASE, COOLER).
- **Mục tiêu test:** Kiểm tra luồng chạy hoàn hảo từ lúc upload ➡️ validator ➡️ parser ➡️ writer ghi thành công vào DB.

#### 2. `02_cpus_only_4_rows_valid.xlsx`

- **Tổng số dòng:** 4 dòng
- **Số dòng Hợp lệ:** 4 | **Số dòng Lỗi:** 0
- **Nội dung:** Chỉ chứa các sản phẩm CPU cao cấp của Intel và AMD.
- **Mục tiêu test:** Đảm bảo các thông số kỹ thuật riêng biệt của CPU (`socket`, `cores`, `threads`) được ghi nhận chuẩn xác.

#### 3. `03_gpus_ssds_4_rows_valid.xlsx`

- **Tổng số dòng:** 4 dòng
- **Số dòng Hợp lệ:** 4 | **Số dòng Lỗi:** 0
- **Nội dung:** Chỉ chứa các sản phẩm GPU (card đồ họa) và ổ cứng SSD.
- **Mục tiêu test:** Đảm bảo các thuộc tính `vramgb`, `interface` (NVMe/SATA), `capacitygb` được ánh xạ đúng.

#### 4. `04_extreme_prices_2_rows_valid.xlsx`

- **Tổng số dòng:** 2 dòng
- **Số dòng Hợp lệ:** 2 | **Số dòng Lỗi:** 0
- **Nội dung:** Chứa sản phẩm siêu đắt (Card AI NVIDIA H100 giá **$32,000**) và sản phẩm siêu rẻ (DDR3 cũ giá **$1.50**, bảo hành 0 tháng).
- **Mục tiêu test:** Kiểm tra giới hạn biên giá trị (boundary testing) của hệ thống tiền tệ và số lượng.

---

### 🟡 Nhóm 2: Dữ liệu chứa lỗi Logic & Định dạng (Failure Path)

#### 5. `05_mixed_15_rows_10_valid_5_invalid.xlsx`

- **Tổng số dòng:** 15 dòng
- **Số dòng Hợp lệ:** 10 | **Số dòng Lỗi:** 5
- **Nội dung:** Chứa 10 dòng đúng và 5 dòng sai logic nghiệp vụ:
  - **RAM-KIN-DDR4-ERR:** Thiếu `speedMhz` và `capacityGb` (bắt buộc đối với RAM).
  - **CPU-AMD-5600X-ERR:** Số lượng âm (`-5`).
  - **CPU-INT-I3-ERR:** Số luồng nhỏ hơn số nhân (`threads < cores`).
  - **PSU-GEN-ERR:** Thiếu công suất nguồn (`wattage`) và chứng nhận hiệu suất (`efficiencyRating`).
  - **CSE-GEN-ERR:** Thiếu kích thước vỏ case (`caseSize`).
- **Mục tiêu test:** Test tính năng hiển thị chi tiết lỗi của giao diện Preview và hệ thống hàng đợi lỗi (DLQ).

#### 6. `06_broken_types_3_rows_1_valid_2_invalid.xlsx`

- **Tổng số dòng:** 3 dòng
- **Số dòng Hợp lệ:** 1 | **Số dòng Lỗi:** 2
- **Nội dung:** Chứa lỗi điền sai kiểu dữ liệu trong ô:
  - **RAM-QTY-STR-ERR:** Số lượng nhập chữ `"TEN_UNITS"` thay vì nhập số.
  - **RAM-PRI-STR-ERR:** Đơn giá nhập chữ `"FREE"` thay vì nhập số.
- **Mục tiêu test:** Đảm bảo bộ lọc kiểu dữ liệu của Zod Schema bắt được các lỗi ký tự phi số ở các cột định lượng.

#### 7. `07_invalid_headers_structural_error.xlsx`

- **Tổng số dòng:** 0 dòng hợp lệ (Lỗi cấu trúc)
- **Nội dung:** File Excel **bị thiếu mất cột tiêu đề `category`**.
- **Mục tiêu test:** Kiểm tra luồng tự động từ chối file ở tầng Validator Lambda khi phát hiện cấu trúc cột tiêu đề bị sai lệch, bảo vệ parser không chạy phí phạm tài nguyên.

---

### 🔵 Nhóm 3: Test tải hệ thống (Performance/Stress Test)

#### 8. `08_large_load_test_50_rows_valid.xlsx`

- **Tổng số dòng:** 50 dòng
- **Số dòng Hợp lệ:** 50 | **Số dòng Lỗi:** 0
- **Nội dung:** Bộ dữ liệu lớn gồm 50 sản phẩm đa dạng ngẫu nhiên, hoàn toàn hợp lệ.
- **Mục tiêu test:** Đo lường tốc độ phản hồi của hệ thống điều phối Step Functions và xem các biểu đồ **AWS X-Ray Trace Map** đồ sộ và trực quan khi xử lý số lượng lớn bản ghi cùng một lúc!

---

_Chúc bạn kiểm thử dự án vui vẻ và gặt hái nhiều kết quả tốt đẹp! 🚀_
