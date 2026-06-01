import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { UserStatus } from "@prisma/client";
import { EnvService } from "../config/env.service";
import { PrismaService } from "../database/prisma.service";
import { JwtPayload } from "./auth.types";

export type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private verifier: any;

  constructor(
    private readonly jwtService: JwtService,
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const authMode = this.env.get("AUTH_MODE");

    // 1. Mock Mode (Offline-friendly Developer Experience)
    if (authMode === "mock") {
      try {
        // Fallback to legacy JWT verification (useful for dev transition)
        const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
        });

        if (!user || user.status !== UserStatus.ACTIVE) {
          throw new UnauthorizedException("User is no longer active");
        }

        request.user = payload;
        return true;
      } catch (e) {
        // If it's not a legacy token, check if the token matches a mock cognito sub
        const user = await this.prisma.user.findUnique({
          where: { cognitoSub: token },
        });

        if (user && user.status === UserStatus.ACTIVE) {
          request.user = {
            sub: user.id,
            email: user.email,
            role: user.role,
            branchId: user.branchId,
          };
          return true;
        }
        throw new UnauthorizedException("Invalid token in mock mode");
      }
    }

    // 2. Cognito Real Auth Mode
    try {
      const verifier = this.getVerifier();
      const payload = await verifier.verify(token);

      const cognitoSub = payload.sub as string;
      const email = payload.email as string;

      // Find local user by cognito_sub
      let localUser = await this.prisma.user.findUnique({
        where: { cognitoSub },
      });

      // If not found, attempt Auto-Linking by email (proposed feature)
      if (!localUser && email) {
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });

        if (
          existingUser &&
          (!existingUser.cognitoSub || existingUser.cognitoSub.startsWith("mock-"))
        ) {
          // Link this user account to Cognito sub
          localUser = await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { cognitoSub },
          });
        }
      }

      if (!localUser) {
        throw new UnauthorizedException("Cognito identity is not linked to any local account");
      }

      if (localUser.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException("Local user account is inactive");
      }

      // Map request user to standard local identity so that other modules don't break
      request.user = {
        sub: localUser.id,
        email: localUser.email,
        role: localUser.role,
        branchId: localUser.branchId,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid Cognito bearer token");
    }
  }

  private getVerifier() {
    if (!this.verifier) {
      const userPoolId = this.env.get("COGNITO_USER_POOL_ID");
      const clientId = this.env.get("COGNITO_CLIENT_ID");

      if (!userPoolId || !clientId) {
        throw new Error(
          "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be configured when AUTH_MODE is 'cognito'",
        );
      }

      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: "id", // Verifying the ID Token to get the verified 'email' claim for auto-linking
        clientId,
      });
    }
    return this.verifier;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
