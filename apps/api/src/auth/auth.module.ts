import { Module } from "@nestjs/common";
import { EnvModule } from "../config/env.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthorizationPolicyService } from "./authorization-policy.service";

@Module({
  imports: [EnvModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthorizationPolicyService],
  exports: [AuthService, JwtAuthGuard, AuthorizationPolicyService],
})
export class AuthModule {}
