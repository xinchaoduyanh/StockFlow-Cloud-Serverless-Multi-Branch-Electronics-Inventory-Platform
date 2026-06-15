# ============================================================
# Phase 2 — Network
# Console tương đương: VPC > Your VPCs / Subnets / Route tables /
# Internet gateways / NAT gateways / Endpoints / Security groups
# ============================================================

# ---------- VPC: "khu đất" 10.0.0.0/16 ----------
resource "aws_vpc" "main" {
    cidr_block           = "10.0.0.0/16"
    enable_dns_support   = true # Aurora/ECS cần phân giải DNS nội bộ
    enable_dns_hostnames = true

    tags = {
        Name = "${var.project}-vpc"
    }
}

# ---------- Subnets: 2 public + 2 private, trải trên 2 AZ ----------
resource "aws_subnet" "public_a" {
    vpc_id                  = aws_vpc.main.id
    cidr_block              = "10.0.0.0/24"
    availability_zone       = "${var.aws_region}a"
    map_public_ip_on_launch = true

    tags = {
        Name = "${var.project}-public-a"
    }
}

resource "aws_subnet" "public_b" {
    vpc_id                  = aws_vpc.main.id
    cidr_block              = "10.0.1.0/24"
    availability_zone       = "${var.aws_region}b"
    map_public_ip_on_launch = true

    tags = {
        Name = "${var.project}-public-b"
    }
}

resource "aws_subnet" "private_a" {
    vpc_id            = aws_vpc.main.id
    cidr_block        = "10.0.10.0/24"
    availability_zone = "${var.aws_region}a"

    tags = {
        Name = "${var.project}-private-a"
    }
}

resource "aws_subnet" "private_b" {
    vpc_id            = aws_vpc.main.id
    cidr_block        = "10.0.11.0/24"
    availability_zone = "${var.aws_region}b"

    tags = {
        Name = "${var.project}-private-b"
    }
}

# ---------- Internet Gateway: cổng ra/vào internet của VPC ----------
resource "aws_internet_gateway" "main" {
    vpc_id = aws_vpc.main.id

    tags = {
        Name = "${var.project}-igw"
    }
}

# ---------- Route table PUBLIC: 0.0.0.0/0 -> IGW ----------
# Chính route này làm subnet trở thành "public"
resource "aws_route_table" "public" {
    vpc_id = aws_vpc.main.id

    route {
        cidr_block = "0.0.0.0/0"
        gateway_id = aws_internet_gateway.main.id
    }

    tags = {
        Name = "${var.project}-rt-public"
    }
}

resource "aws_route_table_association" "public_a" {
    subnet_id      = aws_subnet.public_a.id
    route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
    subnet_id      = aws_subnet.public_b.id
    route_table_id = aws_route_table.public.id
}

# ---------- NAT Gateway (CÓ CÔNG TẮC — ~$32/tháng khi bật) ----------
# system_on = false => count = 0 => NAT + EIP bị xóa => hết tốn tiền
resource "aws_eip" "nat" {
    count  = var.system_on ? 1 : 0
    domain = "vpc"

    tags = {
        Name = "${var.project}-nat-eip"
    }
}

resource "aws_nat_gateway" "main" {
    count         = var.system_on ? 1 : 0
    allocation_id = aws_eip.nat[0].id
    subnet_id     = aws_subnet.public_a.id # NAT phải đứng ở subnet PUBLIC

    tags = {
        Name = "${var.project}-nat"
    }

    depends_on = [aws_internet_gateway.main]
}

# ---------- Route table PRIVATE ----------
# Route table luôn tồn tại; riêng route 0.0.0.0/0 -> NAT thì theo công tắc
resource "aws_route_table" "private" {
    vpc_id = aws_vpc.main.id

    tags = {
        Name = "${var.project}-rt-private"
    }
}

resource "aws_route" "private_to_nat" {
    count                  = var.system_on ? 1 : 0
    route_table_id         = aws_route_table.private.id
    destination_cidr_block = "0.0.0.0/0"
    nat_gateway_id         = aws_nat_gateway.main[0].id
}

resource "aws_route_table_association" "private_a" {
    subnet_id      = aws_subnet.private_a.id
    route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_b" {
    subnet_id      = aws_subnet.private_b.id
    route_table_id = aws_route_table.private.id
}

# ---------- S3 Gateway Endpoint (MIỄN PHÍ) ----------
# Lambda/ECS trong private subnet đọc ghi S3 đi "đường nội bộ AWS",
# không vòng qua NAT => nhanh hơn + đỡ tiền data qua NAT
resource "aws_vpc_endpoint" "s3" {
    vpc_id            = aws_vpc.main.id
    service_name      = "com.amazonaws.${var.aws_region}.s3"
    vpc_endpoint_type = "Gateway"
    route_table_ids   = [aws_route_table.public.id, aws_route_table.private.id]

    tags = {
        Name = "${var.project}-s3-endpoint"
    }
}

# ---------- Security Groups: chuỗi tin cậy ----------
# internet -> alb_sg(80/443) -> api_sg(3000) -> db_sg(5432) <- lambda_sg

resource "aws_security_group" "alb" {
    name        = "${var.project}-alb-sg"
    description = "ALB: nhan HTTP/HTTPS tu internet"
    vpc_id      = aws_vpc.main.id

    ingress {
        description = "HTTP (se redirect sang HTTPS)"
        from_port   = 80
        to_port     = 80
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }

    ingress {
        description = "HTTPS"
        from_port   = 443
        to_port     = 443
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }

    egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }

    tags = {
        Name = "${var.project}-alb-sg"
    }
}

resource "aws_security_group" "api" {
    name        = "${var.project}-api-sg"
    description = "ECS API: chi nhan port 3000 tu ALB"
    vpc_id      = aws_vpc.main.id

    ingress {
        description     = "Tu ALB toi container NestJS"
        from_port       = 3000
        to_port         = 3000
        protocol        = "tcp"
        security_groups = [aws_security_group.alb.id] # SG tham chieu SG!
    }

    egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }

    tags = {
        Name = "${var.project}-api-sg"
    }
}

resource "aws_security_group" "lambda" {
    name        = "${var.project}-lambda-sg"
    description = "Lambdas trong VPC: chi can di ra (goi S3, SNS, DB)"
    vpc_id      = aws_vpc.main.id

    egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }

    tags = {
        Name = "${var.project}-lambda-sg"
    }
}

resource "aws_security_group" "db" {
    name        = "${var.project}-db-sg"
    description = "Aurora: chi nhan 5432 tu API va Lambda"
    vpc_id      = aws_vpc.main.id

    ingress {
        description     = "PostgreSQL tu API + Lambda"
        from_port       = 5432
        to_port         = 5432
        protocol        = "tcp"
        security_groups = [aws_security_group.api.id, aws_security_group.lambda.id]
    }

    egress {
        from_port   = 0
        to_port     = 0
        protocol    = "-1"
        cidr_blocks = ["0.0.0.0/0"]
    }

    tags = {
        Name = "${var.project}-db-sg"
    }
}
