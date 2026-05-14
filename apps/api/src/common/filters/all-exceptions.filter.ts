import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiErrorBody, ApiErrorCode } from "../errors/api-error";

type NormalizedError = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const normalized = this.normalizeException(exception);

    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(normalized.statusCode).json({
      success: false,
      statusCode: normalized.statusCode,
      path: request.url,
      timestamp: new Date().toISOString(),
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined
          ? {}
          : { details: normalized.details }),
      },
    });
  }

  private normalizeException(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (this.isApiErrorBody(response)) {
        return {
          statusCode,
          code: response.code,
          message: response.message,
          details: response.details,
        };
      }

      return {
        statusCode,
        code: this.codeFromStatus(statusCode),
        message: this.messageFromHttpResponse(response, exception.message),
        details: this.detailsFromHttpResponse(response),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    };
  }

  private isApiErrorBody(value: unknown): value is ApiErrorBody {
    return (
      typeof value === "object" &&
      value !== null &&
      "code" in value &&
      "message" in value &&
      typeof value.code === "string" &&
      typeof value.message === "string"
    );
  }

  private messageFromHttpResponse(response: unknown, fallback: string) {
    if (typeof response === "string") {
      return response;
    }

    if (typeof response !== "object" || response === null) {
      return fallback;
    }

    const message = (response as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string") {
      return message;
    }

    return fallback;
  }

  private detailsFromHttpResponse(response: unknown) {
    if (typeof response !== "object" || response === null) {
      return undefined;
    }

    const message = (response as { message?: unknown }).message;
    return Array.isArray(message) ? message : undefined;
  }

  private codeFromStatus(statusCode: number): ApiErrorCode {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }
}
