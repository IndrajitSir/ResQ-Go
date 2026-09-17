# KNOWLEDGE_BASE.md — Project Knowledge Base

## Purpose

This file stores durable project knowledge, discoveries, conventions, and operational notes that should not be lost between development sessions.

> **Maintenance rule:** Update this file whenever a reusable discovery, integration detail, debugging lesson, architectural decision, or operational procedure is learned. Do not store secrets or personal data here.

## Domain Glossary

- **Booking:** A customer's request for ambulance service.
- **Trip:** The operational execution of a booking.
- **Dispatch:** The process of selecting and assigning an ambulance and crew.
- **Operator:** Organization responsible for a fleet or service.
- **Crew:** Driver and other authorized personnel associated with an ambulance.
- **Public ID:** Safe identifier intended for URLs or external references.
- **State transition:** A validated movement from one domain status to another.
- **Outbox:** A durable record of an event that must be published or processed asynchronously.

## Working Conventions

- Store timestamps in UTC.
- Use public IDs in external APIs where appropriate.
- Keep controllers thin.
- Keep business rules in domain/application services.
- Validate at the API boundary and again at critical domain boundaries.
- Prefer explicit names over abbreviations.
- Document non-obvious decisions close to the code and in architecture records.

## Local Development Notes

Record the following as they become known:

- Required Node.js version.
- Package manager and version.
- Required Docker services.
- Local database setup.
- Seed commands.
- Test accounts using fake data only.
- Common development commands.
- Port assignments.
- Debugging procedures.

## Integration Notes

For every external integration, document:

- Provider name.
- Purpose.
- Environment variables, without values.
- Authentication method.
- Timeout and retry policy.
- Webhook verification.
- Data sent to the provider.
- Data received from the provider.
- Failure behavior.
- Cost or quota constraints.
- Provider documentation link.

## Troubleshooting Template

### Problem

Describe the observed issue.

### Context

Include environment, relevant module, and approximate time.

### Symptoms

List exact errors or unexpected behavior.

### Root Cause

Record the verified cause, not a guess.

### Fix

Describe the change.

### Prevention

Add a test, monitor, validation, or documentation update.

## Architecture Decisions

For each significant decision:

```text
Decision:
Date:
Context:
Options:
Chosen approach:
Reason:
Trade-offs:
Revisit when:
Related files:
```

## Security Knowledge

- Never log access tokens, refresh tokens, passwords, payment details, or unnecessary location data.
- Treat every client-provided identifier as untrusted.
- Object-level authorization is required even when role authorization passes.
- Uploads must be validated by content, not only filename.
- External webhooks must be authenticated and replay-protected.
- Operational dashboards contain sensitive information and require strict access control.

## Operational Runbook Topics

Add links or instructions for:

- Starting the system.
- Deploying staging.
- Deploying production.
- Running migrations.
- Rolling back a release.
- Restoring backups.
- Rotating secrets.
- Handling notification outages.
- Handling database outages.
- Handling suspected unauthorized access.
- Handling a dispatch data inconsistency.

## Changelog

- Initial knowledge base.
