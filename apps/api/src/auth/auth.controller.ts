import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { LoginBody, loginBodySchema, RefreshBody, refreshBodySchema } from "./auth.schemas";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
      },
    },
  })
  @ApiOkResponse({ description: "Returns an access token and current user." })
  @ApiUnauthorizedResponse({ description: "Invalid credentials." })
  login(@Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody) {
    return this.authService.login(body);
  }

  @Post("refresh")
  @ApiBody({
    schema: {
      type: "object",
      required: ["refreshToken"],
      properties: {
        refreshToken: { type: "string" },
      },
    },
  })
  @ApiOkResponse({ description: "Returns a new access token and refresh token." })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token." })
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody) {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Returns the current authenticated user." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user);
  }
}
