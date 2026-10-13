import { LoggerService } from "@nestjs/common";
import { createLogger } from "@stockflow/shared/dist/logger";
import { getCorrelationId } from "@stockflow/shared/dist/correlation";

const logger = createLogger("stockflow-api");

// Nest gọi logger.log("msg", "Context") và logger.error("msg", stack, "Context");
// phần tử cuối là context nếu là chuỗi, các phần tử trước là dữ liệu kèm theo.
function splitContext(optionalParams: unknown[]): { context?: string; extras: unknown[] } {
  const last = optionalParams[optionalParams.length - 1];
  if (typeof last !== "string") return { extras: optionalParams };
  return { context: last, extras: optionalParams.slice(0, -1) };
}

type Level = "info" | "warn" | "error" | "debug";

function write(level: Level, message: unknown, optionalParams: unknown[]) {
  const { context, extras } = splitContext(optionalParams);
  const fields = { correlationId: getCorrelationId(), context, detail: extras[0] };
  logger[level](typeof message === "string" ? message : JSON.stringify(message), fields);
}

export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]) {
    write("info", message, optionalParams);
  }
  error(message: unknown, ...optionalParams: unknown[]) {
    write("error", message, optionalParams);
  }
  warn(message: unknown, ...optionalParams: unknown[]) {
    write("warn", message, optionalParams);
  }
  debug(message: unknown, ...optionalParams: unknown[]) {
    write("debug", message, optionalParams);
  }
  verbose(message: unknown, ...optionalParams: unknown[]) {
    write("debug", message, optionalParams);
  }
}
