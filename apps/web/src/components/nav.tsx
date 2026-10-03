'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-context';
import { BrandLink } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavItem {
  href: string;
  label: string;
}

function linksFor(role: string | undefined): NavItem[] {
  if (role === 'PATIENT') {
    return [
      { href: '/book', label: 'Book' },
      { href: '/bookings', label: 'My bookings' },
    ];
  }
  if (role === 'DRIVER') {
    return [{ href: '/driver', label: 'My trips' }];
  }
  if (role === 'DISPATCHER' || role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return [
      { href: '/dispatcher', label: 'Dispatch' },
      { href: '/bookings', label: 'Bookings' },
    ];
  }
  return [];
}

function NavLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
        {label}
      </Link>
    </li>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const innerRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // Dismiss the mobile menu on Escape or on a click outside the header.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!innerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, close]);

  // Route changes should never leave the menu hanging open.
  useEffect(() => {
    close();
  }, [close]);

  const links = linksFor(user?.role);

  return (
    <header className="nav">
      <div className="nav-inner" data-open={open ? 'true' : 'false'} ref={innerRef}>
        <BrandLink />

        <ul className="nav-links" id="primary-navigation">
          {links.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} onNavigate={close} />
          ))}
          {user ? (
            <NavLink href="/notifications" label="Notifications" onNavigate={close} />
          ) : null}
        </ul>

        <div className="nav-spacer" />

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">
                <span className="nav-user__name">{user.name}</span>
                <span className="badge badge-neutral">{user.role}</span>
              </span>
              <button type="button" className="btn btn-secondary btn-small" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary btn-small">
                Log in
              </Link>
              <Link href="/register" className="btn btn-primary btn-small">
                Create account
              </Link>
            </>
          )}
        </div>

        <ThemeToggle />

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-navigation"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>
    </header>
  );
}