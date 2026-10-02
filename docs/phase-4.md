# Phase 4 — Dynamic faculty authorization

Faculty sign-in now requires both valid credentials and a confirmed assignment as the head of a core course in the **active** semester. A campus email or permanent FACULTY role alone is insufficient. Draft, finalized, and archived semester assignments do not grant access.

## Using the faculty portal

Choose **PA/TA → Faculty** on the login page. An authorized faculty member sees the active semester and only their assigned courses, including multiple courses when appropriate. Select **View course** to see that course's assignment and read-only PA/TA allocation counts. Counts remain zero until Admin allocation is implemented in Phase 5.

Unassigned faculty receive an explicit access-denied message and no new session. A request for another faculty member's course also returns 403, even when its URL is typed directly. Unassigned and nonexistent course URLs return the same denial to avoid disclosing course details.

## Backend enforcement

- Login checks confirmed assignments joined to the active semester and core-course master list.
- Every `/api/faculty/*` request first checks authentication and FACULTY role, then re-queries current assignments. JWTs never contain cached authorization lists.
- `GET /api/faculty/courses` returns only the signed-in user's assigned courses.
- `GET /api/faculty/courses/:courseCode` restricts the course to that same authorized list. Both `CSF303` and `CS%20F303` are accepted.
- `GET /api/faculty/profile` is also protected by current-semester authorization.
- Reassignment, archival, finalization, and semester switches take effect on the next request with an existing session. The frontend rechecks when its tab becomes visible/focused and offers **Refresh access**.
- Revoked faculty can still use the general logout endpoint. `/api/auth/me` identifies a valid session but grants no course access.
- Denied faculty logins create `FACULTY_LOGIN_DENIED` audit records. Successful logins retain the existing audit behavior.

## Local demonstration

The Phase 3 sample Fall semester has six confirmed assignments. Two generated faculty accounts now match those assignments:

| Account | Authorized sample courses |
|---|---|
| demo.faculty1@dubai.bits-pilani.ac.in | CS F303 Computer Networks; CS F372 Operating Systems |
| demo.faculty2@dubai.bits-pilani.ac.in | CS F364 Design and Analysis of Algorithms |

Passwords are stored in the Git-ignored `FACULTY-DEMO-ACCESS.md`. The original `faculty@dubai.bits-pilani.ac.in` account remains unchanged and is deliberately denied because it has no matching assignment. Admin and Student credentials are unchanged.

The optional `node src/seed-faculty-demo.js` script runs from `backend/` with the preview stopped in embedded mode. It creates only missing demo users and never modifies existing passwords or assignments. Excel confirmation does not provision user passwords; real faculty must have separately provisioned accounts until university SSO is available.

## Verification

All 25 integration tests passed, including the previous phases. New coverage verifies no-active-semester denial, unassigned denial without session creation, two-course visibility, direct URL isolation, wrong-role access, incorrect passwords, current-session reassignment, semester rollover, historical preservation, finalized-semester denial, and logout after authorization ends.

Production frontend build passed. Browser checks verified the two assigned courses, course details, a denied attempt to open CSF364 as Demo Faculty 1, and denial of the original unassigned faculty account. Screenshots: `phase-4-faculty.png` and `phase-4-access-denied.png`.

No schema migration is required for Phase 4. Tests run on embedded PostgreSQL; a standalone PostgreSQL deployment remains unverified. Phase 5 allocation editing and later eligibility/application workflows are not implemented yet.
