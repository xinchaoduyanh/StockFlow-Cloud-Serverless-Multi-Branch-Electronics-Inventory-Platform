import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { UserRole, UserStatus } from "@prisma/client";
import { AdminCreateUserBody, AdminUpdateUserBody, UserDTO } from "@stockflow/shared";
import { PrismaService } from "../database/prisma.service";
import { EnvService } from "../config/env.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {
    this.userPoolId = this.env.get("COGNITO_USER_POOL_ID") || "";

    const config: any = {
      region: this.env.get("AWS_REGION") || this.env.get("COGNITO_REGION") || "ap-southeast-1",
    };
    const accessKeyId = this.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.env.get("AWS_SECRET_ACCESS_KEY");
    if (accessKeyId && secretAccessKey) {
      config.credentials = { accessKeyId, secretAccessKey };
    }

    this.cognitoClient = new CognitoIdentityProviderClient(config);
  }

  async list(): Promise<UserDTO[]> {
    const users = await this.prisma.user.findMany({
      include: {
        branch: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      branchId: u.branchId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  async create(body: AdminCreateUserBody): Promise<UserDTO> {
    // 1. Check if email already exists locally
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existing) {
      throw new BadRequestException(`Email '${body.email}' already exists in the system.`);
    }

    // If role is STORE_MANAGER or WAREHOUSE, verify branch exists
    if (body.role === UserRole.STORE_MANAGER || body.role === UserRole.WAREHOUSE) {
      if (!body.branchId) {
        throw new BadRequestException(`Branch ID is required for ${body.role} role.`);
      }
      const branch = await this.prisma.branch.findUnique({
        where: { id: body.branchId },
      });
      if (!branch) {
        throw new BadRequestException("The specified branch does not exist.");
      }
    }

    let cognitoSub: string | undefined;

    // 2. Create user in AWS Cognito
    try {
      if (!this.userPoolId) {
        throw new Error("COGNITO_USER_POOL_ID is not configured");
      }

      const command = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: body.email,
        UserAttributes: [
          { Name: "email", Value: body.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: body.fullName },
        ],
        DesiredDeliveryMediums: ["EMAIL"],
      });

      const response = await this.cognitoClient.send(command);
      cognitoSub =
        response.User?.Attributes?.find((a) => a.Name === "sub")?.Value || response.User?.Username;

      this.logger.log(`Provisioned user in Cognito with sub: ${cognitoSub}`);
    } catch (error) {
      this.logger.error(`Failed to provision user in AWS Cognito: ${(error as any).message}`);
      throw new BadRequestException(
        `Failed to create user in AWS Cognito: ${(error as any).message}`,
      );
    }

    // 3. Save locally in PostgreSQL
    try {
      const user = await this.prisma.user.create({
        data: {
          email: body.email,
          fullName: body.fullName,
          cognitoSub,
          role: body.role,
          branchId:
            body.role === UserRole.STORE_MANAGER || body.role === UserRole.WAREHOUSE
              ? body.branchId
              : null,
          status: UserStatus.ACTIVE,
        },
      });

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        branchId: user.branchId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (dbError) {
      this.logger.error(
        `Database insertion failed: ${(dbError as any).message}. Rolling back Cognito user creation...`,
      );

      // Rollback AWS Cognito User Creation
      if (cognitoSub) {
        try {
          await this.cognitoClient.send(
            new AdminDeleteUserCommand({
              UserPoolId: this.userPoolId,
              Username: body.email,
            }),
          );
          this.logger.log(`Successfully rolled back Cognito user: ${body.email}`);
        } catch (rollbackError) {
          this.logger.error(
            `Failed to rollback Cognito user creation for ${body.email}: ${(rollbackError as any).message}`,
          );
        }
      }

      throw new BadRequestException(`Failed to create user locally: ${(dbError as any).message}`);
    }
  }

  async update(id: string, body: AdminUpdateUserBody): Promise<UserDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found.`);
    }

    // Verify branch if changing to STORE_MANAGER or WAREHOUSE
    const finalRole = body.role || user.role;
    const finalBranchId = body.branchId !== undefined ? body.branchId : user.branchId;
    if (finalRole === UserRole.STORE_MANAGER || finalRole === UserRole.WAREHOUSE) {
      if (!finalBranchId) {
        throw new BadRequestException(`Branch ID is required for ${finalRole} role.`);
      }
      const branch = await this.prisma.branch.findUnique({
        where: { id: finalBranchId },
      });
      if (!branch) {
        throw new BadRequestException("The specified branch does not exist.");
      }
    }

    let cognitoStatusUpdated = false;

    // 1. Update Cognito Status if status changed
    if (body.status && body.status !== user.status) {
      try {
        if (!this.userPoolId) {
          throw new Error("COGNITO_USER_POOL_ID is not configured");
        }

        if (body.status === UserStatus.INACTIVE) {
          await this.cognitoClient.send(
            new AdminDisableUserCommand({
              UserPoolId: this.userPoolId,
              Username: user.email,
            }),
          );
          this.logger.log(`Disabled user in Cognito: ${user.email}`);
        } else {
          await this.cognitoClient.send(
            new AdminEnableUserCommand({
              UserPoolId: this.userPoolId,
              Username: user.email,
            }),
          );
          this.logger.log(`Enabled user in Cognito: ${user.email}`);
        }
        cognitoStatusUpdated = true;
      } catch (error) {
        this.logger.error(`Failed to update status in Cognito: ${(error as any).message}`);
        throw new BadRequestException(`Failed to update Cognito status: ${(error as any).message}`);
      }
    }

    // 2. Save updates locally
    try {
      const updated = await this.prisma.user.update({
        where: { id },
        data: {
          fullName: body.fullName,
          role: body.role,
          branchId:
            finalRole === UserRole.STORE_MANAGER || finalRole === UserRole.WAREHOUSE
              ? finalBranchId
              : null,
          status: body.status,
        },
      });

      return {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        status: updated.status,
        branchId: updated.branchId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (dbError) {
      this.logger.error(
        `Failed to update local user: ${(dbError as any).message}. Rolling back Cognito status...`,
      );

      // Rollback Cognito Status update
      if (cognitoStatusUpdated && body.status) {
        try {
          if (user.status === UserStatus.INACTIVE) {
            await this.cognitoClient.send(
              new AdminDisableUserCommand({
                UserPoolId: this.userPoolId,
                Username: user.email,
              }),
            );
          } else {
            await this.cognitoClient.send(
              new AdminEnableUserCommand({
                UserPoolId: this.userPoolId,
                Username: user.email,
              }),
            );
          }
          this.logger.log(`Successfully rolled back Cognito status for: ${user.email}`);
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback Cognito status: ${(rollbackError as any).message}`);
        }
      }

      throw new BadRequestException(`Failed to update user locally: ${(dbError as any).message}`);
    }
  }

  async delete(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found.`);
    }

    // 1. Delete in AWS Cognito first
    let cognitoDeleted = false;
    try {
      if (this.userPoolId) {
        await this.cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: this.userPoolId,
            Username: user.email,
          }),
        );
        this.logger.log(`Deleted user in Cognito: ${user.email}`);
        cognitoDeleted = true;
      }
    } catch (error) {
      this.logger.error(`Failed to delete user in AWS Cognito: ${(error as any).message}`);
      throw new BadRequestException(`Failed to delete Cognito identity: ${(error as any).message}`);
    }

    // 2. Delete local User record
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      this.logger.log(`Deleted user record locally: ${user.email}`);
    } catch (dbError) {
      this.logger.error(`Database deletion failed: ${(dbError as any).message}`);

      // If foreign key constraint violation (Prisma code P2003)
      if ((dbError as any).code === "P2003") {
        this.logger.warn(
          `User has activity history. Deactivating account instead of hard deleting.`,
        );

        // Deactivate locally instead
        await this.prisma.user.update({
          where: { id },
          data: { status: UserStatus.INACTIVE },
        });

        // Re-enable in Cognito since we deactivated locally (or keep disabled in Cognito)
        // Since we want the user inactive, keeping them disabled in Cognito is correct.
        // But to reflect that it wasn't hard deleted, we throw a custom error to the client:
        throw new BadRequestException(
          "User has linked activity (import jobs or notifications) and cannot be hard deleted. The account has been deactivated instead.",
        );
      }

      throw new BadRequestException(`Failed to delete user locally: ${(dbError as any).message}`);
    }
  }
}
