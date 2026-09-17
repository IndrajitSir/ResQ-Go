import { Injectable, type CallHandler, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Wraps every successful response payload as {"data": <payload>}. */
@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: unknown, next: CallHandler): Observable<{ data: unknown }> {
    return next.handle().pipe(map((data: unknown) => ({ data })));
  }
}
