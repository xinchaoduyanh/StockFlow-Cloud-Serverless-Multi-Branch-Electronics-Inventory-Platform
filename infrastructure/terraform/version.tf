terraform {
  required_version = ">= 1.10"

  # Tên bucket chứa account ID nên không commit: truyền qua `-backend-config=backend.hcl`
  # (xem backend.hcl.example). use_lockfile = khoá bằng S3, không cần DynamoDB.
  backend "s3" {
    key          = "main/terraform.tfstate"
    region       = "ap-southeast-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      CreatedAt = time_static.created.rfc3339
    }
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      CreatedAt = time_static.created.rfc3339
    }
  }
}

resource "time_static" "created" {}

