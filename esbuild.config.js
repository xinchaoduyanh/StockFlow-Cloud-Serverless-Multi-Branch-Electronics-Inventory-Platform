const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");

const entryPoints = [
  "apps/lambdas/import-validator/index.ts",
  "apps/lambdas/import-parser/index.ts",
  "apps/lambdas/import-writer/index.ts",
  "apps/lambdas/import-approval-token-register/index.ts",
  "apps/lambdas/import-job-fail-handler/index.ts",
  "apps/lambdas/report-exporter/index.ts",
  "apps/lambdas/import-recovery-worker/index.ts",
  "apps/lambdas/reconciliation/index.ts",
];

build({
  entryPoints,
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "node",
  target: "node20",
  outdir: "dist/lambdas",
  banner: {
    js: `(() => {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  const fs = require("node:fs");
  const path = require("node:path");
  const candidates = process.arch === "arm64"
    ? ["libquery_engine-linux-arm64-openssl-3.0.x.so.node", "libquery_engine-linux-arm64-openssl-1.0.x.so.node"]
    : ["libquery_engine-debian-openssl-3.0.x.so.node", "libquery_engine-rhel-openssl-3.0.x.so.node", "libquery_engine-rhel-openssl-1.0.x.so.node"];
  const engine = candidates.map((name) => path.join(__dirname, name)).find((candidate) => fs.existsSync(candidate));
  if (engine) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;
})();`,
  },
  external: ["@aws-sdk/*"], // S3 and SFN are provided natively in AWS Lambda environment. @prisma/client is bundled.
})
  .then(() => {
    console.log(
      "🚀 Serverless Lambda functions compiled and bundled successfully to dist/lambdas/!",
    );

    // Copy every supported Prisma engine next to each bundle; the banner selects
    // the matching local/AWS architecture before PrismaClient is constructed.
    const prismaDir = path.join(__dirname, "apps/api/node_modules/.prisma/client");
    const engines = [
      "libquery_engine-debian-openssl-3.0.x.so.node",
      "libquery_engine-rhel-openssl-1.0.x.so.node",
      "libquery_engine-rhel-openssl-3.0.x.so.node",
      "libquery_engine-linux-arm64-openssl-1.0.x.so.node",
      "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
    ];

    const lambdaDirs = [
      "import-validator",
      "import-parser",
      "import-writer",
      "import-approval-token-register",
      "import-job-fail-handler",
      "report-exporter",
      "import-recovery-worker",
      "reconciliation",
    ];

    lambdaDirs.forEach((dir) => {
      const destDir = path.join(__dirname, "dist/lambdas", dir);
      const stalePrismaDir = path.join(destDir, "node_modules/.prisma");
      fs.rmSync(stalePrismaDir, { recursive: true, force: true });

      engines.forEach((engine) => {
        const srcPath = path.join(prismaDir, engine);
        const destPath = path.join(destDir, engine);

        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`  📂 Copied ${engine} next to ${dir}/index.js`);
        } else {
          console.warn(`  ⚠️ Warning: Prisma engine ${engine} not found in ${prismaDir}`);
        }
      });
    });

    console.log("✨ All Prisma engine binaries packaged next to their Lambda bundles!");
  })
  .catch((err) => {
    console.error("❌ Lambda compilation failed:", err);
    process.exit(1);
  });
