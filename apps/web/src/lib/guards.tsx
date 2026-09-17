'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UserRole } from '@abs/contracts';
import { useAuth } from '@/components/auth-context';

interface RequireRoleProps {
  /** Allowed roles. When omitted, only requires authentication. */
  role?: readonly UserRole[];
  children: ReactNode;
}

/**
 * Client-side gate: renders a friendly card instead of content when the user
 * is signed out or lacks the required role. The API remains the authority.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <p className="loading-text" role="status">
        Checking your session…
      </p>
    );
  }

  if (!user) {
    return (
      <section className="card empty-state" aria-live="polite">
        <h1>Sign in required</h1>
        <p>You need an account to view this page.</p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/login">
            Log in
          </Link>
          <Link className="btn btn-ghost" href="/register">
            Create an account
          </Link>
        </div>
      </section>
    );
  }

  if (role && !role.includes(user.role)) {
    return (
      <section className="card empty-state" aria-live="polite">
        <h1>Not authorized for this area</h1>
        <p>
          Your account role ({user.role}) does not have access to this page. If you believe this is
          a mistake, contact your operator.
        </p>
        <div className="btn-row">
          <Link className="btn btn-ghost" href="/">
            Back to home
          </Link>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
