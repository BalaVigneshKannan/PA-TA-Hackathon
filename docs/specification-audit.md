# Original specification audit

Checked 1 October 2026 against the attached original project specification, current backend/frontend code, database migrations and automated tests. This was an inspection; no application logic or demo data was changed.

## Result

The main local-prototype workflow is implemented. It is not a 100% literal implementation of every detail in the original document. All 40 existing automated tests passed again and the production build passed. Passing those tests does not establish coverage of every requirement or production readiness.

## Feature coverage

| Original requirement | Finding | Evidence |
|---|---|---|
| Three role logins, password hashing, sessions, role guards | Present | backend/src/app.js; auth.test.js |
| Student/faculty university email formats | Present | Login validation in app.js |
| Semester create/edit/activate/archive; Fall/Spring | Present | semesters.js; semesters.test.js |
| One active semester and preserved history | Present | Partial unique semester index, archive operations and historical queries |
| Excel .xls/.xlsx validation, preview and confirmation | Present | course-imports.js; course-imports.test.js |
| Match against permanent core master, ignore non-core | Present with sample master data | Course classification and core_courses table |
| Semester-specific faculty authorization; own courses only | Present | faculty.js, transactional ownership recheck and faculty.test.js |
| Admin per-course PA/TA slots and semester AED amounts | Present | allocations.js, Allocations.jsx; allocations.test.js |
| Amount visible before applying; faculty cannot edit slots | Present | StudentWorkspace.jsx and backend role guards |
| Year 2+, CGPA /10, course and grade requirements | Present | workflow-common.js eligibility and criteria validation |
| Additional structured eligibility requirements | Partial | Only free-text requirement plus student declaration; faculty verifies it manually. No configurable structured-rule engine beyond year/CGPA/course/grade. |
| Optional interview setting, scheduling and evaluation | Present | FacultyReview.jsx; student-faculty-workflow.js |
| Student academic profile, grades and prior appointments | Present with synthetic records | Academic profile endpoint and StudentWorkspace.jsx |
| Eligible/ineligible reasons and server-side submission check | Present | opportunities and application routes; workflow tests |
| Multiple PA and TA applications | Present | Tests exercise 3 PA plus 4 TA for one student |
| Duplicate exact-opportunity prevention | Present | Unique student/assignment/role constraint |
| Application tracking and statuses | Present | Separate PA/TA tables and status transitions |
| Faculty search/filter/profile/compare/shortlist/reject | Present | FacultyReview.jsx; comparison supports up to 3 candidates |
| Selected pending, then accepted appointment | Present | Explicit state transitions |
| Max 1 active PA and 1 active TA; PA+TA permitted | Present | Transaction locks, database unique index, concurrent integration tests |
| Same-role-only automatic cancellation | Present | Transactional update and audit for each cancelled application |
| Course allocation limit | Fixed after audit | Pending selections plus active appointments cannot exceed allocation. Both SELECT and ACCEPT check capacity under the semester lock; Admin cannot lower slots below this total. |
| Conflict detection | Mandatory role/capacity conflicts present | Timetable overlap warnings absent; original specification makes these conditional on timetable availability. |
| Live vacancy calculations | Present | Allocated minus active appointments; updates on reload/request after acceptance/cancellation |
| Admin monitoring by semester, role, status, course/faculty | Present with simpler filtering | Semester/role/status selectors; shared text search for course/faculty/student rather than separate combinable course/faculty selectors. |
| Admin final review, approval and locked results | Present | Finalization transaction and explicit confirmation dialog |
| View approved list and Excel/PDF export | Present, PDF limited | Snapshot contains requested columns. PDF uses basic Latin text and replaces unsupported characters; Excel retains Unicode. |
| Previous semesters and final results retained | Present | No deletion on archive; immutable final-results snapshots |
| Audit important actions | Present, detailed schema partial | Uses id, user_id, action, JSON details and time. Does not consistently snapshot actor role, entity type/id, semester and old/new values in the specified form for every event. Upload authorization is logged as a batch summary rather than individual faculty-grant events. |
| Security hardening | Prototype controls present | Hashing, expiring/revocable sessions, origin guard, upload/login rate limits, parameterized queries, role/course/student ownership tests. No standalone PostgreSQL deployment or external security assessment was performed. |
| UI polish | Present | Campus branding, metrics, tables, progress indicators, responsive CSS, status badges, confirmations, loading/errors |
| Demo users/data/workbook/story | Present | seed-workflow-demo.js, sample workbook, DEMO-GUIDE.md |
| No email/SMS/push notifications | Correctly omitted | Matches the requested scope |

## The 32 critical rules

Rules 1-14, 16-29 and 31-32 have corresponding functionality in the prototype. Rule 15 (eligibility before submission) is implemented for year/CGPA/course/grade; additional free-text requirements rely on a declaration rather than objective automatic verification. Rule 30 (audit plus role-based security) is present functionally, but audit records do not fully implement the detailed audit schema specified in section 39. Rule 26 has now been corrected: pending selections reserve capacity alongside active appointments.

## Intentionally deferred items, not missing prototype requirements

- Actual college core-course list: the specification says it will be provided later; current master is demonstration data.
- Real academic-record integration and university SSO: explicitly future integration; seeded profiles and prototype passwords are allowed by the specification.
- Timetable overlap warnings: conditional on timetable data, which has not been supplied.
- Different assistantship amounts per course: described as a possible later extension; current amounts are semester-wide as requested.

## Additional implementation restrictions worth knowing

- Faculty criteria lock after the first application for that role. This extra restriction prevents silently changing requirements for existing applicants.
- Confirmed faculty assignments cannot currently be corrected through a second upload in the same semester. New semesters accept fresh uploads. Mid-semester correction was not an explicit original requirement.
- Excel assignment grants do not create user accounts. Faculty still needs an existing prototype user account; the demo seeder supplies those. There is no Admin account-creation UI.
- Finalized semesters cannot be reopened; this meets the no-silent-modification requirement but offers no administrative amendment workflow.
- The grade order is a prototype assumption (A, A-, B, B-, C, C-, D, E). Confirm it with the college before loading real transcripts.

## Verification scope

Fresh run: 40/40 backend tests passed; frontend production build passed (only existing React Router bundling warnings). Tests cover role isolation, Excel validation, rollover, eligibility failures, 3 PA + 4 TA applications, interview/no-interview paths, concurrency, capacity, cancellation, vacancies, finalization, history and export responses. The complete browser workflow was exercised in the preceding implementation turn; this audit did not repeat browser interactions or finalize the live demo semester.

Recommended next corrections for closer specification alignment: standardized audit metadata, structured additional-rule checks if required by the college, and Unicode-safe PDF output. Separating the Admin course/faculty filters would make the requested monitoring controls more exact.
