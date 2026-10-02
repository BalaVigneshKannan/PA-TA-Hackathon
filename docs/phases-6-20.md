# Complete portal: Phases 6-20

The portal now supports the complete local prototype workflow, from eligibility publication to approved exports and historical results.

| Phase | Implemented behaviour |
|---|---|
| 6 | Faculty publishes separate PA/TA year, CGPA, course, grade, additional declaration and interview requirements. Year cannot be below 2. Rules lock after the first application for that role. |
| 7 | Student academic profile, completed grades and previous appointment history. Academic records are seeded, not student-editable. |
| 8 | Current-semester opportunities show amounts, criteria, eligibility reasons and application-window state. Submission rechecks all rules. |
| 9 | Multiple PA and TA applications are allowed; duplicate course/role applications are blocked. Separate application tables include withdrawal and interview details. |
| 10 | Faculty search, status filters, profile view, three-candidate comparison, review, shortlist, rejection, interview scheduling/evaluation and selected-pending state. |
| 11-12 | Transactional appointment creation, course-capacity check, one active appointment per student/role/semester, same-role-only cancellation. PA plus TA remains valid. |
| 13 | Live PA/TA filled and vacancy counts and visual indicators. Audited Admin cancellation releases a vacancy before finalization. |
| 14 | Explicit Admin approval locks the semester and closes remaining pending applications as Not selected. |
| 15 | Immutable approved-result snapshot, screen view, Excel download and paginated PDF download. Archived results remain available. |
| 16 | Auth/session, role, active semester, faculty course ownership, student ownership, validation, origin checks, audit events and database constraints. |
| 17 | Consistent campus design, responsive panels, search/filter controls, status badges, progress indicators, confirmation dialogs and loading/error states. |
| 18 | Full integration suite including 15 students, three faculty, both interview branches, concurrent conflicts, allocation overflow, vacancy changes, ownership and final exports. |
| 19 | Idempotent demo preparation with 15 new synthetic students, faculty accounts and a nine-row upload workbook (six core / three non-core). Existing accounts/passwords remain unchanged. |
| 20 | Rehearsal script in `DEMO-GUIDE.md`. |

## Update and run

Stop the running preview before opening the persistent embedded database from another process.

```powershell
npm.cmd run db:migrate
npm.cmd run seed:demo -w backend
npm.cmd run build
npm.cmd run preview
```

The demo seeder only fills missing sample records and enables zero slots for sample-assigned demo courses. It never deletes applications, resets passwords, or finalizes a semester. New passwords are saved to the ignored `DEMO-ACCESS.md`; prior credentials stay in `LOCAL-ACCESS.md` and `FACULTY-DEMO-ACCESS.md`.

## Workflow rules

- Opportunities with unpublished faculty criteria remain unavailable; there is no permissive default.
- Passing grade order in this prototype is A, A-, B, B-, C, C-, D, E. Unrecognized/failing grades do not satisfy completion. Confirm the college's official scale before replacing sample academic records.
- Free-text additional requirements use an explicit student declaration, verified by faculty during review. They are not automatically inferred from text.
- Faculty actions: Applied -> Under review (optional) -> Shortlisted -> Interview/evaluation (if required) -> Selected pending -> Accepted. Rejection is allowed while pending. Faculty makes the decision.
- Accepting creates an unapproved active appointment; Admin finalization approves active appointments. Only approved snapshots are exportable.
- Pending applications may be withdrawn. Admin may cancel an active appointment before finalization with a reason. Neither action restores auto-cancelled applications or allows duplicate reapplication to the same opportunity.
- Finalization is explicit and may proceed with acknowledged vacancies. There is no silent reopen/edit workflow. Archive preserves approved results.

## Transaction and access guarantees

Every operational mutation locks its semester before reading eligibility, application state or capacity. Appointment acceptance, allocation editing, cancellation, criteria changes, finalization and archival therefore use the same serialization boundary. After obtaining the lock, faculty ownership and application status are checked again. The partial unique appointment index is a second defence against duplicate active student/role appointments.

Audit events include criteria changes, submission, review, shortlisting, interview scheduling/evaluation, selection, appointment creation, each auto-cancellation, withdrawal, Admin cancellation and finalization. Export snapshots are independent of later master-data changes. Workbook cells are strings/numbers, not formulas. All database values use parameters; role and ownership checks run in the backend.

## Prototype boundaries

No class or assistantship duty timetable was supplied, so schedule-overlap warnings are not claimed. SSO, real academic-record integration, deployment and notifications are outside this local prototype. The existing college-approved course list and grade policy must replace sample data before operational use. Tests run against embedded PostgreSQL; a standalone PostgreSQL deployment has not been exercised. PDF uses a compact Latin text layout; Excel preserves Unicode names fully.

## Validation record

40 backend integration tests pass, and the production build passes. Browser verification covers student login/profile, seven simultaneous applications, tab switching, faculty profile/comparison, shortlisting, selection, PA acceptance, TA interview scheduling/evaluation/acceptance, independent same-role cancellation and Admin vacancy/approval screens. The current demo remains active for further rehearsal. Finalization, immutability, cancellation, concurrency and exports are exercised in the isolated integration suite.


## Rule 26 correction

Selected-pending candidates reserve slots. Selection and acceptance count other pending selections plus active appointments for the same course and role under the shared semester lock. Acceptance excludes its own reservation. Admin allocation edits cannot reduce slots below the combined total. Rejection, withdrawal and same-role auto-cancellation release pending reservations automatically. Vacancy figures remain allocated minus active appointments, as specified; pending reservations are not filled appointments. Concurrent PA and TA selection, conversion to acceptance, allocation reduction and released reservations are covered by integration tests.
