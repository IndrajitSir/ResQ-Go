import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth-context';
import { Nav } from '@/components/nav';
import './globals.css';
import './landing.css';

export const metadata = {
  metadataBase: new URL('https://resq-go.vercel.app'),
  title: {
    default: 'ResQ-Go — Ambulance booking, dispatch and live tracking',
    template: '%s · ResQ-Go',
  },
  description:
    'Request an ambulance in one tap, let dispatch find the nearest suitable crew, and follow the trip live from dispatch to handover. Built for patients, drivers and dispatchers.',
  applicationName: 'ResQ-Go',
  openGraph: {
    type: 'website',
    siteName: 'ResQ-Go',
    title: 'ResQ-Go — Ambulance booking, dispatch and live tracking',
    description:
      'One tap to request, atomic assignment, and live status everyone can trust.',
  },
};

/**
 * Applied before first paint so the page never renders in the wrong theme.
 * Kept inline and tiny on purpose: it must run before React hydrates.
 */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('resqgo.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <AuthProvider>
          <div className="app-shell">
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <Nav />
            <main id="main-content" className="container">
              {children}
            </main>
            <footer className="site-footer">
              <div className="container">
                <p style={{ margin: 0 }}>
                  <strong>Emergency notice:</strong> ResQ-Go books and coordinates ambulance
                  transport. It does <strong>not</strong> replace calling your local emergency
                  number (such as 911 or 112) in a life-threatening situation.
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}