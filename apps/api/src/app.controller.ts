import { Controller, Get, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { AppService } from "./app.service";
import { EnvService } from "./config/env.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly env: EnvService,
  ) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  // Cho phép ép lỗi 5xx để kiểm chứng alarm API 5xx. Tắt mặc định và trả 404 khi tắt,
  // nên chỉ bật tạm qua biến Terraform `enable_debug_endpoint` lúc cần thử.
  @Get("debug/fail")
  failOnPurpose(): never {
    if (!this.env.get("DEBUG_ENDPOINTS_ENABLED")) throw new NotFoundException();
    throw new InternalServerErrorException("Forced failure for alarm verification");
  }
}
