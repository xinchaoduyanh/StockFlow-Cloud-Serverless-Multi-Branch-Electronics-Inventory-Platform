"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../src/database/prisma.service");
const password_1 = require("../src/auth/password");
const prisma = new prisma_service_1.PrismaService();
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
      passwordHash: await (0, password_1.hashPassword)("Admin@123"),
      role: client_1.UserRole.ADMIN,
    },
  });
  await prisma.user.upsert({
    where: { email: "manager@stockflow.local" },
    update: {},
    create: {
      email: "manager@stockflow.local",
      fullName: "Branch Manager",
      passwordHash: await (0, password_1.hashPassword)("Manager@123"),
      role: client_1.UserRole.STORE_MANAGER,
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
//# sourceMappingURL=seed.js.map
