import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { InvalidTransitionError, type ErrorCode } from '@abs/contracts';
import type { Request, Response } from 'express';
import { ApiException } from '../errors/api-exception';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/** Maps every thrown exception into the uniform {"error": {...}} envelope. */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof InvalidTransitionError) {
      status = HttpStatus.CONFLICT;
      code = 'INVALID_TRANSITION';
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_TO_CODE[status] ?? 'INTERNAL';
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        if (typeof record['message'] === 'string') {
          message = record['message'];
        } else if (Array.isArray(record['message'])) {
          message = (record['message'] as string[]).join('; ');
        }
        if (record['details'] !== undefined) {
          details = record['details'];
        }
      }
      if (message.trim() === '') {
        message = exception.message;
      }
    }

    // Structured log; never includes request bodies, passwords, or tokens.
    console.error(
      JSON.stringify({
        level: 'error',
        requestId: request.requestId,
        method: request.method,
        path: request.url,
        status,
        code,
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      requestId: request.requestId,
    });
  }
}
