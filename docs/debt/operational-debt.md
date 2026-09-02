# Nợ hệ thống vận hành (Operational Debt)

> Phạm vi: mọi thứ quanh việc **chạy** hệ thống trên AWS — CI/CD, IaC, observability, security posture, chi phí, quy trình vận hành.
> Rà soát lại ngày 2026-09-02 trên `main` tại commit `bd589a7`.
> Bằng chứng kiểm chứng trực tiếp trên `infrastructure/terraform/` và cây thư mục repo.

## Bảng tổng hợp

| ID    | Nợ                                                              | Mức | Effort (ngày) |
| ----- | --------------------------------------------------------------- | --- | ------------- |
| OD-17 | Toàn bộ E3 chưa từng chạy trên AWS — 128 resource chưa apply    | P0  | 1–2           |
| OD-02 | Terraform state để local, không remote backend/lock             | P0  | 0.5           |
| OD-03 | Cognito nằm ngoài IaC, stack không dựng lại được từ zero        | P0  | 1             |
| OD-04 | `PUSHER_SECRET` để plaintext trong task definition              | P0  | 0.5           |
| OD-05 | X-Ray đi dây trong code nhưng không có ADOT sidecar             | P1  | 1             |
| OD-06 | Alarm mới phủ SQS/DLQ; chưa có alarm ALB/ECS/DB, chưa dashboard | P1  | 1–2           |
| OD-07 | Không có structured logging / correlation ID                    | P1  | 1–2           |
| OD-08 | ECS cố định 1 task, không autoscaling, không circuit breaker    | P1  | 1             |
| OD-09 | Aurora một instance, chưa từng test restore, không có RPO/RTO   | P1  | 1–2           |
| OD-10 | Image tag `:latest` — không truy vết, không rollback được       | P1  | 0.5           |
| OD-11 | Log group của Lambda không được quản lý, giữ log vĩnh viễn      | P1  | 0.5           |
| OD-12 | Không có WAF, không có rate limit trước CloudFront/ALB          | P1  | 0.5           |
| OD-13 | NAT Gateway đơn, không có interface VPC endpoint                | P2  | 1             |
| OD-14 | Không có budget/cost alarm; công tắc `system_on` không về 0đ    | P1  | 0.5           |
| OD-15 | Runbook mới phủ E3; chưa có runbook dựng lại toàn stack         | P1  | 1             |
| OD-16 | Không có môi trường demo chạy thường trực                       | P2  | 1–2           |

## Đã đóng trong đợt rà soát này

| ID    | Nợ cũ          | Đóng bởi                                                                                                                                                          |
| ----- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-01 | Không có CI/CD | `a1dc5c1` thêm `.github/workflows/quality.yml`; đợt 2026-09-02 sửa thứ tự build/test, thêm `format:check` và `typecheck`, chạy trên mọi nhánh, tách job Terraform |

---

## OD-17 — Toàn bộ E3 chưa từng chạy trên AWS

**Bằng chứng** — `docs/plans/260720-1532-e3-event-driven-recovery/EXECUTION-REPORT.md`, mục Blockers:

> AWS has no `stockflow-pipeline` CloudFormation stack, no stockflow Lambda/SQS/Step Functions/SNS resources, and no Terraform state. A read-only plan was saved […]; it creates 128 resources.

**Hậu quả:** đây là nợ vận hành lớn nhất hiện tại. Code E3 đã hoàn chỉnh và test cục bộ pass, nhưng **128 resource chưa bao giờ tồn tại thật**. Những thứ chỉ lộ ra khi apply:

- 2 `aws_lambda_event_source_mapping` — batch size, visibility timeout so với thời gian xử lý thật.
- 4 `aws_cloudwatch_metric_alarm` — ngưỡng đặt có hợp lý không, có bắn nhầm liên tục không.
- Redrive policy — `maxReceiveCount` đã đúng chưa, message có thực sự rơi vào DLQ không.
- Thứ tự phụ thuộc IAM (báo cáo đã ghi nhận là plan lưu sẵn đã lỗi thời so với các fix cuối).
- Step Functions retry/backoff/jitter và approval timeout.

