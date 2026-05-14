import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EnvModule } from "../config/env.module";
import { EnvService } from "../config/env.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    EnvModule,
    JwtModule.registerAsync({
      global: true,
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.get("JWT_SECRET"),
        signOptions: { expiresIn: env.get("JWT_EXPIRES_IN") as never },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
