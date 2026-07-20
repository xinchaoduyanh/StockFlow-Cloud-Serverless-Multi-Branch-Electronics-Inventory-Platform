variable "aws_region" {
  type        = string
  description = "Region chính của hệ thống"
  default     = "ap-southeast-1"
}

variable "project" {
  type    = string
  default = "stockflow"
}

variable "system_on" {
  type        = bool
  description = "Công tắc hệ thống: false = tắt các thứ tốn tiền theo giờ (NAT Gateway, sau này thêm ECS) để không tốn phí khi không demo"
  default     = true
}

# --- Phase 6: API runtime config ---
variable "frontend_url" {
  type        = string
  description = "URL frontend, dùng cho CORS_ORIGIN + FRONTEND_URL của API + CORS imports bucket"
  default     = "https://app.vuduyanh.id.vn"
}

variable "api_base_url" {
  type        = string
  description = "Public HTTPS base URL for the API SNS callback and smoke tests"
  default     = "https://api.vuduyanh.id.vn"
}

# Cognito IDs không nhạy cảm => để default sẵn, không cần tfvars
variable "cognito_user_pool_id" {
  type    = string
  default = "ap-southeast-1_ITWsr9wwd"
}

variable "cognito_client_id" {
  type    = string
  default = "4sqtgvsdfb2n3ko6j70a59u6ec"
}

# Pusher: API tự bỏ qua realtime nếu để trống => không bắt buộc điền
variable "pusher_app_id" {
  type    = string
  default = ""
}

variable "pusher_key" {
  type    = string
  default = ""
}

variable "pusher_cluster" {
  type    = string
  default = ""
}

variable "pusher_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "report_max_receive_count" {
  type        = number
  description = "SQS deliveries before a report job moves to the report DLQ"
  default     = 5
}

variable "report_lambda_timeout_seconds" {
  type        = number
  description = "Report exporter Lambda timeout"
  default     = 120
}

variable "report_queue_visibility_timeout_seconds" {
  type        = number
  description = "Report queue visibility timeout; must cover the Lambda timeout"
  default     = 900
}

variable "import_recovery_max_receive_count" {
  type        = number
  description = "SQS deliveries before an import terminal event moves to the transport DLQ"
  default     = 5
}

variable "import_recovery_queue_visibility_timeout_seconds" {
  type        = number
  description = "Import recovery queue visibility timeout"
  default     = 300
}

variable "import_approval_timeout_seconds" {
  type        = number
  description = "Maximum approval wait before the workflow becomes terminal"
  default     = 86400
}
