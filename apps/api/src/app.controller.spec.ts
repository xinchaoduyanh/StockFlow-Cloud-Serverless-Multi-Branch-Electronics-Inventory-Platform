import { InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { AppController } from "./app.controller";
import type { AppService } from "./app.service";
import type { EnvService } from "./config/env.service";

function createController(debugEnabled: boolean): AppController {
  const env = { get: () => debugEnabled } as unknown as EnvService;
  return new AppController({} as AppService, env);
}

describe("AppController debug endpoint", () => {
  it("responds as if the route does not exist while debug endpoints are disabled", () => {
    expect(() => createController(false).failOnPurpose()).toThrow(NotFoundException);
  });

  it("returns a 500 when debug endpoints are enabled", () => {
    expect(() => createController(true).failOnPurpose()).toThrow(InternalServerErrorException);
  });
});
