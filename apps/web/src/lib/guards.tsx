'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UserRole } from '@abs/contracts';
import { useAuth } from '@/components/auth-context';
import { EmptyState } from '@/components/ui';

interface RequireRoleProps {
  /** Allowed roles. When omitted, only requires authentication. */
  role?: readonly UserRole[];
  children: ReactNode;
}

/**
 * Client-side gate: renders a friendly explanation instead of content when the
 * user is signed out or lacks the required role. This is a usability measure
 * only — the API independently enforces every rule on every request.
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
      <EmptyState
        icon="shield"
        title="Sign in to continue"
        action={
          <>
            <Link className="btn btn-primary" href="/login">
              Log in
            </Link>
            <Link className="btn btn-secondary" href="/register">
              Create an account
            </Link>
          </>
        }
      >
        This area needs an account. Everything else stays public.
      </EmptyState>
    );
  }

  if (role && !role.includes(user.role)) {
    return (
      <EmptyState
        icon="shield"
        title="Not available for your role"
        action={
          <Link className="btn btn-secondary" href="/">
            Back to home
          </Link>
        }
      >
        You are signed in as <strong>{user.role}</strong>. This console is reserved for other
        roles — if you believe that is wrong, contact your operator.
      </EmptyState>
    );
  }

  return <>{children}</>;
}