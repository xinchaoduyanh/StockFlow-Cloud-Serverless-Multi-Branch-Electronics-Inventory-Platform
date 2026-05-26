import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  LoginBody,
  loginBodySchema,
  RegisterBody,
  registerBodySchema,
  RefreshBody,
  refreshBodySchema,
  UserDTO,
} from "@stockflow/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @ApiBody({ type: Object, description: "Register a new user." })
  @ApiOkResponse({ description: "Registered successfully." })
  register(@Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBody): Promise<UserDTO> {
    return this.authService.register(body) as any;
  }

  @Post("login")
  @ApiBody({ type: Object, description: "Log in with email & password." })
  @ApiOkResponse({ description: "Logged in successfully, returns JWT token." })
  @ApiUnauthorizedResponse({ description: "Invalid credentials." })
  login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
  ): Promise<{ accessToken: string; user: UserDTO }> {
    return this.authService.login(body) as any;
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
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<any> {
    return this.authService.refresh(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Returns the current authenticated user." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  me(@Req() request: AuthenticatedRequest): Promise<UserDTO> {
    return this.authService.getCurrentUser(request.user) as any;
  }
}
