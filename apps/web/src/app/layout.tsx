import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata = {
  title: 'Resq-Go — Ambulance Booking',
  description:
    'Book and track ambulance transport. For emergencies, always call your local emergency number first.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <a href="#main-content" className="skip-link">
              Skip to content
            </a>
            <Nav />
            <main id="main-content" className="container">
              {children}
            </main>
            <footer className="site-footer">
              <div className="container">
                <p style={{ margin: 0 }}>
                  <strong>Emergency notice:</strong>              Resq-Go books and coordinates ambulance transport. It does <strong>not</strong> replace calling your local emergency number (e.g.
                  911 / 112) in life-threatening situations.
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
