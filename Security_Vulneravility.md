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
| SEC-001 | Authorization | IDOR / object-level access failure | Critical/High | Open | TBD | Add automated ownership tests |
| SEC-002 | Authentication | Weak session or token handling | High | Open | TBD | Review auth flow |
| SEC-003 | Input validation | Injection or malformed input | High | Open | TBD | Fuzz and validation tests |
| SEC-004 | Uploads | Malicious or oversized files | High | Open | TBD | Content validation tests |
| SEC-005 | Location | Excessive exposure or retention | High | Open | TBD | Privacy review |
| SEC-006 | Logging | Sensitive data in logs | High | Open | TBD | Log review |
| SEC-007 | Webhooks | Forged or replayed callbacks | High | Open | TBD | Signature and replay tests |
| SEC-008 | Rate limits | Abuse of OTP, login, or booking endpoints | Medium/High | Open | TBD | Load and abuse tests |

## Application Security Checklist

### Authentication

- [ ] Passwords are hashed with a modern password hashing algorithm.
- [ ] Login attempts are rate-limited.
- [ ] Sessions expire appropriately.
- [ ] Refresh tokens are rotated or otherwise protected.
- [ ] Logout and revocation are implemented.
- [ ] Account recovery is protected against takeover.
- [ ] MFA is available for privileged users.
- [ ] Authentication responses avoid account enumeration.

### Authorization

- [ ] Every protected endpoint has authentication.
- [ ] Every resource access checks ownership or explicit permission.
- [ ] Role checks are performed server-side.
- [ ] Administrative actions are audited.
- [ ] Drivers cannot access unrelated trips.
- [ ] Patients cannot view other patients' bookings.
- [ ] Hospital staff cannot access data outside their organization.

### Injection

- [ ] ORM/query parameters are used safely.
- [ ] Dynamic sorting and filtering use allowlists.
- [ ] HTML output is escaped.
- [ ] Rich text is sanitized.
- [ ] Shell commands are avoided or strictly parameterized.
- [ ] Template injection is considered.
- [ ] NoSQL query objects are not accepted blindly from clients.

### API Security

- [ ] Request body, query, and path validation exists.
- [ ] Rate limits exist for sensitive endpoints.
- [ ] Pagination has maximum limits.
- [ ] CORS is restrictive.
- [ ] Security headers are configured.
- [ ] Error messages do not reveal internals.
- [ ] API versioning and deprecation are documented.
- [ ] Idempotency is implemented for retryable commands.

### Location and Privacy

- [ ] Location collection is explained to users.
- [ ] Precise location is restricted to authorized workflows.
- [ ] Live driver location is not publicly accessible.
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

- [ ] Secrets are stored in a secret manager or protected environment.
- [ ] Production databases are not publicly exposed.
- [ ] TLS is enforced.
- [ ] Dependencies are scanned.
- [ ] Containers run with minimal privileges.
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
