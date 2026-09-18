import { Controller, Sse, type MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth/auth-user';
import { RealtimeService } from './realtime.service';

/**
 * Live updates over Server-Sent Events. The stream is authenticated with the
 * same bearer token as the REST API; clients only ever receive events they are
 * entitled to (see RealtimeService).
 */
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Sse('stream')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.realtime.streamFor(user!);
  }
}
