import { Injectable, NestMiddleware } from "@nestjs/common";
import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
  runWithCorrelationId,
} from "@stockflow/shared";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = resolveCorrelationId(req.get(CORRELATION_ID_HEADER));
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    runWithCorrelationId(correlationId, next);
  }
}
