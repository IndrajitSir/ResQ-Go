# Security_Vulneravility.md — Security and Vulnerability Register

## Purpose

This document is a living security checklist and vulnerability register for the Ambulance Booking System.

> **Maintenance rule:** Update this document whenever a security issue is discovered, fixed, accepted, reclassified, or introduced. Add evidence, affected components, remediation, and verification details. Do not record secrets, real patient data, or exploitable production details.

## Severity

- **Critical:** Could cause severe harm, major unauthorized access, or compromise of core operations.
- **High:** Significant unauthorized access, data exposure, or service disruption.
- **Medium:** Meaningful security weakness with limited scope or additional prerequisites.
- **Low:** Minor weakness or defense-in-depth improvement.
- **Informational:** Documentation or hardening recommendation.

## Vulnerability Register

| ID | Area | Risk | Severity | Status | Owner | Verification |
|---|---|---|---|---|---|---|
| SEC-001 | Authorization | IDOR / object-level access failure | Critical/High | Mitigated | Backend | E2E: a second patient receives 404 for another booking; a non-crew driver is refused a location ping |
| SEC-002 | Authentication | Weak session or token handling | High | Partially addressed | Backend | JWT secret validated at boot; refresh and revocation still absent (see TODO) |
| SEC-003 | Input validation | Injection or malformed input | High | Mitigated | Backend | Zod validates every body and query; Prisma parameterises all queries |
| SEC-004 | Uploads | Malicious or oversized files | High | Not applicable | — | No upload feature exists |
| SEC-005 | Location | Excessive exposure or retention | High | Mitigated | Backend | Collected only when required, explained in-product, excluded from logs; retention policy undefined |
| SEC-006 | Logging | Sensitive data in logs | High | Mitigated | Backend | Access log scrubs resource ids and drops query strings; unit-tested |
| SEC-007 | Webhooks | Forged or replayed callbacks | High | Not applicable | — | No webhook endpoints |
| SEC-008 | Rate limits | Abuse of OTP, login, or booking endpoints | Medium/High | Partially addressed | Backend | Login limited to 10 attempts per email+IP per 5 min with bucket sweeping; booking creation unbounded |

### Findings raised and fixed during the 2026-10-03 review

| ID | Area | Risk | Severity | Status | Verification |
|---|---|---|---|---|---|
| SEC-009 | Secrets management | `.gitignore` ignored `.env.example` itself, so the documented environment contract could silently drop out of the repository | Medium | Fixed | `git check-ignore .env.example` no longer matches |
| SEC-010 | Deployment | `render.yaml` ran `node apps/web/dist/server.js`, a path that does not exist for a Next.js build, so the web service could never have started | High | Fixed | Blueprint now builds the web Docker image; its entrypoint exists and was executed locally |
| SEC-011 | Data integrity | The booking form sent the **pickup** coordinates as the destination, so every planned trip had a zero-length route and a meaningless ETA | High | Fixed | Destination coordinates are now captured and sent independently |
| SEC-012 | Availability | `/health` did not check the database, so a load balancer could route traffic to an instance that could not serve it | Medium | Fixed | `/health/ready` probes the database and answers 503 when it is unreachable |
| SEC-013 | Transport | No HSTS, `X-Content-Type-Options`, or framing protection; booking payloads could be cached by intermediaries | Medium | Fixed | Security-headers middleware, covered by unit tests |
| SEC-014 | Resource exhaustion | Login rate-limit buckets were never evicted, so rotating email addresses grew the map without bound | Low | Fixed | Expired buckets are swept at most once per minute |
| SEC-015 | Error handling | `GET /users/me` used `findUniqueOrThrow`, surfacing a Prisma error as an opaque 500 | Low | Fixed | Delegates to `AuthService.me`, which returns a 401 |
| SEC-016 | Transport / browser | The API set security headers, but the Next.js web app — the tier the browser actually loads — emitted none, so the HTML app had no CSP, no framing protection, no `nosniff`, and no permissions policy | Medium | Fixed | Headers verified on the standalone production artefact over HTTP and in a real browser |

## Application Security Checklist

### Authentication

- [x] Passwords are hashed with a modern password hashing algorithm.
- [x] Login attempts are rate-limited.
- [ ] Sessions expire appropriately.
- [ ] Refresh tokens are rotated or otherwise protected.
- [ ] Logout and revocation are implemented.
- [ ] Account recovery is protected against takeover.
- [ ] MFA is available for privileged users.
- [x] Authentication responses avoid account enumeration.

### Authorization

- [x] Every protected endpoint has authentication.
- [x] Every resource access checks ownership or explicit permission.
- [x] Role checks are performed server-side.
- [x] Administrative actions are audited.
- [x] Drivers cannot access unrelated trips.
- [x] Patients cannot view other patients' bookings.
- [ ] Hospital staff cannot access data outside their organization.