Một pipeline recovery chưa từng chạy thì bản thân nó là rủi ro chưa được đo. Với mục tiêu CV, đây cũng là điểm yếu chí mạng: "tôi xây dựng hệ thống event-driven recovery" mà chưa từng thấy nó phục hồi một message thật.

**Cách sửa:** đây là hạng mục nên làm sớm nhất trong nhóm vận hành.

1. Chạy `terraform plan` mới (plan cũ đã lỗi thời), review kỹ.
2. Apply theo trình tự trong `docs/runbooks/e3-recovery.md`.
3. Chạy smoke matrix Phase 8: tạo report job, ép một message lỗi, xác nhận nó vào DLQ, redrive, xác nhận alarm bắn.
4. **Lưu bằng chứng**: ảnh chụp DLQ có message, alarm ở trạng thái ALARM, log redrive thành công.
5. Destroy lại để về chi phí thấp.

Bước 4 chính là thứ biến E3 từ "code có vẻ đúng" thành "đã vận hành được" trên CV.

---

## OD-02 — Terraform state để local

**Bằng chứng:** `infrastructure/terraform/version.tf` không có block `backend`. Kiểm tra bằng `grep -n "backend" version.tf` → không kết quả.

**Hậu quả:**

- State chỉ tồn tại trên **một máy**. Mất file là mất khả năng quản lý stack: Terraform không còn biết resource nào thuộc về nó.
- Không có state locking → apply từ hai nơi sẽ hỏng state.
- CI không thể chạy `terraform plan` vì không truy cập được state — đó là lý do job `terraform` trong CI hiện chỉ dừng ở `validate`.

**Cách sửa:** S3 backend + locking (`use_lockfile = true` cho S3 native lock, hoặc DynamoDB lock table nếu muốn có thêm một use case DynamoDB thật để nói trong phỏng vấn). Bật versioning cho bucket state.

**Vấn đề con gà quả trứng:** bucket state không thể do chính stack này quản lý. Tách một stack `bootstrap` nhỏ, hoặc tạo tay và ghi vào runbook (OD-15).

---

## OD-03 — Cognito nằm ngoài IaC

**Bằng chứng:** `grep -c "aws_cognito" infrastructure/terraform/*.tf` → 0 resource. User pool truyền vào qua `var.cognito_user_pool_id` và `var.cognito_client_id`.

**Hậu quả:** stack **không dựng lại được từ con số không**. Ba group `ADMIN` / `STORE_MANAGER` / `WAREHOUSE` — nền tảng của toàn bộ `AuthorizationPolicyService` vừa xây ở `343c514` — hiện chỉ tồn tại trong console, không ở đâu trong repo.

Điều này càng đáng chú ý sau khi E3 đã gỡ bỏ SAM để Terraform là chủ sở hữu duy nhất: mọi thứ khác đều là code, riêng authentication thì không.

**Cách sửa:** đưa `aws_cognito_user_pool`, `aws_cognito_user_pool_client` và 3 `aws_cognito_user_group` vào Terraform. `terraform import` pool hiện có nếu muốn giữ user.

---

## OD-04 — `PUSHER_SECRET` để plaintext trong task definition

**Bằng chứng** — `infrastructure/terraform/ecs.tf:191`:

```hcl
{ name = "PUSHER_SECRET", value = var.pusher_secret },
```

Nằm trong khối `environment`, không phải khối `secrets`. `DATABASE_URL` ngay bên dưới thì lại làm đúng qua Secrets Manager.

**Hậu quả:** bất kỳ principal nào có `ecs:DescribeTaskDefinition` — quyền rất phổ biến, thường nằm trong role read-only — đều đọc được Pusher app secret ở dạng plaintext. Secret cũng nằm trong `terraform.tfvars` và trong state file (OD-02). Với Pusher secret, kẻ tấn công đẩy được sự kiện giả tới mọi client đang mở dashboard.

