import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: "stockflow-api",
      status: "ok",
    };
  }
}
