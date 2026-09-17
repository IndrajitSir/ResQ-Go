'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { registerSchema } from '@abs/contracts';
import { useAuth } from '@/components/auth-context';
import { isApiClientError } from '@/lib/api';

function redirectPathFor(role: string): string {
  if (role === 'PATIENT') return '/bookings';
  if (role === 'DRIVER') return '/driver';
  return '/dispatcher';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'PATIENT' as 'PATIENT' | 'DRIVER',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const result = registerSchema.safeParse(form);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const flat = result.error.flatten().fieldErrors;
    const errors: Record<string, string[]> = {};
    for (const [key, messages] of Object.entries(flat)) {
      if (messages && messages.length > 0) errors[key] = messages;
    }
    setFieldErrors(errors);
    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role,
      });
      router.push(redirectPathFor(user.role));
    } catch (err) {
      setError(
        isApiClientError(err)
          ? err.message
          : 'Registration failed. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(key: string) {
    const messages = fieldErrors[key];
    if (!messages || messages.length === 0) return null;
    return (
      <span className="field-error" id={`register-${key}-error`}>
        {messages[0]}
      </span>
    );
  }

  function hasError(key: string): boolean {
    return Boolean(fieldErrors[key] && fieldErrors[key]!.length > 0);
  }

  return (
    <section style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1 className="page-title">Create an account</h1>
      <form className="card" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
        <fieldset>
          <legend>I am registering as</legend>
          <label className="radio-option">
            <input
              type="radio"
              name="role"
              value="PATIENT"
              checked={form.role === 'PATIENT'}
              onChange={() => update('role', 'PATIENT')}
            />
            <span>
              <strong>Patient</strong>
              <br />
              <span className="muted">Book and track ambulance transport.</span>
            </span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="role"
              value="DRIVER"
              checked={form.role === 'DRIVER'}
              onChange={() => update('role', 'DRIVER')}
            />
            <span>
              <strong>Driver</strong>
              <br />
              <span className="muted">Receive assignments and manage trips.</span>
            </span>
          </label>
        </fieldset>

        <label className="field">
          <span>Full name</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            aria-invalid={hasError('name') || undefined}
            aria-describedby={hasError('name') ? 'register-name-error' : undefined}
            required
          />
          {fieldError('name')}
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            aria-invalid={hasError('email') || undefined}
            aria-describedby={hasError('email') ? 'register-email-error' : undefined}
            required
          />
          {fieldError('email')}
        </label>

        <label className="field">
          <span>Phone</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+919876543210"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            aria-invalid={hasError('phone') || undefined}
            aria-describedby={hasError('phone') ? 'register-phone-error' : undefined}
            required
          />
          {fieldError('phone')}
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            aria-invalid={hasError('password') || undefined}
            aria-describedby={hasError('password') ? 'register-password-error' : 'register-password-hint'}
            required
          />
          {!hasError('password') && (
            <span className="hint" id="register-password-hint">
              At least 10 characters with an uppercase letter, a lowercase letter, a digit and a
              special character.
            </span>
          )}
          {fieldError('password')}
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Already have an account? <Link href="/login">Log in</Link>.
        </p>
      </form>
    </section>
  );
}