Đây là mục **rẻ nhất trong danh sách P0** và đã tồn tại qua ba đợt commit lớn.

**Cách sửa:** đưa Pusher credentials vào Secrets Manager (hoặc SSM Parameter Store `SecureString`, rẻ hơn), chuyển xuống khối `secrets`, rồi **rotate secret** vì giá trị hiện tại đã lộ trong state.

---

## OD-05 — X-Ray đi dây trong code nhưng không tới đích

**Bằng chứng:** `apps/api/src/tracing.ts` cấu hình OTel đầy đủ với `AWSXRayIdGenerator` và `AWSXRayPropagator`, exporter trỏ tới `http://localhost:4318/v1/traces`. Nhưng:

```
grep -c "tracing_config" infrastructure/terraform/serverless.tf   →  0
```

- `ecs.tf` chỉ định nghĩa một container tên `api`, không có sidecar ADOT nào lắng nghe ở cổng 4318.
- Cả 8 Lambda đều không bật X-Ray.
- IAM role không có `xray:PutTraceSegments`.

**Hậu quả:** SDK cố gửi trace tới endpoint không tồn tại và **im lặng thất bại**. Công bỏ ra cho OTel hiện tạo giá trị bằng không, và vẫn tốn CPU mỗi request.

Sau E3, thiệt hại còn lớn hơn trước: giờ đã có Step Functions retry, SQS, DLQ, event source mapping — tức là chuỗi xử lý dài hơn và **đúng lúc cần distributed tracing nhất** thì lại không có.

**Cách sửa**

1. Thêm container `aws-otel-collector` vào task definition, `dependsOn` container `api`.
2. Cấp `AWSXRayDaemonWriteAccess` cho task role và lambda role.
3. `tracing_config { mode = "Active" }` cho cả 8 Lambda.
4. Bật X-Ray trên Step Functions state machine.

Đây là hạng mục có tỉ lệ "công bỏ ra / ấn tượng thu về" tốt nhất phần vận hành: ảnh chụp service map là bằng chứng trực quan mạnh nhất cho CV.

---

## OD-06 — Alarm mới phủ SQS/DLQ

**Bằng chứng:** `a1dc5c1` đã thêm 4 `aws_cloudwatch_metric_alarm`:

| Alarm                                | Đối tượng                  |
| ------------------------------------ | -------------------------- |
| `report_dlq_messages`                | độ sâu DLQ báo cáo         |
| `report_queue_age`                   | tuổi message trong queue   |
| `import_recovery_dlq_messages`       | độ sâu DLQ import recovery |
| `notification_delivery_dlq_messages` | độ sâu DLQ thông báo       |

Đây là bước tiến thật. Nhưng vẫn thiếu:

- Alarm cho ALB: `TargetResponseTime` p99, `HTTPCode_Target_5XX_Count`.
- Alarm cho ECS: `RunningTaskCount` thấp hơn desired.
- Alarm cho Aurora: `ACUUtilization`.
- Alarm cho Lambda: `Errors`, `Throttles` theo từng function.
- Alarm cho Step Functions: `ExecutionsFailed`.
- **Không có `aws_cloudwatch_dashboard` nào.**

**Hậu quả:** đường event-driven đã được giám sát, nhưng đường request đồng bộ (người dùng → ALB → ECS → DB) thì hoàn toàn mù. API chết thì không có gì báo.

Thiếu dashboard cũng có nghĩa là khi demo, không có một màn hình duy nhất nào để mở ra cho người xem thấy hệ thống đang sống.

**Cách sửa:** bổ sung nhóm alarm còn thiếu ở trên, tất cả đổ về một SNS topic **riêng cho alarm**, tách khỏi topic nghiệp vụ. Thêm một dashboard gom mọi thứ để chụp màn hình khi demo.

---

## OD-07 — Không có structured logging / correlation ID

**Bằng chứng:** 59 lời gọi `console.*` trong `apps/lambdas`. Log là chuỗi văn bản tự do, không phải JSON. Rule `no-console` đã bị tắt trong ESLint (xem TD-03) nên không còn tín hiệu nào nhắc phải thay.

