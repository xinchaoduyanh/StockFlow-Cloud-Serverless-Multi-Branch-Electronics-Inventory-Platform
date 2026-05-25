import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HTTP");

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get("user-agent") || "-";
    const startTime = Date.now();

    // Log when the response finishes
    res.on("finish", () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get("content-length") || "0";

      const logLine = `${method} ${originalUrl} ${statusCode} ${duration}ms ${contentLength}b — ${ip} "${userAgent}"`;

      if (statusCode >= 500) {
        this.logger.error(logLine);
      } else if (statusCode >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }
    });

    next();
  }
}
