# P1 — Neon thay Aurora, xoá VPC và NAT

## Mục tiêu

Bỏ nguyên nhân gốc kéo cả hệ thống vào VPC. Sau phase này Lambda nằm ngoài VPC, có internet sẵn, kết nối Neon qua TLS.

Phase này tương ứng Phase 1–2 của plan cũ `260720-1804-neon-natless-terraform`, với một khác biệt: **không còn ECS phải đặt vào public subnet**, vì P2 xoá ECS. Nên xoá luôn cả VPC thay vì giữ public subnet.

## Thay đổi

### Ứng dụng

- `apps/api/prisma/schema.prisma`: thêm `directUrl = env("DIRECT_URL")`. Runtime dùng pooled URL, migration dùng direct URL.
- `binaryTargets`: rút về `["native", "linux-arm64-openssl-3.0.x"]`. Lambda chạy arm64 trên Amazon Linux 2023 (OpenSSL 3). Bớt 3 engine thừa giúp gói Lambda nhỏ hơn đáng kể.
- `esbuild.config.js`: bỏ các candidate engine x86/OpenSSL 1.0 trong banner.

### Nâng Node 22

Node 20 hết hỗ trợ từ 30/04/2026 và AWS SDK v3 sẽ yêu cầu Node ≥ 22 (đã ghi chú trong `quality.yml`). Nâng đồng thời:

- `.github/workflows/quality.yml` → `NODE_VERSION: "22"`
- `package.json` `engines.node` → `>=22`
- `esbuild.config.js` `target` → `node22`
- `serverless.tf` `runtime` → `nodejs22.x`
- máy dev của chủ dự án

### Terraform

| File            | Thay đổi                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `database.tf`   | Xoá `aws_rds_cluster*`, `aws_db_subnet_group`, `random_password`, `aws_secretsmanager_secret*`. Thay bằng 2 `aws_ssm_parameter` kiểu `SecureString`: `/stockflow/database-url` (pooled) và `/stockflow/direct-url` |
| `network.tf`    | **Xoá cả file.** VPC, subnet, IGW, route table, NAT, EIP, VPC endpoint, 4 security group                                                                                                                           |
| `serverless.tf` | Xoá `vpc_config`. Đổi `AWSLambdaVPCAccessExecutionRole` → `AWSLambdaBasicExecutionRole` (nếu chỉ xoá VPC mà quên đổi policy thì Lambda mất quyền ghi log)                                                          |
| `variable.tf`   | Thêm `neon_database_url`, `neon_direct_url` (`sensitive = true`). Xoá `system_on`                                                                                                                                  |
| `outputs.tf`    | Xoá `vpc_id`, `private_subnet_ids`, `aurora_endpoint`, `database_secret_arn`, `database_url`                                                                                                                       |
| `seed-db.ps1`   | Viết lại: chạy `prisma migrate deploy` + seed thẳng từ máy dev tới `DIRECT_URL`, không cần ECS task                                                                                                                |

Lambda đọc `DATABASE_URL` **lúc cold start** từ SSM (có `WithDecryption`), không nhét giá trị vào biến môi trường Lambda — tránh lộ secret trên console và trong state của function. Viết một helper dùng chung trong `packages/shared` hoặc `apps/lambdas/shared`.

Chuỗi kết nối pooled phải có: `sslmode=require&pgbouncer=true&connection_limit=1`.

## Đóng nợ

- OD-13 (NAT đơn) — không còn NAT.
- OD-09 (Aurora một instance, chưa test restore) — chuyển thành câu hỏi về Neon: Neon free có point-in-time restore trong giới hạn ngắn; ghi lại thực tế trong runbook ở P6.
- Phần còn sót của OD-04: không còn Secrets Manager; secret nằm trong SSM SecureString.

## Kiểm chứng

- [ ] `rg -n "aws_nat_gateway|aws_eip|aws_rds_|aws_vpc|vpc_config|AWSLambdaVPCAccessExecutionRole|secretsmanager" infrastructure/terraform` không còn kết quả.
- [ ] `terraform validate` pass.
- [ ] Ở máy dev, `prisma migrate deploy` chạy được tới Neon qua `DIRECT_URL`.
- [ ] `npm run verify` pass trên Node 22.