**Hậu quả:** để dựng lại câu chuyện của một import job lỗi, phải mở lần lượt log group của API, validator, parser, writer, import-recovery-worker, cộng với execution history của Step Functions và message trong SQS, rồi ghép bằng mắt theo timestamp. Không query được bằng Logs Insights, không lọc được theo `importJobId`.

Với E3 đã thêm queue và retry vào luồng, số bước cần ghép giờ nhiều hơn trước.

**Cách sửa:** dùng **AWS Lambda Powertools for TypeScript** (`Logger` + `Tracer` + `Metrics`). Truyền `importJobId` và `correlationId` xuyên suốt payload giữa các state của Step Functions và trong message SQS. Lưu sẵn vài truy vấn Logs Insights vào repo — bản thân chúng là bằng chứng năng lực vận hành.

---

## OD-08 — ECS cố định 1 task, không autoscaling, không circuit breaker

**Bằng chứng** — `infrastructure/terraform/ecs.tf:217`:

```hcl
desired_count = var.system_on ? 1 : 0
```

Không có `aws_appautoscaling_target` / `aws_appautoscaling_policy`. Trong `aws_ecs_service` không có block `deployment_circuit_breaker`.

**Hậu quả:**

- Một task duy nhất = một AZ tại một thời điểm. VPC đã dựng đủ 2 AZ nhưng lợi ích đó đang không được dùng.
- Deploy một image hỏng → task cũ bị thay bằng task mới không khởi động được → **downtime cho tới khi có người can thiệp tay**.
- Tải tăng thì không có gì mở rộng.

**Cách sửa:** thêm biến `high_availability` (mặc định `false`) điều khiển `desired_count` và autoscaling, để **cấu hình production tồn tại trong code** ngay cả khi không bật thường xuyên. `deployment_circuit_breaker` thì bật vô điều kiện — nó miễn phí và ngăn đúng kịch bản downtime ở trên.

---

## OD-09 — Aurora một instance, chưa từng test restore

**Bằng chứng** — `infrastructure/terraform/database.tf`: một `aws_rds_cluster_instance`, `instance_class = "db.serverless"`, scaling 0–2 ACU. Không có reader. Không có `aws_backup_plan`. Không có tài liệu RPO/RTO.

**Hậu quả:**

- Instance đơn → AWS thay thế khi AZ hỏng nhưng downtime dài hơn hẳn so với có reader để failover.
- **Chưa từng restore.** Backup chưa kiểm chứng thì chưa phải backup. Đây là câu hỏi phỏng vấn kinh điển cho hồ sơ SAA.
- `min_capacity = 0` là lựa chọn chi phí thông minh nhưng đánh đổi bằng độ trễ đánh thức ở request đầu — con số đó chưa từng được đo.

**Lưu ý:** `docs/plans/260720-1804-neon-natless-terraform/` đang đề xuất **thay Aurora bằng Neon**. Nếu chốt phương án đó thì OD-09 đổi hình dạng hoàn toàn (chuyển sang phụ thuộc SLA của nhà cung cấp bên thứ ba, và mất một phần câu chuyện SAA về RDS). Nên quyết định trước khi đầu tư vào mục này.

**Cách sửa (nếu giữ Aurora):** viết `docs/dr-plan.md` với RPO/RTO; thực hiện **một lần restore drill thật** và lưu log làm bằng chứng; đo độ trễ resume từ 0 ACU; reader instance đặt sau biến `high_availability`.

---

## OD-10 — Image tag `:latest`

**Bằng chứng** — `infrastructure/terraform/ecs.tf:159`:

```hcl
image = "${local.ecr_url}:latest"
```

**Hậu quả:** không biết chính xác commit nào đang chạy production; không rollback được vì `:latest` đã bị ghi đè; task definition không đổi giữa các lần deploy nên phải `force-new-deployment`, và hai task cùng tag có thể chạy hai image khác nhau.

