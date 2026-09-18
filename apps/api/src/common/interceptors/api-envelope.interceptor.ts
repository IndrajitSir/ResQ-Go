import { Injectable, type CallHandler, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SSE_METADATA } from '@nestjs/common/constants';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Wraps every successful JSON response payload as {"data": <payload>}.
 *
 * Server-sent event handlers are passed through untouched: wrapping an event
 * stream would corrupt the `text/event-stream` framing.
 */
@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: Parameters<NestInterceptor['intercept']>[0], next: CallHandler): Observable<unknown> {
    const isEventStream = this.reflector.getAllAndOverride<boolean>(SSE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isEventStream) {
      return next.handle();
    }
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}
