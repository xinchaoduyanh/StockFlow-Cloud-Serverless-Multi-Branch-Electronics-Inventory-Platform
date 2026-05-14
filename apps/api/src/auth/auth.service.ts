import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { LoginBody } from "./auth.schemas";
import { AuthUser, JwtPayload } from "./auth.types";
import { verifyPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(input: LoginBody) {
    const email = input.email;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const isValidPassword = user
      ? await verifyPassword(input.password, user.passwordHash)
      : false;

    if (!user || user.status !== UserStatus.ACTIVE || !isValidPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const authUser = this.toAuthUser(user);
    const accessToken = await this.signToken(authUser);

    return {
      accessToken,
      user: authUser,
    };
  }

  async getCurrentUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is no longer active");
    }

    return this.toAuthUser(user);
  }

  private signToken(user: AuthUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };

    return this.jwtService.signAsync(payload);
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    fullName: string | null;
    role: AuthUser["role"];
    branchId: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      branchId: user.branchId,
    };
  }
}
