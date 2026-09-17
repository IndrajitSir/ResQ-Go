'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-context';
import { isApiClientError } from '@/lib/api';

function redirectPathFor(role: string): string {
  if (role === 'PATIENT') return '/bookings';
  if (role === 'DRIVER') return '/driver';
  return '/dispatcher';
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (password.length === 0) {
      errors.password = 'Enter your password.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      router.push(redirectPathFor(user.role));
    } catch (err) {
      setError(
        isApiClientError(err)
          ? err.message
          : 'Login failed. Please check your credentials and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={{ maxWidth: 440, margin: '2rem auto' }}>
      <h1 className="page-title">Log in</h1>
      <form className="card" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            required
          />
          {fieldErrors.email && (
            <span className="field-error" id="login-email-error">
              {fieldErrors.email}
            </span>
          )}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            required
          />
          {fieldErrors.password && (
            <span className="field-error" id="login-password-error">
              {fieldErrors.password}
            </span>
          )}
        </label>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ marginTop: '1rem' }}>
          No account yet? <Link href="/register">Create one</Link>.
        </p>
      </form>

      <div className="card" aria-label="Demo accounts">
        <h2 style={{ fontSize: '1rem' }}>Demo accounts (seeded data)</h2>
        <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
          For local development only — synthetic accounts:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
          <li>
            Patient: <span className="mono">patient@example.com</span> /{' '}
            <span className="mono">Patient#2024</span>
          </li>
          <li>
            Driver: <span className="mono">driver@example.com</span> /{' '}
            <span className="mono">Driver#2024</span>
          </li>
          <li>
            Dispatcher: <span className="mono">dispatcher@example.com</span> /{' '}
            <span className="mono">Dispatch#2024</span>
          </li>
          <li>
            Admin: <span className="mono">admin@example.com</span> /{' '}
            <span className="mono">Admin#2024</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
