const { build } = require("esbuild");
const fs = require("fs");
const path = require("path");

// Bundle bản JS do `nest build` (tsc) sinh ra chứ không bundle TypeScript: esbuild không
// hỗ trợ emitDecoratorMetadata, mà DI của NestJS cần metadata đó. Chạy sau `npm run build`.
const entry = path.join(__dirname, "apps/api/dist/lambda.js");
const outdir = path.join(__dirname, "dist/api-lambda");
// npm workspaces hoist Prisma client lên root; fallback cho layout không hoist.
const prismaDir = [
  path.join(__dirname, "node_modules/.prisma/client"),
  path.join(__dirname, "apps/api/node_modules/.prisma/client"),
].find((candidate) => fs.existsSync(candidate));
const engines = [
  "libquery_engine-debian-openssl-3.0.x.so.node",
  "libquery_engine-linux-arm64-openssl-3.0.x.so.node",
];

// Các package tuỳ chọn mà NestJS chỉ require khi người dùng bật tính năng tương ứng.
const optionalNestPackages = [
  "@nestjs/microservices",
  "@nestjs/websockets",
  "@nestjs/platform-fastify",
  "class-transformer",
  "class-validator",
  "cache-manager",
];

if (!fs.existsSync(entry)) {
  console.error(`Missing ${entry}. Run "npm run build" first.`);
  process.exit(1);
}

fs.rmSync(outdir, { recursive: true, force: true });

build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "node",
  target: "node22",
  outfile: path.join(outdir, "index.js"),
  external: ["@aws-sdk/*", ...optionalNestPackages],
  // Chọn đúng Prisma engine trước khi PrismaClient được tạo (Lambda arm64, máy dev x64).
  banner: {
    js: `(() => {
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;
  const fs = require("node:fs");
  const path = require("node:path");
  const name = process.arch === "arm64"
    ? "libquery_engine-linux-arm64-openssl-3.0.x.so.node"
    : "libquery_engine-debian-openssl-3.0.x.so.node";
  const engine = path.join(__dirname, name);
  if (fs.existsSync(engine)) process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;
})();`,
  },
})
  .then(() => {
    engines.forEach((engine) => {
      const source = path.join(prismaDir, engine);
      if (fs.existsSync(source)) {
        fs.copyFileSync(source, path.join(outdir, engine));
      } else {
        console.warn(`Warning: Prisma engine ${engine} not found in ${prismaDir}`);
      }
    });
    console.log("API Lambda bundled to dist/api-lambda/");
  })
  .catch((error) => {
    console.error("API Lambda build failed:", error);
    process.exit(1);
  });
