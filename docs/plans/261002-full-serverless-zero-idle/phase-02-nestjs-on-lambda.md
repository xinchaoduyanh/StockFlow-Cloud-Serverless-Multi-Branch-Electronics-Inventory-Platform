# P2 — NestJS lên Lambda, thay ALB bằng API Gateway

## Mục tiêu

Chạy nguyên `apps/api` trên một Lambda `stockflow-api`, đứng sau API Gateway HTTP API. Xoá ECS, ALB, ECR.

Code nghiệp vụ (module, controller, service) **không đổi**. Chỉ thêm một entry point mới.

## Thay đổi ứng dụng

### `apps/api/src/lambda.ts` (mới)

```ts
// Cache app giữa các lần invoke: chỉ bootstrap NestJS ở cold start.
let server: Handler | undefined;

export const handler: Handler = async (event, context) => {
  server ??= await bootstrapServer(); // NestFactory.create + setupApp + app.init()
  return server(event, context);
};
```

- Adapter: `@codegenie/serverless-express`, payload format 2.0 của HTTP API.
- `setupApp` dùng chung với `main.ts` để hai đường chạy (local và Lambda) không lệch nhau.
- `main.ts` giữ nguyên cho `npm run dev:api`.

### Những chỗ phải sửa vì môi trường Lambda khác container

| Chỗ                              | Vấn đề                                                              | Cách xử lý                                                                                                |
| -------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `tracing.ts`                     | Gửi trace tới `localhost:4318` — trên Lambda không có collector     | Không khởi động `otelSDK` khi chạy trong Lambda; dùng X-Ray active tracing (P4)                           |
| `EmailService`                   | Ghi file vào `temp-emails/` trong `cwd` — Lambda chỉ cho ghi `/tmp` | Chỉ là nhánh dev khi thiếu region; đảm bảo `NODE_ENV=production` trên Lambda                              |
| `GET /api/health`                | Hiện chưa trả version                                               | Trả thêm `commitSha` (biến môi trường `GIT_SHA` do pipeline đặt) để smoke test ở P3 kiểm tra đúng bản mới |
| Giới hạn 30 giây của API Gateway | Request lâu bị cắt                                                  | Việc nặng (import, report) đã bất đồng bộ — chỉ cần kiểm tra không endpoint nào chạy đồng bộ lâu          |
| Body tối đa 6 MB                 | Upload file lớn hỏng                                                | Upload đã đi thẳng S3 qua presigned URL — giữ nguyên                                                      |

### Build — điểm rủi ro lớn nhất

esbuild **không hỗ trợ `emitDecoratorMetadata`**, mà DI của NestJS dựa vào nó. Bundle thẳng bằng esbuild như các worker hiện tại sẽ build xanh nhưng chạy thì service inject ra `undefined`.

Hai lựa chọn, chốt khi bắt tay làm:

1. **Khuyến nghị:** `nest build` (dùng `tsc`, giữ metadata) → copy `dist` + `npm ci --omit=dev` vào thư mục deploy → xoá Prisma engine thừa → zip. Đơn giản, đúng chuẩn.
2. esbuild + plugin chạy `tsc` riêng cho file có decorator. Gói nhỏ hơn, cold start tốt hơn, nhưng thêm một chỗ dễ hỏng.

Thêm script `npm run build:api-lambda` và đưa vào `npm run verify` + CI. Kiểm tra kích thước giải nén < 250 MB.

Thêm một test khởi động: gọi `handler` với một event HTTP API giả tới `/api/health`, phải trả 200. Test này bắt được lỗi metadata ở CI thay vì trên AWS.

## Thay đổi Terraform

### Xoá

- `ecs.tf`, `alb.tf`, `ecr.tf` — xoá cả file.
- Outputs `ecr_repository_url`, `alb_dns_name`, `ecs_cluster_name`, `api_security_group_id`.
- Biến `system_on` (đã xoá ở P1) — không còn gì để bật tắt.

### Thêm `api.tf`

| Resource                            | Cấu hình đáng chú ý                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_lambda_function.api`           | `nodejs22.x`, arm64, 1024 MB (CPU tỉ lệ với RAM → cold start nhanh hơn), timeout 29s, `tracing_config { mode = "Active" }`                     |
| Reserved concurrency                | `5` — chặn chi phí và chặn cạn kết nối Neon                                                                                                    |
| `aws_iam_role.api`                  | **Chuyển nguyên** 9 statement trong `ecs.tf` (S3 presign, SQS, SFN, SES, Cognito admin…) sang role này, thêm `ssm:GetParameter` và `xray:Put*` |
| `aws_apigatewayv2_api`              | `protocol_type = "HTTP"`, CORS cho `https://app.vuduyanh.id.vn`                                                                                |
| `aws_apigatewayv2_stage` `$default` | Auto deploy, throttling `rate = 20`, `burst = 40` (đóng một phần OD-12), access log JSON vào CloudWatch                                        |
| `aws_apigatewayv2_domain_name`      | `api.vuduyanh.id.vn`, dùng ACM cert regional đã có                                                                                             |
| `aws_apigatewayv2_api_mapping`      | Gắn domain vào stage                                                                                                                           |
| `aws_cloudwatch_log_group`          | Cho Lambda `api` và access log, giữ 14 ngày                                                                                                    |

Sau apply phải trỏ CNAME `api.vuduyanh.id.vn` sang domain đích của API Gateway (thay cho ALB). Nếu DNS nằm trên Route 53 thì để Terraform tạo record luôn.

### Log group cho mọi Lambda

Tạo `aws_cloudwatch_log_group` tường minh cho cả 8 worker, `retention_in_days = 14`. Đóng OD-11 — hiện log giữ vĩnh viễn.

## Đóng nợ

- OD-08 (ECS 1 task, không autoscale) — Lambda tự scale.
- OD-10 (image `:latest`) — không còn image; artifact Lambda đặt key theo hash.
- OD-11 (log group không quản lý).
- OD-12 phần rate limit (WAF vẫn để sau vì WAF tốn tiền theo tháng).
- OD-16 (không có demo thường trực) — sau P6.

## Kiểm chứng

- [ ] Test khởi động `handler` pass ở CI.
- [ ] `sam local invoke` hoặc `node -e` gọi `handler` với event mẫu ở máy dev trả 200.
- [ ] `terraform plan` không còn `aws_ecs_*`, `aws_lb*`, `aws_ecr_*`.
- [ ] Gói Lambda giải nén < 250 MB; ghi lại kích thước và thời gian cold start đo được vào ADR-001.
