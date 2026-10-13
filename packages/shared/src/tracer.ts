import { Tracer } from "@aws-lambda-powertools/tracer";

// Ngoài Lambda (dev local, jest) Tracer tự tắt, nên gọi thoải mái không cần nhánh if.
export function createTracer(serviceName: string): Tracer {
  return new Tracer({ serviceName });
}

export { Tracer };
