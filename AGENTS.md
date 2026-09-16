# AGENTS.md — Ambulance Booking System

## Purpose

This document defines how human developers and AI coding agents should work on the Ambulance Booking System. The project is being rebuilt from scratch using **Next.js** for the web application and **NestJS** for backend services.

> **Maintenance rule:** Update this file whenever the repository structure, development workflow, architecture, coding standards, deployment process, or agent responsibilities change.

## Project Principles

1. Patient safety and operational correctness take priority over visual polish.
2. Never assume that an ambulance is available, dispatched, or arrived without a verified backend state.
3. Prefer explicit domain models and state transitions over hidden side effects.
4. Keep business rules in the backend; the frontend must not be treated as a trusted source.
5. Design for auditability: important actions must be traceable to a user, timestamp, and request.
6. Make changes incrementally and keep the application runnable.
7. Avoid premature microservices. Begin with a modular monolith unless operational needs justify separation.

## Expected Repository Structure

```text
ambulance-booking-system/
├── apps/
│   ├── web/                 # Next.js application
│   └── api/                 # NestJS application
├── packages/
│   ├── contracts/           # Shared DTOs, schemas, API contracts
│   ├── config/              # Shared configuration helpers
│   └── eslint-config/
├── docs/                    # Project documentation
├── infra/                   # Docker, deployment, observability
├── scripts/
├── .env.example
├── AGENTS.md
├── DESIGN.md
├── PRODUCT.md
├── RULES.md
├── DATA_MODEL.md
├── TODO.md
├── ROADMAP.md
├── KNOWLEDGE_BASE.md
└── Security_Vulneravility.md
```

The actual structure may differ. If it changes, update this document and the relevant documentation.

## Technology Expectations

### Frontend

- Next.js with App Router.
- TypeScript in strict mode.
- Server Components by default.
- Client Components only where interactivity or browser APIs are required.
- Accessible, responsive UI.
- Form validation on the client for usability and on the server for security.
- Use a consistent data-fetching and caching strategy.
- Never expose secrets in client-side code.

### Backend

- NestJS with modular domain boundaries.
- DTO validation using `class-validator`, Zod, or an agreed equivalent.
- Authentication and authorization enforced server-side.
- Centralized exception handling and structured logging.
- Database access through a repository/service boundary.
- Transactions for booking, payment, dispatch, and other consistency-sensitive workflows.

## Agent Workflow

Before changing code:

1. Read `PRODUCT.md` for the intended behavior.
2. Read `DESIGN.md` for architecture and technical boundaries.
3. Read `RULES.md` for non-negotiable rules.
4. Read `DATA_MODEL.md` before changing persistence.
5. Read `Security_Vulneravility.md` before changing authentication, payments, uploads, location, or dispatch.
6. Read `TODO.md` or `ROADMAP.md` to understand current priorities.
7. Inspect existing code rather than assuming the structure.

During implementation:

- Explain the intended change before making broad modifications.
- Prefer small, reviewable commits.
- Preserve backward compatibility where practical.
- Add or update tests for changed behavior.
- Update documentation when behavior changes.
- Add migration scripts for schema changes.
- Do not silently change API contracts.

After implementation:

- Run formatting, linting, type checks, unit tests, and relevant integration tests.
- Test failure and authorization paths, not only successful paths.
- Update the appropriate Markdown files.
- Record unresolved issues in `TODO.md`.

## Definition of Done

A feature is not complete until:

- The intended user flow works.
- Invalid input is rejected.
- Unauthorized access is rejected.
- Important state transitions are tested.
- Errors are observable and understandable.
- Database changes are migration-safe.
- Documentation reflects the actual behavior.
- No secrets, personal data, or production credentials are committed.

## AI Agent Restrictions

Agents must not:

- Invent API endpoints, database columns, environment variables, or credentials.
- Remove security controls to make a test pass.
- Modify production data directly.
- Disable authentication or authorization permanently.
- Store patient or driver secrets in logs.
- Claim a feature is complete without testing or clearly stating what was not tested.
- Introduce a new library when an existing project dependency is sufficient without explaining the trade-off.

## Documentation Update Matrix

| Change | Files to review |
|---|---|
| New feature | PRODUCT.md, TODO.md, KNOWLEDGE_BASE.md |
| Architecture change | DESIGN.md, AGENTS.md |
| Business rule change | RULES.md, PRODUCT.md |
| Database change | DATA_MODEL.md, DESIGN.md |
| Security change | Security_Vulneravility.md, RULES.md |
| Release or milestone | ROADMAP.md, TODO.md |
| Operational discovery | KNOWLEDGE_BASE.md |

## Versioning

Each major documentation change should include a date and short change note in the file's changelog section. Keep historical decisions instead of deleting them when they explain why the current design exists.
