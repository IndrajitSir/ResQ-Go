'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-context';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined}>
        {label}
      </Link>
    </li>
  );
}

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <nav className="nav-inner" aria-label="Main navigation">
        <Link href="/" className="nav-brand">
          ABS — Ambulance Booking
        </Link>
        <ul className="nav-links">
          {user?.role === 'PATIENT' && (
            <>
              <NavLink href="/book" label="Book" />
              <NavLink href="/bookings" label="My Bookings" />
            </>
          )}
          {user?.role === 'DRIVER' && <NavLink href="/driver" label="My Trips" />}
          {(user?.role === 'DISPATCHER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <>
              <NavLink href="/dispatcher" label="Dispatch" />
              <NavLink href="/bookings" label="Bookings" />
            </>
          )}
          {user && <NavLink href="/notifications" label="Notifications" />}
        </ul>
        <div className="nav-spacer" />
        {user ? (
          <>
            <span className="nav-user">
              {user.name} ({user.role})
            </span>
            <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <span className="nav-spacer" />
            <Link href="/login" className="btn btn-ghost btn-small">
              Login
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
