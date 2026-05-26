import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { RegisterBody, LoginBody } from "@stockflow/shared";
import { PrismaService } from "../database/prisma.service";
import { AuthUser, JwtPayload } from "./auth.types";
import { verifyPassword, hashPassword } from "./password";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(input: RegisterBody): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new UnauthorizedException("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role as any,
        branchId: input.branchId,
        status: UserStatus.ACTIVE,
      },
    });

    return this.toAuthUser(user);
  }

  async login(input: LoginBody) {
    const email = input.email;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    const isValidPassword = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user || user.status !== UserStatus.ACTIVE || !isValidPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const authUser = this.toAuthUser(user);
    const accessToken = await this.signToken(authUser, "15m");
    const refreshToken = await this.signToken(authUser, "7d");

    return {
      accessToken,
      refreshToken,
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

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException("User is no longer active");
      }

      const authUser = this.toAuthUser(user);
      const newAccessToken = await this.signToken(authUser, "15m");
      const newRefreshToken = await this.signToken(authUser, "7d");

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: authUser,
      };
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  private signToken(user: AuthUser, expiresIn?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    };

    return this.jwtService.signAsync(
      payload,
      expiresIn
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: expiresIn as any,
          }
        : undefined,
    );
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
