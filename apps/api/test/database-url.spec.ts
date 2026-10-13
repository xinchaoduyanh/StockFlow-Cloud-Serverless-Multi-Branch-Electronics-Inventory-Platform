import { resolveDatabaseUrl } from "@stockflow/shared/dist/database-url";

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