### Injection

- [x] ORM/query parameters are used safely.
- [ ] Dynamic sorting and filtering use allowlists.
- [ ] HTML output is escaped.
- [ ] Rich text is sanitized.
- [ ] Shell commands are avoided or strictly parameterized.
- [ ] Template injection is considered.
- [ ] NoSQL query objects are not accepted blindly from clients.

### API Security

- [x] Request body, query, and path validation exists.
- [ ] Rate limits exist for sensitive endpoints.
- [x] Pagination has maximum limits.
- [x] CORS is restrictive.
- [x] Security headers are configured.
- [x] Error messages do not reveal internals.
- [ ] API versioning and deprecation are documented.
- [x] Idempotency is implemented for retryable commands.

### Location and Privacy

- [x] Location collection is explained to users.
- [ ] Precise location is restricted to authorized workflows.
- [x] Live driver location is not publicly accessible.
- [ ] Location data is encrypted in transit.
- [ ] Retention periods are defined.
- [ ] Analytics use coarse data where possible.
- [ ] Data exports are access-controlled and audited.

### Files and Documents

- [ ] File type is validated by content.
- [ ] File size limits are enforced.
- [ ] Filenames are normalized.
- [ ] Files are stored outside executable web roots.
- [ ] Malware scanning is considered.
- [ ] Private files require authorization before download.
- [ ] Signed URLs expire.
- [ ] Document metadata does not leak sensitive information.

### Payments

- [ ] Raw payment card data is never stored.
- [ ] Provider signatures are verified.
- [ ] Webhooks are replay-protected.
- [ ] Payment operations are idempotent.
- [ ] Refunds require authorization.
- [ ] Financial events are audited.

### Infrastructure

- [x] Secrets are stored in a secret manager or protected environment.
- [ ] Production databases are not publicly exposed.
- [ ] TLS is enforced.
- [ ] Dependencies are scanned.
- [x] Containers run with minimal privileges.
- [x] Both tiers send security headers (CSP, `nosniff`, frame denial, referrer, permissions policy).
- [ ] Backups are encrypted.
- [ ] Restore procedures are tested.
- [ ] Admin interfaces are protected.
- [ ] Monitoring alerts on unusual activity.

## Threat Modeling Questions

For each major feature, ask:

1. What assets are being protected?
2. Who are the legitimate users?
3. Who could abuse this feature?
4. What happens if the client lies?
5. What happens if a request is replayed?
6. What happens if two operators act simultaneously?
7. What sensitive information could appear in logs?
8. What is the worst plausible operational impact?
9. How would the team detect the abuse?
10. How would the team recover?

## Security Testing Plan

- Unit tests for authorization policies.
- Integration tests for IDOR.
- End-to-end tests for role separation.
- Dependency scanning in CI.
- Secret scanning in CI.
- Static analysis.
- Dynamic testing in a controlled staging environment.
- Rate-limit testing.
- Upload validation testing.
- Webhook signature and replay testing.
- Backup restoration testing.
- Periodic manual security review.

## Incident Response

When a suspected incident occurs:

1. Record the time and affected systems.
2. Preserve relevant logs without exposing them broadly.
3. Restrict access if necessary.
4. Rotate compromised credentials.
5. Determine affected data and users.
6. Patch and verify the root cause.
7. Document communications and required notifications.
8. Add a regression test.
9. Update this register and the knowledge base.

## Responsible Testing Rules

- Test only systems and accounts for which authorization exists.
- Use synthetic data.
- Avoid denial-of-service activity.
- Do not exploit production users or real patient records.
- Do not publish secrets or unpatched exploit details.
- Coordinate high-impact testing with system owners.

## Changelog

- Initial security checklist and register.
- 2026-10-03: Review pass. Reconciled the register with the implementation, recorded seven concrete
  findings (SEC-009 to SEC-015) together with how each was verified, and ticked only the checklist
  items that were demonstrated rather than assumed. Items still open are listed in `TODO.md`.

  One known gap is deliberate and unchanged: the SSE stream carries its bearer token as a query
  parameter, because `EventSource` cannot set request headers. It is accepted for now because the
  access log drops query strings, but it must be replaced with short-lived, single-use stream tokens
  before any multi-tenant deployment.

- 2026-10-03: Follow-up. Recorded SEC-016: the Next.js web app emitted no security headers at all,
  so the hardening applied to the API did not reach the tier the browser actually loads. A CSP and
  the matching framing, referrer and permissions policies were added to `next.config.js`, built from
  the origins the app really uses (OpenStreetMap tiles, the API origin) rather than a generic
  template, and verified against the standalone production artefact in a browser.
