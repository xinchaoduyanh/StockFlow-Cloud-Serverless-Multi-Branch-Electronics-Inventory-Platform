import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { LoginBody, loginBodySchema } from "./auth.schemas";
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

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Returns the current authenticated user." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user);
  }
}
