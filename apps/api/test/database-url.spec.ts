import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl, withDatabaseUrl } from "@stockflow/shared/dist/database-url";

describe("resolveDatabaseUrl", () => {
  it("keeps an explicit DATABASE_URL and never calls SSM", async () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://local",
      DATABASE_URL_SSM_PARAMETER: "/p",
    };
    const readParameter = jest.fn();

    await resolveDatabaseUrl(env, readParameter);

    expect(env.DATABASE_URL).toBe("postgresql://local");
    expect(readParameter).not.toHaveBeenCalled();
  });

  it("loads DATABASE_URL from the SSM parameter named in the environment", async () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL_SSM_PARAMETER: "/stockflow/database-url" };
    const readParameter = jest.fn().mockResolvedValue("postgresql://neon");

    await resolveDatabaseUrl(env, readParameter);

    expect(readParameter).toHaveBeenCalledWith("/stockflow/database-url");
    expect(env.DATABASE_URL).toBe("postgresql://neon");
  });

  it("does nothing when neither variable is set", async () => {
    const env: NodeJS.ProcessEnv = {};
    const readParameter = jest.fn();

    await resolveDatabaseUrl(env, readParameter);

    expect(env.DATABASE_URL).toBeUndefined();
    expect(readParameter).not.toHaveBeenCalled();
  });

  it("fails loudly when the parameter is empty", async () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL_SSM_PARAMETER: "/missing" };

    await expect(resolveDatabaseUrl(env, jest.fn().mockResolvedValue(undefined))).rejects.toThrow(
      "/missing",
    );
  });
});

describe("when PrismaClient is created relative to DATABASE_URL", () => {
  const unreachableUrl = "postgresql://user:pass@127.0.0.1:1/db";
  let originalUrl: string | undefined;

  beforeEach(() => {
    originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  it("cannot see a URL that arrives after the client was created (the Lambda cold-start bug)", async () => {
    const prisma = new PrismaClient();
    await new Promise((resolve) => setTimeout(resolve, 500)); // SSM trả về chậm hơn lúc engine khởi tạo
    process.env.DATABASE_URL = unreachableUrl;

    await expect(prisma.$connect()).rejects.toThrow("Environment variable not found: DATABASE_URL");
    await prisma.$disconnect();
  });

  it("sees the URL when the client is created after it is set", async () => {
    process.env.DATABASE_URL = unreachableUrl;
    const prisma = new PrismaClient();

    await expect(prisma.$connect()).rejects.toThrow("Can't reach database server");
    await prisma.$disconnect();
  });
});

describe("withDatabaseUrl", () => {
  it("runs onReady after DATABASE_URL is available and before the handler", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://local";
    const calls: string[] = [];

    const wrapped = withDatabaseUrl(
      async (name: string) => {
        calls.push(`handler:${name}`);
        return name;
      },
      () => calls.push("onReady"),
    );

    await expect(wrapped("x")).resolves.toBe("x");
    expect(calls).toEqual(["onReady", "handler:x"]);
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });
});
