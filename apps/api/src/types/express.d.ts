import type { AuthUser } from '../auth/auth-user';

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Request {
    requestId?: string;
    user?: AuthUser;
  }
}
