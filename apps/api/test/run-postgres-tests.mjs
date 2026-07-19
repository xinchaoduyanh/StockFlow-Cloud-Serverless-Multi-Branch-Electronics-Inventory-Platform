/* global console, process */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = resolve(apiRoot, "docker-compose.test.yml");
const databaseUrl =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:55432/stockflow_test?schema=public";
const docker = process.env.DOCKER_BIN ?? "docker";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const composeArgs = ["compose", "-f", composeFile];

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: apiRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
    // Windows cannot execute .cmd shims directly with spawnSync.
    shell: process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}

let exitCode = 0;

try {
  exitCode = run(docker, [...composeArgs, "up", "-d", "--wait"]);
  if (exitCode === 0) {
    exitCode = run(npx, ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
      DATABASE_URL: databaseUrl,
    });
  }
  if (exitCode === 0) {
    exitCode = run(
      npx,
      ["jest", "--config", "jest-e2e.json", "--runInBand", "test/postgres-harness.e2e-spec.ts"],
      { DATABASE_URL: databaseUrl, RUN_POSTGRES_TESTS: "1" },
    );
  }
} finally {
  const cleanupCode = run(docker, [...composeArgs, "down", "-v", "--remove-orphans"]);
  if (exitCode === 0 && cleanupCode !== 0) {
    exitCode = cleanupCode;
  }
}

process.exitCode = exitCode;
