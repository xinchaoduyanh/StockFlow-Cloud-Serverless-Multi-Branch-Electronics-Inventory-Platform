const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");

const entryPoints = [
  "apps/lambdas/import-validator/index.ts",
  "apps/lambdas/import-parser/index.ts",
  "apps/lambdas/import-writer/index.ts",
  "apps/lambdas/import-approval-token-register/index.ts",
  "apps/lambdas/import-job-fail-handler/index.ts",
];

build({
  entryPoints,
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "node",
  target: "node20",
  outdir: "dist/lambdas",
  external: ["@aws-sdk/*"], // S3 and SFN are provided natively in AWS Lambda environment. @prisma/client is bundled.
})
  .then(() => {
    console.log("🚀 Serverless Lambda functions compiled and bundled successfully to dist/lambdas/!");

    // Auto-copy Prisma RHEL and ARM64 query engines to the exact node_modules/.prisma/client folder
    const prismaDir = path.join(__dirname, "apps/api/node_modules/.prisma/client");
    const engines = [
      "libquery_engine-rhel-openssl-1.0.x.so.node",
      "libquery_engine-rhel-openssl-3.0.x.so.node",
      "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
      "libquery_engine-linux-arm64-openssl-3.0.x.so.node"
    ];

    const lambdaDirs = [
      "import-validator",
      "import-parser",
      "import-writer",
      "import-approval-token-register",
      "import-job-fail-handler"
    ];

    lambdaDirs.forEach((dir) => {
      const destDir = path.join(__dirname, "dist/lambdas", dir);
      const destPrismaDir = path.join(destDir, "node_modules/.prisma/client");
      
      if (!fs.existsSync(destPrismaDir)) {
        fs.mkdirSync(destPrismaDir, { recursive: true });
      }

      engines.forEach((engine) => {
        const srcPath = path.join(prismaDir, engine);
        const destPath = path.join(destPrismaDir, engine);

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`  📂 Copied ${engine} to ${dir}/node_modules/.prisma/client/`);
        } else {
          console.warn(`  ⚠️ Warning: Prisma engine ${engine} not found in ${prismaDir}`);
        }
      });
    });

    console.log("✨ All Prisma engine binaries packaged into local node_modules and ready for deployment!");
  })
  .catch((err) => {
    console.error("❌ Lambda compilation failed:", err);
    process.exit(1);
  });
