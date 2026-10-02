# API reference

All paths below are relative to the origin serving the portal. Local compiled preview: `http://127.0.0.1:5173`. Development API: `http://127.0.0.1:3001` via Vite's same-origin proxy. JSON mutations require `Content-Type: application/json` and the exact `Origin` configured in `APP_ORIGIN`. Authentication uses the HttpOnly `portal_session` cookie, not a client-supplied bearer token.

JSON bodies are limited to 16 KB. Workbook uploads use `multipart/form-data` with one `file` field, at most 2 MiB, and `.xls` or `.xlsx` contents. API responses use `Cache-Control: no-store`. Tokens/password hashes are never returned in public-user responses.

## Authentication

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/api/health` | Database-backed health response: `{"status":"OK"}`. |
| POST | `/api/auth/login` | Body `{email,password,role}`; role is `ADMIN`, `FACULTY`, or `STUDENT`. Issues the session cookie and returns `{user}`. |
| GET | `/api/auth/me` | Restores the current public user; 401 for missing/expired/revoked sessions. |
| POST | `/api/auth/logout` | Revokes the session and clears the cookie; returns 204. |
| POST | `/api/auth/intranet` | Optional `{assertion}` exchange; returns 503 until configured. See [the full contract](intranet-integration.md). |

Password login is limited to 20 attempts per 15 minutes per rate-limit key. The intranet exchange limit is 30 per 15 minutes. The default stores are in-memory and need deployment-specific proxy/scaling configuration.

Example local login, using credentials generated on your computer:

```sh
curl -i -c portal-cookies.txt http://127.0.0.1:5173/api/auth/login \
  -H 'Origin: http://127.0.0.1:5173' \
  -H 'Content-Type: application/json' \
  --data '{"email":"<generated-email>","password":"<generated-password>","role":"ADMIN"}'
curl -b portal-cookies.txt http://127.0.0.1:5173/api/auth/me
```

These are POSIX-shell examples; use `curl.exe` and PowerShell quoting on Windows. Cookie files contain a local session credential and should not be committed.

## Admin

All Admin endpoints require an authenticated `ADMIN` account.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Admin identity and active semester. |
| GET / POST | `/api/admin/semesters` | List semesters / create a draft. |
| PATCH | `/api/admin/semesters/:id` | Change window dates for draft/active semesters. |
| POST | `/api/admin/semesters/:id/activate` | Activate a draft; only one active semester is allowed. |
| POST | `/api/admin/semesters/:id/archive` | Archive while preserving records. |
| GET / PUT | `/api/admin/semesters/:id/allocations` | Read or atomically save dates, amounts and all course slots. |
| GET | `/api/admin/core-courses` | Permanent core-course master. |
| GET | `/api/admin/semester/:semesterId/course-heads` | Read confirmed assignments. Note the singular `semester` in this route. |
| POST | `/api/admin/semester/:semesterId/course-heads/upload` | Validate an upload and return a preview; does not change assignments. |
| POST | `/api/admin/semester/:semesterId/course-heads/confirm` | Confirm `{preview_id}` for its originating Admin/semester. |
| GET | `/api/admin/assignments/:id/criteria` | Read criteria and received application roles. |
| PUT | `/api/admin/assignments/:id/criteria/:role` | Publish PA/TA requirements in draft/active semesters; Admin changes lock once that role receives an application. |
| GET | `/api/admin/semesters/:id/monitor` | Semester, courses, appointments, applications, conflicts and totals. |
| POST | `/api/admin/appointments/:id/cancel` | Cancel an active appointment with `{reason}` of at least five characters. |
| POST | `/api/admin/semesters/:id/finalize` | `{confirm:true}` approves submitted active appointments and locks the semester. |
| GET | `/api/admin/semesters/:id/results` | Read the approved saved result; unavailable before finalization. |
| GET | `/api/admin/semesters/:id/results?format=xlsx` | Download the approved Excel list. |
| GET | `/api/admin/semesters/:id/results?format=pdf` | Download the approved PDF list. |
| GET | `/api/admin/audit?offset=0&semester=:id` | 50-event pagination; semester filter is optional; returns `{logs,has_more}`. |

Semester creation: `{academic_year:"2026-2027",term:"FALL",application_start:"2026-09-01",application_end:"2026-10-31"}`. Dates include complete days in Dubai time. Term and academic year identify the semester and cannot be changed afterward.

Allocation saving supplies `pa_amount`, `ta_amount`, window dates and the complete `courses` list: `[{id,pa_slots,ta_slots}]`. Slot values are integers between 0 and 10,000; amounts have at most two decimals. Slots cannot fall below active appointments plus pending selections.

Admin criteria bodies supply `minimum_year` (integer 2–6), `minimum_cgpa` (number 0–10 with two decimals), `required_course`, `minimum_grade`, `additional_requirement` and boolean `interview_required`. A minimum grade requires a course code. Passing grade order is currently `A, A-, B, B-, C, C-, D, E`.

## Faculty

Faculty endpoints require a `FACULTY` account with a current active-semester assignment. Course and applicant access is checked against the account's email and rechecked during mutations.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/faculty/profile` | Faculty identity, active semester and assigned courses. |
| GET | `/api/faculty/courses` | Active assigned courses. |
| GET | `/api/faculty/courses/:courseCode` | Read an authorized course; codes are normalized. |
| GET | `/api/faculty/assignments/:id/workflow` | Criteria, applications and active appointment submission states. |
| PUT | `/api/faculty/assignments/:id/criteria/:role` | Update only `minimum_grade`, `interview_required` and `additional_requirement`. Admin must publish the base rules first. |
| GET | `/api/faculty/applications/:id/profile` | Assigned applicant's class timetable and private faculty notes. |
| POST | `/api/faculty/applications/:id/notes` | Add `{note}` of 1–2,000 characters after trimming. |
| POST | `/api/faculty/applications/:id/action` | Execute a supported review transition, described below. |
| POST | `/api/faculty/assignments/:id/submit` | `{confirm:true}` submits new accepted appointments for Admin approval. |

