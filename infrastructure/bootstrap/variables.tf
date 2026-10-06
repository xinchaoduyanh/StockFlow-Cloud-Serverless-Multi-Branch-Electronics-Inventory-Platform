variable "aws_region" {
  type        = string
  description = "Region của state bucket và các resource bootstrap"
  default     = "ap-southeast-1"
}

variable "project" {
  type    = string
  default = "stockflow"
}

variable "alert_email" {
  type        = string
  description = "Email nhận cảnh báo budget và chi phí bất thường. Đặt trong terraform.tfvars (đã gitignore)"
}

variable "anomaly_monitor_arn" {
  type        = string
  description = "ARN của Default-Services-Monitor có sẵn (chứa account ID nên đặt trong terraform.tfvars, đã gitignore)"
}

variable "github_repository" {
  type        = string
  description = "owner/repo được phép assume role deploy"
  default     = "xinchaoduyanh/StockFlow-Cloud-Serverless-Multi-Branch-Electronics-Inventory-Platform"
}
