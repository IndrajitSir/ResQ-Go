import { HttpStatus } from '@nestjs/common';
import type { UserRole } from '@abs/contracts';
import { ApiException } from '../errors/api-exception';

export const PATIENT_ONLY: readonly UserRole[] = ['PATIENT'];
export const DRIVER_ONLY: readonly UserRole[] = ['DRIVER'];
export const OPERATOR_ROLES: readonly UserRole[] = [
  'DISPATCHER',
  'ADMIN',
  'SUPER_ADMIN',
];
export const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'SUPER_ADMIN'];

/** Convenience helper for throwing the standard authorization error. */
export function forbidden(): ApiException {
  return new ApiException(
    'FORBIDDEN',
    HttpStatus.FORBIDDEN,
    'You are not allowed to access this resource',
  );
}
