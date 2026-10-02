# Phase 3 — Core courses and Excel processing

Admin navigation: **PA/TA → Excel upload**. Choose a semester, upload a workbook, review its results, then select **Confirm semester assignments**. The upload alone never creates faculty/course assignments. Confirmed assignments are saved in `semester_course_assignments`, not in the permanent core-course table.

## Setup

Stop the preview before migrating or seeding when using embedded PostgreSQL:

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run seed:courses -w backend
npm.cmd run samples -w backend
npm.cmd run build
npm.cmd run preview
```

Migration 002 adds stored previews. The sample seed inserts six demonstration core courses without overwriting existing rows. These are not the final college-approved list. Replace the sample master through a reviewed database migration when the approved list is supplied. Do not infer core status from uploaded course names.

The downloadable workbooks are in `frontend/public/samples/`:

- `course-heads-template.xlsx`: required headers, no data.
- `course-heads-demo.xlsx`: ten sample rows, six matching core courses, four ignored non-core courses, five distinct matched faculty.

## Workbook format

Use exactly one worksheet, with these headers in row 1 (case and surrounding whitespace are ignored):

| Course Code | Course Name | Course Head | Faculty Email |
|---|---|---|---|
| CS F303 | Computer Networks | Demo Faculty 1 | demo.faculty1@dubai.bits-pilani.ac.in |

Both `.xlsx` and binary `.xls` are supported. Limits: 2 MB, 1,000 course rows, 20 columns. Empty rows are skipped. Course-code spacing/case and faculty-email case are normalized. Missing fields, malformed codes, non-campus email addresses, formulas in required columns, and duplicate normalized course codes produce row errors. Every occurrence of a duplicate is invalid; no arbitrary first-row winner is chosen. Extra columns are ignored.

Results are **MATCHED**, **IGNORED**, or **INVALID**. Ignored means a valid row whose course code is not in the master list. All invalid rows must be fixed and re-uploaded, and at least one core match is required before confirmation. Master course names remain authoritative.

## Confirmation and history

- Previews are stored on the server, bound to the uploading Admin and semester, and expire after one hour.
- Confirmation accepts only the preview ID; it does not trust browser-submitted assignments or counts.
- Archived/finalized semesters are read-only, including if archived after a preview was generated.
- A changed master list invalidates the preview; re-upload before confirming.
- Confirmation locks the semester and preview and saves every matching assignment and the audit entry in one transaction.
- Repeated or concurrent confirmations cannot duplicate assignments.
- Previously confirmed semester assignments are not replaced by a later upload in Phase 3. This avoids silently deleting allocations or historical application records. A future explicit replacement workflow can be added if required.
- A new semester starts with no assignments. Nothing carries over automatically.
- Faculty counts show unique eligible course-head emails, not newly created login accounts. Dynamic Faculty login/course authorization is Phase 4; Phase 3 does not create accounts or grant unrestricted faculty access.

## Endpoints

All require an authenticated Admin session; mutation requests also require the configured Origin.

| Method | Path | Purpose |
|---|---|---|
| GET | /api/admin/core-courses | Read master list |
| GET | /api/admin/semester/:semesterId/course-heads | Read semester assignments |
| POST | /api/admin/semester/:semesterId/course-heads/upload | Multipart form with one file named `file`; returns preview |
| POST | /api/admin/semester/:semesterId/course-heads/confirm | JSON `{ "preview_id": "..." }` |

Workbook parsing runs in a worker with a memory limit and timeout. File signatures are checked against extensions. Uploads are rate limited. Original workbook bytes are not retained; normalized preview rows and audit metadata are retained locally.

## Validation

The full suite has 19 passing tests across Phases 1–3. Phase 3 checks Admin-only access, preview isolation, expected sample counts, confirmation, ownership and semester binding, replay/concurrent protection, duplicate and invalid row handling, invalid/oversized files, `.xls` parsing, expiry, changed master lists, archival, normalization, formula rejection, and cross-semester preservation. Frontend build passed. Tests use isolated embedded PostgreSQL; standalone PostgreSQL remains unverified in this environment.

Browser verification also passed: Admin signed in, selected the demo workbook, uploaded it, saw the expected counts and zero saved assignments before confirmation, confirmed six core-course assignments, and refreshed to verify persistence. The local Fall 2026-2027 semester now contains those six demonstration assignments. Screenshots are saved as `phase-3-preview.png` and `phase-3-confirmed.png` in the project root. To demonstrate a fresh upload again, create a new draft semester; the confirmed Fall records are preserved.

Excel library installation follows the [official SheetJS Node.js instructions](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) and pins SheetJS 0.20.3 from its official distribution.
