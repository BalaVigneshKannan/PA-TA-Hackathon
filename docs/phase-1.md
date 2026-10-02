# Phase 1 implementation

## Endpoints

| Method | Path | Access |
|---|---|---|
| GET | /api/health | Public database health |
| POST | /api/auth/login | Email, password, and ADMIN / FACULTY / STUDENT role |
| GET | /api/auth/me | Valid session |
| POST | /api/auth/logout | Valid session; revokes it in the database |
| GET | /api/admin/dashboard | ADMIN |
| GET | /api/faculty/profile | FACULTY identity only |
| GET | /api/student/profile | STUDENT identity only |

Mutation requests must include an Origin matching APP_ORIGIN. The browser supplies this automatically. API clients must supply it explicitly and retain the session cookie.

## Authentication

Passwords use bcrypt cost 12. JWTs have an eight-hour expiry, fixed algorithm, issuer, and audience. The JWT is stored in an HttpOnly, SameSite=Strict cookie, Secure in production. No token is stored in browser local storage. A database session record is checked on every request; logout deletes it immediately. The current database user role and active flag are also checked, so changing or disabling a user affects existing sessions. Login errors do not disclose whether an email exists. Login requests are rate limited. Successful login and logout write audit entries transactionally with session changes.

Role guards exist both in React and in the backend. Frontend guards are navigation conveniences; backend guards enforce access. Refresh retrieves the identity from `/api/auth/me`. Errors and retry states are displayed when the service is unavailable.

## Core schema

All eleven requested domain tables are created, with foreign keys and basic checks: users, students, student_courses, core_courses, semesters, semester_course_assignments, eligibility_criteria, applications, interviews, assistantship_appointments, audit_logs. Additional auth_sessions and schema_migrations tables support authentication and setup.

Permanent core courses have no faculty assignment. Faculty names/emails and allocations belong to semester_course_assignments. Historical rows are retained through restrictive foreign keys. Applications are unique only per student, course assignment, and PA/TA type: multiple same-role applications to different courses are allowed. The partial appointment index enforces one active PA and one active TA per student and semester independently. Composite foreign keys keep appointment identity aligned with its application and course assignments aligned with their semester.

## Deferred work

Phase 2 adds semester CRUD. Phase 4 adds dynamic faculty authorization against active semester assignments; the current faculty page is only an authenticated account placeholder and exposes no course or application data. Phase 7 adds the full student profile. Selection transactions, allocation-capacity enforcement, auto-cancellation, eligibility evaluation, and finalization are later phases; their workflows are not claimed to work yet. There is no registration, password reset, notification service, or university SSO in Phase 1.

The migration is forward-only and transactional. Back up data before schema changes. The embedded database is a local development convenience, not a substitute for validating deployment against the target PostgreSQL server.
