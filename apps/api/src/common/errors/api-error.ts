import { HttpException, HttpStatus } from "@nestjs/common";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export class ApiError extends HttpException {
  constructor(statusCode: HttpStatus, body: ApiErrorBody) {
    super(body, statusCode);
  }
}

export const ApiErrors = {
  badRequest(message = "Bad request", details?: unknown) {
    return new ApiError(HttpStatus.BAD_REQUEST, {
      code: "BAD_REQUEST",
      message,
      details,
    });
  },

  unauthorized(message = "Unauthorized", details?: unknown) {
    return new ApiError(HttpStatus.UNAUTHORIZED, {
      code: "UNAUTHORIZED",
      message,
      details,
    });
  },

  forbidden(message = "Forbidden", details?: unknown) {
    return new ApiError(HttpStatus.FORBIDDEN, {
      code: "FORBIDDEN",
      message,
      details,
    });
  },

  notFound(message = "Resource not found", details?: unknown) {
    return new ApiError(HttpStatus.NOT_FOUND, {
      code: "NOT_FOUND",
      message,
      details,
    });
  },

  conflict(message = "Resource conflict", details?: unknown) {
    return new ApiError(HttpStatus.CONFLICT, {
      code: "CONFLICT",
      message,
      details,
    });
  },

  internal(message = "Internal server error", details?: unknown) {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, {
      code: "INTERNAL_SERVER_ERROR",
      message,
      details,
    });
  },
};
