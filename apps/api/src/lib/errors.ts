/** Error envelope: { error: { code, message, field? } } */
export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "platform_access_denied"
  | "account_suspended"
  | "hub_unavailable"
  | "server";

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  rate_limited: 429,
  platform_access_denied: 403,
  account_suspended: 403,
  hub_unavailable: 502,
  server: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly field?: string,
  ) {
    super(message ?? code);
    this.status = STATUS[code];
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field ? { field: this.field } : {}),
      },
    };
  }
}
