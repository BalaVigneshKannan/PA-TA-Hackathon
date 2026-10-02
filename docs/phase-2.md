# Phase 2 — Semester management

Sign in as Admin, then choose **PA/TA → Semesters**. Create a draft using a consecutive academic year (such as 2026-2027), Fall or Spring, and application dates. Activate the draft when ready. The dashboard displays the active cycle and its dates, including after a page refresh.

## Behavior

- Semester identifiers are generated as `FALL_2026_27` or `SPRING_2026_27`.
- Academic year and term identify the semester and cannot be changed after creation. The edit form changes application dates for draft or active semesters.
- Dates use Asia/Dubai (UTC+4): start at 00:00 and end at 23:59:59.999. Same-day windows are supported. Impossible calendar dates and reversed ranges are rejected.
- Creating a draft does not carry over faculty assignments or any other operational data.
- Only one semester can be active, enforced by the existing database unique index, including concurrent activation requests.
- Activation and archival have confirmation steps. Archive the active cycle before activating a different one.
- Archiving retains the semester and its linked history. Archived semesters are read-only and cannot be reactivated. No delete endpoint exists.
- Successful changes and before/after values are recorded in audit_logs transactionally.
- All endpoints require a live Admin session; student/faculty accounts are denied.
- Active identifies the current cycle; dates define its application window. Application submission itself remains a later phase.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/admin/semesters | List all semesters, including archives |
| POST | /api/admin/semesters | Create draft |
| PATCH | /api/admin/semesters/:id | Edit application dates |
| POST | /api/admin/semesters/:id/activate | Activate draft |
| POST | /api/admin/semesters/:id/archive | Archive while retaining history |
| GET | /api/admin/dashboard | Read active semester |

Create body: `academic_year`, `term`, `application_start`, `application_end`. Dates are `YYYY-MM-DD`. Edit body uses `application_start` and `application_end`. Mutation requests require the configured Origin and authenticated cookie, as in Phase 1.

## Verification and local demo

All 11 integration tests passed (six Phase 1 plus five Phase 2). Coverage includes permissions, real calendar validation, duplicate prevention, editing, immutable identity, archival, audit details, competing activations, and missing records. Production frontend build passed.

Browser checks verified creating a draft, editing its dates, activating it, navigating to the dashboard, and refreshing with the active cycle retained. A date-input event issue discovered during this check was fixed and reverified.

The local development database now contains **Fall 2026-2027**, active, with **30 September–16 October 2026** as demonstration dates. These are editable demo settings, not an official college application schedule.

Run `npm.cmd test`, `npm.cmd run build`, then `npm.cmd run preview` (stop the existing preview first). No new migration is required: Phase 1 already created the semester table and active-cycle constraint. Integration tests use isolated embedded PostgreSQL; a standalone PostgreSQL server remains untested here. Phase 3 Excel processing has not been implemented.
