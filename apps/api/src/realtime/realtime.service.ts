import { Injectable, type MessageEvent } from '@nestjs/common';
import { Subject, filter, interval, map, merge, type Observable } from 'rxjs';
import type { RealtimeEvent, UserRole } from '@abs/contracts';
import type { AuthUser } from '../common/auth/auth-user';
import { OPERATOR_ROLES } from '../common/auth/role-sets';

/**
 * Who is allowed to receive an event. `userPublicIds` targets specific people
 * (the requester, the assigned crew) and `roles` targets whole consoles.
 */
export interface RealtimeAudience {
  userPublicIds?: readonly string[];
  roles?: readonly UserRole[];
}

export interface RealtimeEnvelope {
  audience: RealtimeAudience;
  event: RealtimeEvent;
}

const HEARTBEAT_MS = 25_000;

/**
 * In-process pub/sub for live updates.
 *
 * Deliveries are best-effort notifications of committed state changes; REST
 * remains the source of truth (see docs/DESIGN.md "Real-Time Updates"). A single
 * API instance fans out in memory. When more than one instance runs, swap the
 * Subject for a Redis-backed bus — nothing else has to change.
 */
@Injectable()
export class RealtimeService {
  private readonly bus = new Subject<RealtimeEnvelope>();

  /** Publishes an event to everyone in the audience. */
  publish(audience: RealtimeAudience, event: Omit<RealtimeEvent, 'at'> & { at?: string }): void {
    this.bus.next({
      audience,
      event: { ...event, at: event.at ?? new Date().toISOString() },
    });
  }

  /** Convenience publisher for dispatcher and admin consoles. */
  publishToOperators(event: Omit<RealtimeEvent, 'at'> & { at?: string }): void {
    this.publish({ roles: OPERATOR_ROLES }, event);
  }

  /** Server-sent event stream scoped to one authenticated user. */
  streamFor(user: AuthUser): Observable<MessageEvent> {
    const userEvents = this.bus.pipe(
      filter((envelope) => this.matches(envelope.audience, user)),
      map((envelope) => ({
        type: envelope.event.type,
        data: envelope.event,
      })),
    );

    // Comments keep intermediaries from closing idle connections.
    const heartbeat = interval(HEARTBEAT_MS).pipe(
      map(() => ({
        type: 'ping',
        data: { type: 'ping', at: new Date().toISOString() },
      })),
    );

    return merge(userEvents, heartbeat);
  }

  private matches(audience: RealtimeAudience, user: AuthUser): boolean {
    if (audience.userPublicIds?.includes(user.publicId)) {
      return true;
    }
    return audience.roles?.includes(user.role) ?? false;
  }
}
