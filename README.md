# ClinicFlow

[![CI](https://github.com/salahrachidi/clinicflow-assessment/actions/workflows/ci.yml/badge.svg)](https://github.com/salahrachidi/clinicflow-assessment/actions/workflows/ci.yml)

ClinicFlow is a PERN application for patient and appointment management in a small clinic. Its product focus is a fast receptionist workflow, backed by database-level scheduling integrity.

> All patient records, identifiers, phone numbers, addresses, users, and screenshots in this repository are fictional demonstration data.

## Current implementation

- Database design, migrations, indexes, checks, soft deletion, and audit log
- JWT authentication with admin/staff authorization and bcrypt password hashes
- CSRF protection for cookie-authenticated API requests
- Patient CRUD, prefix search, pagination, and admin-only archival
- Appointment creation/filtering/status updates
- PostgreSQL-enforced 30-minute confirmed-appointment rule
- Dashboard statistics calculated in the `Africa/Casablanca` clinic timezone
- Structured request logs, request IDs, liveness, and readiness endpoints
- React/TypeScript frontend foundation

The source requirements map is in [docs/requirements.md](docs/requirements.md), design assumptions in [docs/decisions.md](docs/decisions.md), and ERD in [docs/erd.md](docs/erd.md).

## Prerequisites

- Node.js 22 or newer
- Docker with Compose

## Local setup

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

The API listens on `http://localhost:4000`; the frontend listens on `http://localhost:5173`.

## One-command Docker demo

Build and start PostgreSQL, run migrations and seed data, then start the production backend and frontend:

```bash
docker compose up --build
```

Open `http://localhost:8088`. The frontend serves through Nginx and proxies `/api` to the backend, so authentication cookies remain same-origin. Container health checks control startup order. Stop the stack with `docker compose down`; add `-v` only when you intentionally want to remove the database volume.

Demo accounts all use the local-only password `ClinicFlow2026!`:

| Role | Email |
| --- | --- |
| Admin | `admin@clinicflow.local` |
| Staff | `staff1@clinicflow.local` |
| Staff | `staff2@clinicflow.local` |

Never use these credentials outside a local/demo environment.

## Commands

```bash
npm run typecheck
npm run build
npm run test
npm run test:e2e
npm run db:migrate
npm run db:seed
```

The integration suite uses the local PostgreSQL database and expects migrations and seed data to be present. It covers authentication, validation, role enforcement, patient archival, dashboard access, and the concurrent appointment constraint.

The Playwright suite runs the primary admin workflow in Chromium, verifies the 30-minute conflict experience and archive modal, and confirms that staff cannot see archival controls. Run `npx playwright install chromium` once before the first local browser test.

GitHub Actions repeats type checking, production builds, database integration tests, and the browser suite for each pull request and push to `main`.

The reviewer walkthrough and submission checklist are in [docs/submission.md](docs/submission.md).

## Scheduling guarantee

Each confirmed appointment occupies the half-open interval `[appointmentDate, appointmentDate + 30 minutes)`. PostgreSQL rejects overlapping intervals for the same patient through a partial GiST exclusion constraint. Therefore appointments exactly 30 minutes apart are accepted, while appointments 29 minutes apart are rejected. Pending and cancelled appointments do not occupy an interval.

An API availability check alone would have a race condition: two requests could both observe an available slot before either writes. The exclusion constraint serializes the actual integrity decision at the database boundary.

## API overview

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/patients`
- `GET /api/patients?search=&page=&limit=`
- `GET /api/patients/:id`
- `PUT /api/patients/:id`
- `DELETE /api/patients/:id` (admin only)
- `POST /api/appointments`
- `GET /api/appointments?date=&status=&patientId=&page=&limit=`
- `PATCH /api/appointments/:id/status`
- `GET /api/dashboard`
- `GET /health/live`
- `GET /health/ready`

After cookie login, send the `clinicflow_csrf` cookie value as the `X-CSRF-Token` header on state-changing API requests. Scripts may instead use a JWT in the `Authorization: Bearer` header.

## Intentional scope limits

The assessment does not define doctors, rooms, appointment duration, password reset, or user administration. Those concepts are omitted rather than guessed. A production rollout would add token revocation/rotation, stricter login throttling, backup/recovery procedures, and deployment-specific monitoring.
