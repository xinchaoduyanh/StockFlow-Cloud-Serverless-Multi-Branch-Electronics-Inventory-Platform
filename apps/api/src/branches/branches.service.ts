import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { BranchStatus } from "@prisma/client";
import { CreateBranchBody, UpdateBranchBody, Branch } from "@stockflow/shared";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(body: CreateBranchBody): Promise<Branch> {
    const existing = await this.prisma.branch.findUnique({
      where: { code: body.code },
    });
    if (existing) {
      throw new BadRequestException(`Branch code '${body.code}' already exists.`);
    }

    const branch = await this.prisma.branch.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address || null,
        status: BranchStatus.ACTIVE,
      },
    });

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      address: branch.address,
      status: branch.status,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  async update(id: string, body: UpdateBranchBody): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID '${id}' not found.`);
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        name: body.name,
        address: body.address !== undefined ? body.address : undefined,
        status: body.status ? (body.status as BranchStatus) : undefined,
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      address: updated.address,
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });
    if (!branch) {
      throw new NotFoundException(`Branch with ID '${id}' not found.`);
    }

    try {
      await this.prisma.branch.delete({
        where: { id },
      });
    } catch (error) {
      // Catch foreign key constraint violation (Prisma code P2003)
      if ((error as any).code === "P2003") {
        await this.prisma.branch.update({
          where: { id },
          data: { status: BranchStatus.INACTIVE },
        });
        throw new BadRequestException(
          "Branch has linked users, inventory, or transfers and cannot be hard deleted. It has been deactivated instead.",
        );
      }
      throw error;
    }
  }
}