Review bodies include `action`:

| Action | Allowed current status / additional input |
|---|---|
| `REVIEW` | `APPLIED` → `UNDER_REVIEW`. |
| `SHORTLIST` | `APPLIED` or `UNDER_REVIEW` → `SHORTLISTED`. |
| `INTERVIEW` | `SHORTLISTED` or `INTERVIEW` → `INTERVIEW`; requires an interview-enabled submitted rule, future timezone-qualified `scheduled_at` and `location`. Rescheduling clears the prior evaluation. |
| `EVALUATE` | `INTERVIEW`; nonempty `evaluation`, at most 2,000 characters. |
| `SELECT` | `SHORTLISTED` without required interview, or `INTERVIEW` with required evaluation → `SELECTED_PENDING`; reserves capacity. |
| `ACCEPT` | `SELECTED_PENDING` → `ACCEPTED`; creates the active appointment and auto-cancels other pending same-role applications. |
| `REJECT` | Any pending status → `NOT_SELECTED`. |

## Student

All Student endpoints require `STUDENT`. Identity is derived from the session; passing another student ID does not grant access.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/student/profile` | Public account identity. |
| GET | `/api/student/academic-profile` | Academic record, active timetable and appointment history. |
| GET | `/api/student/opportunities` | Active semester, generated role opportunities, eligibility reasons and current academic profile for prefilled forms. |
| GET | `/api/student/applications` | Own applications with status, interview details, `can_edit` and `can_withdraw`. Private evaluation is omitted. |
| POST | `/api/student/applications` | Submit `{assignment_id,role,statement?,requirement_acknowledged?}`; returns 201 and `{application}`. |
| PUT | `/api/student/applications/:id` | Edit `{statement,requirement_acknowledged}` while still `APPLIED` and inside the active application window. |
| POST | `/api/student/applications/:id/withdraw` | Withdraw own pending application while the semester is active. |
| GET | `/api/student/assistantships` | Own current/historical appointments and personal approved-result rows. |

Statements are optional and limited to 2,000 characters. An additional requirement needs explicit `requirement_acknowledged:true`. Client-supplied academic or role changes cannot alter the institutional profile or the identity of an existing application.

## Errors

Errors normally return `{"error":"message"}`. Some faculty authorization errors also include a `code`.

| Status | Meaning |
|---|---|
| 400 | Invalid input, ineligible application, malformed JSON or invalid identifier. |
| 401 | Missing/invalid session or invalid/replayed institutional assertion. |
| 403 | Wrong role, wrong origin, unassigned faculty or unauthorized course access. |
| 404 | Requested entity not found or not owned by the student. |
| 409 | Duplicate, closed/locked workflow, invalid transition, capacity/appointment conflict or unavailable final result. |
| 413 | JSON or workbook size limit exceeded. |
| 429 | Rate limit reached. |
| 500 | Unexpected server error; internal details are not returned to clients. |
| 503 | Optional intranet sign-in has not been configured. |