**Cách sửa:** tag theo commit SHA, task definition tham chiếu SHA cụ thể, bật tag immutability trên ECR. Rollback trở thành việc trỏ lại task definition revision cũ. Gắn với job deploy sẽ thêm vào CI ở giai đoạn sau.

---

## OD-11 — Log group của Lambda không được quản lý

**Bằng chứng:** `ecs.tf` có `aws_cloudwatch_log_group.api` với `retention_in_days = 14` — làm đúng. Nhưng `serverless.tf` **không tạo log group nào** cho 8 Lambda.

**Hậu quả:** AWS tự tạo `/aws/lambda/<tên>` với retention **Never expire**. Log tích lại vĩnh viễn và tính tiền vĩnh viễn. Đây cũng là resource **không nằm trong Terraform state**, nên `terraform destroy` không xoá — nhiều khả năng đây là thứ còn sót trong account sau lần destroy trước.

**Cách sửa:** khai báo tường minh `aws_cloudwatch_log_group` cho từng Lambda với `retention_in_days = 14`, dùng chung `for_each` với `aws_lambda_function.fn`.

---

## OD-12 — Không có WAF, không có rate limit

**Bằng chứng:** không có `aws_wafv2_web_acl`. ALB nhận `0.0.0.0/0` ở cổng 443, CloudFront không gắn web ACL.

**Hậu quả:** endpoint đăng nhập không có giới hạn tần suất. Endpoint sinh presigned URL upload có thể bị lạm dụng để nhồi file vào S3 — bạn trả tiền lưu trữ **và** trả tiền cho các Step Functions execution do chúng kích hoạt. Sau E3, mỗi file rác còn kéo theo message SQS và có thể cả DLQ.

**Cách sửa:** WAFv2 web ACL gắn vào CloudFront với AWS Managed Rules (common rule set) + một rate-based rule.

---

## OD-13 — NAT Gateway đơn, không có interface VPC endpoint

**Bằng chứng:** `network.tf` có một `aws_nat_gateway` và một `aws_eip`, một route table private cho cả hai AZ. Có `aws_vpc_endpoint.s3` (gateway endpoint, miễn phí — làm đúng) nhưng không có interface endpoint nào cho Secrets Manager, ECR, Logs, STS, **và nay thêm SQS**.

**Hậu quả:** mọi lệnh gọi từ subnet private tới các dịch vụ đó đều đi qua NAT và **tính tiền theo GB**. Với E3, Lambda trong VPC gọi SQS liên tục nên lượng traffic qua NAT tăng thêm. NAT đơn cũng là single point of failure cho outbound của cả hai AZ.

**Lưu ý:** kế hoạch `260720-1804-neon-natless-terraform` đề xuất **bỏ hẳn NAT**. Nếu chốt phương án đó thì mục này biến mất thay vì được sửa — nên quyết định trước.

**Cách sửa (nếu giữ NAT):** thêm interface endpoint cho `secretsmanager`, `ecr.api`, `ecr.dkr`, `logs`, `sqs`. Interface endpoint tính tiền theo giờ nên **cần tính điểm hoà vốn** — và chính phép tính đó là một câu chuyện cost-optimization tốt để kể.

---

## OD-14 — Không có budget/cost alarm, và công tắc `system_on` không đưa về 0 đồng

**Bằng chứng:** không có `aws_budgets_budget` hay `aws_ce_anomaly_monitor`.

**Đính chính quan trọng về `system_on`:** công tắc này gate `desired_count` của ECS (`ecs.tf:217`) và NAT Gateway + EIP + route (`network.tf`). Nhưng **`aws_lb.main` trong `alb.tf` không có `count`** — ALB vẫn tồn tại và vẫn bill khoảng **16–18 USD/tháng** khi `system_on = false`.

Đừng giả định tắt công tắc là về 0 đồng; chỉ `terraform destroy` mới về 0. Nếu muốn công tắc đúng nghĩa "tắt là hết tiền", phải gate luôn ALB, target group và listener.

