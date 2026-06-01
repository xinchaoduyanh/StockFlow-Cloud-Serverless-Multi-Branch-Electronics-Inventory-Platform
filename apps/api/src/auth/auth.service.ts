import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuthUser, JwtPayload } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is no longer active");
    }

    return this.toAuthUser(user);
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
