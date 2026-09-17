import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@abs/contracts';

/**
 * Domain exception carrying the API error code used in the response envelope
 * ({"error": {"code", "message", "details?"}}).
 */
export class ApiException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    status: HttpStatus,
    message: string,
    details?: unknown,
  ) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}
