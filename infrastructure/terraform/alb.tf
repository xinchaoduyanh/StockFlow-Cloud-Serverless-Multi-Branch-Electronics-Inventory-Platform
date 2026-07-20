# ============================================================
# Phase 6a — ALB + HTTPS + Target Group
# Console tương đương: EC2 > Load Balancers / Target Groups / Listeners
# ============================================================

# Cert ALB đã validate sẵn ở ap-southeast-1 => chỉ ĐỌC, destroy không đụng cert
data "aws_acm_certificate" "api" {
  domain      = "api.vuduyanh.id.vn"
  statuses    = ["ISSUED"]
  most_recent = true
}

# ---------- ALB ở 2 public subnet ----------
resource "aws_lb" "main" {
  name               = "${var.project}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]
}

# ---------- Target Group: target_type IP (bắt buộc cho Fargate) ----------
resource "aws_lb_target_group" "api" {
  name        = "${var.project}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/api/health" # app.setup.ts: setGlobalPrefix("api") => health ở /api/health
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# ---------- Listener 443 (HTTPS, cert ACM) => forward tới API ----------
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = data.aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ---------- Listener 80 => redirect 301 sang 443 ----------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
