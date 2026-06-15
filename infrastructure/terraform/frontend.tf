# ============================================================
# Phase 7 — Frontend: S3 (private) + CloudFront + OAC
# Console tương đương: S3 (bucket) / CloudFront (distribution, OAC)
# FE chạy ở subdomain app.vuduyanh.id.vn
# ============================================================

# Cert CloudFront BẮT BUỘC nằm ở us-east-1 => đọc qua provider alias.
# Cert app.vuduyanh.id.vn phải ISSUED trước khi apply phase này
# (xin tay bằng ACM us-east-1 + validate DNS CNAME trên dashboard domain).
data "aws_acm_certificate" "frontend" {
    provider    = aws.us_east_1
    domain      = "app.vuduyanh.id.vn"
    statuses    = ["ISSUED"]
    most_recent = true
}

# ---------- S3 bucket chứa Next.js static export ----------
# Private hoàn toàn: không ai đọc trực tiếp, chỉ CloudFront (qua OAC) đọc được.
resource "aws_s3_bucket" "web" {
    bucket        = "${var.project}-web-${local.account_id}-${var.aws_region}"
    force_destroy = true # cho destroy kể cả khi còn file
}

resource "aws_s3_bucket_public_access_block" "web" {
    bucket                  = aws_s3_bucket.web.id
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
}

# ---------- OAC: chuẩn mới thay OAI, CloudFront ký SigV4 khi gọi S3 ----------
resource "aws_cloudfront_origin_access_control" "web" {
    name                              = "${var.project}-web-oac"
    description                       = "OAC cho bucket FE ${aws_s3_bucket.web.bucket}"
    origin_access_control_origin_type = "s3"
    signing_behavior                  = "always"
    signing_protocol                  = "sigv4"
}

# ---------- CloudFront distribution ----------
resource "aws_cloudfront_distribution" "web" {
    enabled             = true
    is_ipv6_enabled     = true
    default_root_object = "index.html"
    aliases             = ["app.vuduyanh.id.vn"]
    price_class         = "PriceClass_200" # gồm cả edge châu Á (VN) — bỏ Nam Mỹ/châu Phi cho rẻ

    origin {
        domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
        origin_id                = "s3-web"
        origin_access_control_id = aws_cloudfront_origin_access_control.web.id
    }

    default_cache_behavior {
        target_origin_id       = "s3-web"
        viewer_protocol_policy = "redirect-to-https"
        allowed_methods        = ["GET", "HEAD", "OPTIONS"]
        cached_methods         = ["GET", "HEAD"]
        # Managed policy "CachingOptimized" (AWS định nghĩa sẵn) — khỏi tự cấu hình TTL
        cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    }

    # SPA routing: Next export là static, route phía client => 403/404 trả index.html (200)
    custom_error_response {
        error_code            = 403
        response_code         = 200
        response_page_path    = "/index.html"
        error_caching_min_ttl = 10
    }
    custom_error_response {
        error_code            = 404
        response_code         = 200
        response_page_path    = "/index.html"
        error_caching_min_ttl = 10
    }

    viewer_certificate {
        acm_certificate_arn      = data.aws_acm_certificate.frontend.arn
        ssl_support_method       = "sni-only"
        minimum_protocol_version = "TLSv1.2_2021"
    }

    restrictions {
        geo_restriction {
            restriction_type = "none"
        }
    }
}

# ---------- Bucket policy: CHỈ distribution này được đọc ----------
data "aws_iam_policy_document" "web" {
    statement {
        sid     = "AllowCloudFrontRead"
        actions = ["s3:GetObject"]
        resources = ["${aws_s3_bucket.web.arn}/*"]

        principals {
            type        = "Service"
            identifiers = ["cloudfront.amazonaws.com"]
        }

        # Chốt đúng 1 distribution => distro khác (kể cả cùng account) không đọc trộm được
        condition {
            test     = "StringEquals"
            variable = "AWS:SourceArn"
            values   = [aws_cloudfront_distribution.web.arn]
        }
    }
}

resource "aws_s3_bucket_policy" "web" {
    bucket = aws_s3_bucket.web.id
    policy = data.aws_iam_policy_document.web.json
}
