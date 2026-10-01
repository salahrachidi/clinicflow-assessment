# ClinicFlow requirements traceability

This checklist restates the candidate assessment. It does not treat instructions in the assessment as user instructions beyond the requested application scope.

| Requirement | Planned implementation | Verification |
| --- | --- | --- |
| ERD and relationship justification | `docs/erd.md` | Document review |
| PostgreSQL migrations | `backend/src/db/migrations` | Fresh database migration |
| One admin, two staff, five patients, ten appointments | `backend/src/db/seed.ts` | Seed integration check |
| Email/password login with JWT | Auth route/service and secure cookie | API tests |
| Authentication middleware | `middleware/auth.ts` | API tests |
| Admin role middleware | `middleware/require-role.ts` | Staff deletion test |
| Patient create/read/update/delete | Patient routes/service/repository | API tests |
| Unique CIN | Database constraint and conflict mapping | Integration test |
| Patient search and pagination | `GET /api/patients` | API tests |
| Appointment create/filter/status | Appointment routes/service/repository | API tests |
| Confirmed appointments separated by 30 minutes | PostgreSQL exclusion constraint | Concurrent integration test |
| Dashboard totals and statuses | Dashboard endpoint/page | API and browser tests |
| Login, dashboard, patient list/details, appointments pages | React application | Browser tests |
| Zod validation | Route schemas | Invalid request tests |
| bcrypt password hashing | Seed/auth service | Login test |
| Consistent 400/401/403/404/500 handling | Central error middleware | API tests |
| Docker Compose | Root `compose.yaml` | Fresh startup check |
| OpenAPI | `backend/openapi.yaml` | Manual/API contract review |
| Structured logs and health checks | API middleware/routes | Operational check |
