import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Security headers for a JSON API.
 *
 * The API serves JSON and server-sent events, never HTML, so the policy is
 * maximally restrictive: nothing may be loaded, framed, or embedded. HSTS is
 * only sent over TLS-terminating production deployments.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Never let a browser second-guess a declared content type.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // No clickjacking: this API is never meant to be framed.
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    // Booking payloads contain personal and location data; keep them out of
    // shared caches and browser history.
    res.setHeader('Cache-Control', 'no-store');
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    // Do not leak internal URLs to third parties.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    // The booking flow asks for geolocation, so allow it for our own origin
    // only. Camera and microphone are never needed.
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

    if (process.env.NODE_ENV === 'production') {
      // Assume TLS is terminated in front of the service (Render, Vercel).
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  }
}