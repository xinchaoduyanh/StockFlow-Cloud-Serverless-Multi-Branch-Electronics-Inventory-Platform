const { build } = require("esbuild");

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
  external: ["@aws-sdk/*", "@prisma/client"], // S3 and SFN are provided natively in AWS Lambda environment
})
  .then(() => {
    console.log("🚀 Serverless Lambda functions compiled and bundled successfully to dist/lambdas/!");
  })
  .catch((err) => {
    console.error("❌ Lambda compilation failed:", err);
    process.exit(1);
  });
