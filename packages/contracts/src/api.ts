/** API response envelope and error codes (see docs/DESIGN.md "API Design"). */

export interface ApiEnvelope<T> {
  data: T;
  requestId?: string;
}

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_REPLAY_IN_PROGRESS'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
