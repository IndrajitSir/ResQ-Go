import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@abs/contracts';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles; enforced server-side by RolesGuard. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
