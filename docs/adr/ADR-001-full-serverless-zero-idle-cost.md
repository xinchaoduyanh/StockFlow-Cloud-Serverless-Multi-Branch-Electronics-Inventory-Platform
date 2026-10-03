# ADR-001 — Chuyển sang full serverless để chi phí khi rảnh về 0

- Trạng thái: **Proposed** (2026-10-02)
- Plan thực thi: [`docs/plans/261002-full-serverless-zero-idle/`](../plans/261002-full-serverless-zero-idle/SUMMARY.md)

## Bối cảnh

StockFlow là dự án portfolio, ngân sách AWS bằng 0. Kiến trúc lai hiện tại gồm NestJS trên ECS Fargate sau ALB, Lambda worker và Aurora Serverless v2 trong private subnet, ra internet qua NAT Gateway.

Aurora đã cấu hình scale về 0 ACU, nên compute của database không phải vấn đề. Vấn đề là **Aurora nằm trong VPC**, kéo theo một chuỗi chi phí cố định:

```text
Aurora trong VPC
  → Lambda phải vào VPC để kết nối
      → Lambda trong VPC cần NAT Gateway để gọi Pusher / Cognito / SES   (~$32+/tháng)
  → API cũng nằm trong VPC, chạy trên Fargate                            (~$9+/tháng)
      → cần ALB đứng trước                                               (~$16+/tháng)
```

Công tắc `system_on` có thể đưa Fargate và NAT về 0 nhưng **ALB không nằm dưới công tắc**, và khi tắt thì không còn demo. Hệ quả: hệ thống chỉ dựng được trong thời gian ngắn rồi destroy, phần event-driven recovery (E3) chưa từng chạy thật.

## Quyết định

1. Thay Aurora bằng **Neon Postgres** (free tier, endpoint public qua TLS).
2. Bỏ toàn bộ VPC: Lambda chạy ngoài VPC, có internet sẵn, không cần NAT.
3. Chạy NestJS API trên **Lambda** sau **API Gateway HTTP API**; bỏ ECS, ALB, ECR.
4. Secret lưu ở **SSM Parameter Store SecureString** thay Secrets Manager.
5. Giữ nguyên phần E3: SQS + DLQ + redrive, Step Functions, EventBridge, SNS.

## Hệ quả

### Được

- Chi phí khi không có traffic ≈ $0; demo chạy thường trực.
- Bỏ được khoảng 25 resource Terraform liên quan mạng, container và database.
- Không còn công tắc bật/tắt và rủi ro quên tắt.
- Lambda tự scale, không phải cấu hình autoscaling hay health check.

### Mất / chấp nhận

- **Cold start**: request đầu tiên sau lúc rảnh chậm khoảng 2–4 giây (NestJS bootstrap + Neon đánh thức compute). Chấp nhận cho demo; không dùng provisioned concurrency vì tốn tiền.
- **Giới hạn của API Gateway**: 30 giây mỗi request, body 6 MB qua Lambda. Không ảnh hưởng vì việc nặng đã bất đồng bộ và upload đi thẳng S3.
- **Database ngoài AWS**: phụ thuộc thêm một nhà cung cấp; kết nối đi qua internet công cộng (có TLS). Giới hạn free tier của Neon về dung lượng và compute.
- **Không còn kinh nghiệm ECS/ALB trên kiến trúc đang chạy**. Code Terraform cũ vẫn còn trong lịch sử git.
- **Kết nối database**: Lambda scale theo request có thể mở nhiều kết nối; giảm bằng pooled endpoint, `connection_limit=1` và reserved concurrency.

## Các phương án đã cân nhắc

| Phương án                                                   | Vì sao không chọn                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Giữ nguyên, dùng `system_on` để tắt                         | ALB vẫn tính tiền; tắt thì không có demo; phải nhớ bật/tắt bằng tay                         |
| Neon + giữ ECS/ALB trong public subnet (plan `260720-1804`) | Bỏ được NAT nhưng ALB + Fargate + public IPv4 vẫn ~$25+/tháng nếu để chạy                   |
| Lambda trong VPC + VPC endpoint thay NAT                    | Interface endpoint cũng tính tiền theo giờ mỗi AZ; Pusher, Cognito và Neon vẫn cần internet |
| App Runner                                                  | Vẫn có chi phí theo giờ khi ở trạng thái provisioned                                        |
| Kubernetes (EKS)                                            | Control plane ~$73/tháng; không có container chạy lâu dài nào cần điều phối                 |

## Số liệu cần điền sau khi triển khai

- Cold start p50 / p95 của Lambda `api`: _chưa đo_
- Kích thước gói Lambda `api` (giải nén): _chưa đo_
- Chi phí thực tế 7 ngày / 30 ngày đầu: _chưa đo_
