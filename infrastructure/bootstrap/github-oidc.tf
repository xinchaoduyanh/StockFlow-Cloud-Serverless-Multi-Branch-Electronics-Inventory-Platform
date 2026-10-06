# GitHub Actions đăng nhập AWS bằng OIDC: không có access key nào lưu trong GitHub.
# Console: IAM → Identity providers → Add provider (OpenID Connect), rồi IAM → Roles → Web identity.

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# Chỉ job chạy trong GitHub Environment `production` của đúng repo này mới assume được role.
# Chạy trên nhánh khác hoặc fork thì claim `sub` không khớp và bị từ chối.
data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:environment:production"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.project}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
  # Một lần deploy dài nhất (CloudFront) vẫn dưới 1 giờ.
  max_session_duration = 3600
}

locals {
  prefix = "${var.project}-*"
}

# Quyền đủ để apply stack chính. Giới hạn theo prefix `stockflow-*` ở những dịch vụ cho phép;
# các dịch vụ không hỗ trợ giới hạn theo tên (CloudFront, Describe/List) buộc dùng "*".
data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "TerraformStateBucket"
    actions   = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/*"]
  }

  statement {
    sid     = "ProjectBuckets"
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::${local.prefix}",
      "arn:aws:s3:::${local.prefix}/*",
    ]
  }

  statement {
    sid       = "Lambda"
    actions   = ["lambda:*"]
    resources = ["arn:aws:lambda:${var.aws_region}:${local.account_id}:function:${local.prefix}"]
  }

  statement {
    sid       = "Queues"
    actions   = ["sqs:*", "sns:*"]
    resources = ["arn:aws:sqs:${var.aws_region}:${local.account_id}:${local.prefix}", "arn:aws:sns:${var.aws_region}:${local.account_id}:${local.prefix}"]
  }

  statement {
    sid       = "Workflows"
    actions   = ["states:*", "events:*", "scheduler:*"]
    resources = ["*"]
  }

  statement {
    sid       = "Logs"
    actions   = ["logs:*"]
    resources = ["arn:aws:logs:${var.aws_region}:${local.account_id}:log-group:/aws/*/${local.prefix}"]
  }

  statement {
    sid       = "Alarms"
    actions   = ["cloudwatch:*"]
    resources = ["*"]
  }

  statement {
    sid       = "Parameters"
    actions   = ["ssm:*"]
    resources = ["arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter/${var.project}/*"]
  }

  statement {
    sid       = "ApiGatewayAndCdn"
    actions   = ["apigateway:*", "cloudfront:*", "acm:Describe*", "acm:List*", "acm:Get*"]
    resources = ["*"]
  }

  statement {
    sid       = "Email"
    actions   = ["ses:*"]
    resources = ["*"]
  }

  statement {
    sid       = "Roles"
    actions   = ["iam:*Role*", "iam:*RolePolicy*", "iam:PassRole", "iam:TagRole", "iam:UntagRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/${local.prefix}"]
  }

  statement {
    sid       = "ReadOnlyDiscovery"
    actions   = ["iam:ListRoles", "iam:GetPolicy*", "tag:GetResources", "xray:*", "sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.project}-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
