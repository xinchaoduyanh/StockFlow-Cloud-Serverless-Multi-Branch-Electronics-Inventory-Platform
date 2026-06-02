import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import {
  AdminCreateUserBody,
  AdminUpdateUserBody,
  UserDTO,
  adminCreateUserSchema,
  adminUpdateUserSchema,
} from "@stockflow/shared";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { uuidParamSchema } from "../common/schemas/params.schema";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ description: "Get list of all users." })
  list(): Promise<UserDTO[]> {
    return this.usersService.list();
  }

  @Post()
  @ApiOkResponse({ description: "Create a new user in Cognito and database." })
  create(
    @Body(new ZodValidationPipe(adminCreateUserSchema)) body: AdminCreateUserBody,
  ): Promise<UserDTO> {
    return this.usersService.create(body);
  }

  @Patch(":id")
  @ApiOkResponse({ description: "Update an existing user." })
  update(
    @Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(adminUpdateUserSchema)) body: AdminUpdateUserBody,
  ): Promise<UserDTO> {
    return this.usersService.update(params.id, body);
  }

  @Delete(":id")
  @ApiOkResponse({ description: "Delete a user from Cognito and database." })
  delete(@Param(new ZodValidationPipe(uuidParamSchema)) params: { id: string }): Promise<void> {
    return this.usersService.delete(params.id);
  }
}
