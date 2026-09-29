export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
  }
}

export type ApiErrorShape = { error: { code: string; message: string } };
export type ApiResponseShape<T> = { data: T } | ApiErrorShape;

const INTERNAL_MESSAGE = "Something went wrong. Please try again.";

export function toErrorResponse(error: unknown): ApiErrorShape {
  if (error instanceof AppError) {
    return { error: { code: error.code, message: error.message } };
  }
  return { error: { code: "INTERNAL", message: INTERNAL_MESSAGE } };
}

export function toErrorStatus(error: unknown): number {
  if (error instanceof AppError) return error.status;
  return ERROR_CODES.INTERNAL;
}
