import { UserRole } from "@prisma/client";
import { PrismaService } from "../src/database/prisma.service";
import { hashPassword } from "../src/auth/password";

const prisma = new PrismaService();

async function main() {
  const branch = await prisma.branch.upsert({
    where: { code: "BR001" },
    update: {},
    create: {
      code: "BR001",
      name: "Main Branch",
      address: "Demo branch",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@stockflow.local" },
    update: {},
    create: {
      email: "admin@stockflow.local",
      fullName: "StockFlow Admin",
      passwordHash: await hashPassword("Admin@123"),
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@stockflow.local" },
    update: {},
    create: {
      email: "manager@stockflow.local",
      fullName: "Branch Manager",
      passwordHash: await hashPassword("Manager@123"),
      role: UserRole.STORE_MANAGER,
      branchId: branch.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
