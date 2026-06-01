import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
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
    private readonly env: EnvService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

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
          "COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be configured for JWT authentication",
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
