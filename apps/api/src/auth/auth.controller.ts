import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { UserDTO } from "@stockflow/shared";
import { AuthService } from "./auth.service";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOkResponse({ description: "Returns the current authenticated user." })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token." })
  me(@Req() request: AuthenticatedRequest): Promise<UserDTO> {
    return this.authService.getCurrentUser(request.user) as any;
  }
}
