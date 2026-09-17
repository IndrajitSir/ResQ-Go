import type { UserRole } from '@abs/contracts';

/** Identity attached to the request by JwtAuthGuard after token verification. */
export interface AuthUser {
  publicId: string;
  role: UserRole;
}