**Hậu quả:** quên tắt, hoặc một resource chạy ngoài dự kiến (log không giới hạn ở OD-11, traffic NAT ở OD-13, message SQS lặp vô hạn nếu redrive sai) thì không có gì cảnh báo cho tới khi nhận hoá đơn.

Đáng tiếc vì `version.tf` đã cấu hình `default_tags` rất chuẩn (`Project`, `ManagedBy`, `CreatedAt`) — nền tảng cho cost allocation đã có sẵn mà chưa dùng.

**Cách sửa:** AWS Budget với ngưỡng cảnh báo gửi về SNS/email; bật cost allocation tag cho `Project`; xuất một bảng chi phí thật theo service — đó là dữ liệu cho phần "cost story" trên CV, thay cho ước lượng.

---

## OD-15 — Runbook mới phủ E3

**Bằng chứng:** `docs/runbooks/` nay có `e3-recovery.md` — một bước tiến thật, và nó chính là tài liệu mà OD-17 sẽ dùng khi apply.

Nhưng vẫn chưa có tài liệu mô tả **trình tự dựng lại toàn bộ hệ thống từ đầu**. Kiến thức đó nằm trong ghi chú cá nhân bên ngoài repository, kèm các chi tiết đã biết là dễ vấp: CloudFront distribution mồ côi chặn apply, đặc thù PowerShell 5.1, thứ tự trỏ DNS.

**Hậu quả:** repo không tự đứng được. Người khác clone về không dựng lại nổi, và chính tác giả sau ba tháng cũng vậy. Với dự án portfolio, khả năng dựng lại là một phần của sản phẩm.

**Cách sửa:** `docs/runbooks/bootstrap.md` gồm điều kiện tiên quyết (Docker Desktop, AWS credentials, ACM certificate), trình tự apply, bước seed, bước trỏ DNS, các lỗi đã gặp và cách xử lý, quy trình teardown. Bổ sung `docs/dr-plan.md` từ OD-09.

---

## OD-16 — Không có môi trường demo chạy thường trực

**Bằng chứng:** stack đã từng apply và verify end-to-end, sau đó chủ động destroy để về 0 đồng. Hiện không có URL nào đang sống, và theo OD-17 thì cả E3 cũng chưa từng được apply.

**Hậu quả:** CV không có link để bấm vào. Đây là đánh đổi hợp lý về chi phí, nhưng cần phương án thay thế, nếu không thì toàn bộ công sức hạ tầng trở nên vô hình với người đọc CV.

**Cách sửa — theo thứ tự ưu tiên:**

1. **Video demo 3 phút** có kịch bản, luôn xem được, chi phí bằng 0. Phương án chính.
2. **Frontend tĩnh sống thường trực** (S3 + CloudFront, ~1 USD/tháng) chạy ở chế độ dữ liệu mẫu, kèm banner nói rõ là bản demo dữ liệu tĩnh.
3. Bật full stack theo lịch phỏng vấn, dựa trên runbook ở OD-15.

Không nên bật full stack 24/7 — chi phí không tương xứng lợi ích.

---

## Thứ tự xử lý đề xuất

Nhóm theo phụ thuộc, không theo mức độ:

| Đợt | Nội dung                                                 | Vì sao đứng ở đây                                                           |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | OD-02 → OD-17                                            | Có remote state trước, rồi mới apply E3 lần đầu. Đây là đợt quan trọng nhất |
| 2   | OD-04, OD-10, OD-11, OD-12                               | Bốn hạng mục nhỏ, độc lập, làm được ngay                                    |
| 3   | OD-05 → OD-07 → OD-06                                    | Tracing trước, log có cấu trúc, rồi mới dựng alarm và dashboard cho đủ      |
| 4   | Chốt Neon/NAT-less trước, rồi OD-03, OD-08, OD-09, OD-13 | Quyết định kiến trúc trước khi đầu tư vào Aurora và NAT                     |
| 5   | OD-14, OD-15, OD-16                                      | Chi phí, tài liệu, bằng chứng demo — chốt lại phần vận hành                 |
