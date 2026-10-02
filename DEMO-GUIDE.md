# College demonstration guide

## Accounts and preparation

Start the local portal at http://127.0.0.1:5173. Existing Admin and Student credentials are in `LOCAL-ACCESS.md`; existing faculty credentials are in `FACULTY-DEMO-ACCESS.md`; additional demo accounts are in `DEMO-ACCESS.md`. These private local files are excluded from Git.

All added students are synthetic. Student 02 is first-year, Student 03 has CGPA 6.2, and Student 04 has B grades. Other demo students meet the sample year/CGPA/grade requirements.

The existing Fall semester retains its course heads from the earlier ten-row sample. Demo Faculty 1 heads Networks and Operating Systems. The new `frontend/public/samples/hackathon-course-heads.xlsx` is for a fresh semester and contains nine rows, six core matches, three ignored non-core rows and six distinct core heads. Do not replace existing semester assignments.

## One story to present

1. Sign in as Admin. Show the semester selector, application counts and PA/TA vacancy bars. Open Allocations and show course slots and AED amounts.
2. For an upload demonstration, create a new draft semester, upload `hackathon-course-heads.xlsx`, review six core matches / three ignored, then confirm. Keep the current semester active while presenting the existing workflow; only one semester can be active.
3. Explain that the non-core demo faculty account is denied. Sign in as Demo Faculty 1 and show that only the assigned courses are visible.
4. Open Networks, then Eligibility & interviews. Show year 2+, CGPA 7 and grade A-. PA does not require an interview; TA does. Requirements become read-only after receiving applications.
5. Sign in as an eligible student. Show Academic profile and Opportunities. Apply to Networks, Algorithms and Database Systems PA, plus Networks, OOP, Compiler and Operating Systems TA.
6. Show My applications: three PA and four TA submissions are allowed. Separately sign in as Student 02/03/04 to demonstrate precise eligibility failure reasons.
7. Sign in as Networks faculty. Open the student's profile, compare candidates if more have applied, shortlist PA, select candidate and accept appointment.
8. Return to the student. Networks PA is Accepted; Algorithms and Database Systems PA are Auto-cancelled. TA applications are untouched.
9. Sign in as Demo Faculty 1 for Operating Systems TA. Shortlist, select and accept the same student. This demonstrates one PA plus one TA; remaining TA applications auto-cancel.
10. To demonstrate interviews, use another eligible student's Networks TA application. Shortlist, schedule a future interview in Dubai time, record a demonstration evaluation, select and accept. A required evaluation cannot be skipped.
11. Return to Admin. Show the updated vacancies, application status filters, and audit trail. Review Final approval and explain remaining vacancies.
12. When ready to end the cycle, choose Finalize semester results and confirm. This locks results and closes pending applications. Open Final list, download Excel and PDF, and optionally archive the semester.

Use a fresh student or semester for each repeat; accepted and auto-cancelled history is deliberately preserved. Finalize only at the end of the demonstration because the portal has no reopen function.

## Verification

Run `npm.cmd test` for backend integration tests and `npm.cmd run build` for the production frontend. The tests use a separate in-memory database and do not change the presentation data.

## Current rehearsal state

The browser rehearsal created seven applications for the original Demo Student (`f20240123@dubai.bits-pilani.ac.in`). Networks PA and Networks TA were accepted, including the TA interview/evaluation branch; the other two PA and three TA applications were auto-cancelled. The semester remains ACTIVE with two appointments awaiting Admin approval, so you can continue practising. Use one of the 15 new students for a fresh application flow. Finalization and both export endpoints were verified in isolated automated tests, without locking your active demo semester.

Demo academic profile now opens by default after Student login. It includes existing course grades and CGPA plus a weekly sample timetable for the active semester (Dubai time). Six class meetings are seeded for each of the 16 demo students. These are synthetic presentation records, not college data. To populate a new active semester, stop the preview and run node src/seed-timetable.js from the backend folder, then restart the preview. The seed preserves existing timetable entries, grades and CGPA. Timetable display alone does not implement duty-overlap detection.

Faculty review additions: Open an applicant profile to view their semester timetable and save private review notes. After accepting PA/TA appointments, use Submit selections to Admin on each course. Admin final approval requires every active appointment to be submitted. Later accepted appointments require a new submission; notes and submissions are audited. Timetables remain sample data, and duty-time overlap checks require duty schedules.

Student additions: The application form accepts an optional 2,000-character statement, visible to assigned faculty. Students may edit their own APPLIED application while the application window is open, before faculty review starts; eligibility and required declarations are checked again. Grades, CGPA, course and role cannot be changed through editing. Pending applications may still be withdrawn. New Current assistantships, Final results and Semester history tabs distinguish acceptance from Admin approval. Final results return only the signed-in student's preserved result, including no-award outcomes. Search supports course/role/eligibility; applications can be filtered by semester and status.
University login uses local portal accounts with college email addresses, not college SSO. Academic records and timetables remain demo data pending authorized college integration.

October 2 update: Each faculty member now heads one course per semester. Demo Faculty 1 heads Networks only; Demo Faculty 6 heads Operating Systems. Excel previews and the database reject duplicate faculty heads in the same semester. Admin controls eligibility and interview settings in Allocations > Admin eligibility rules. Faculty may update only the additional requirement, including after applications arrive; submitted applications retain their original requirement snapshot.
The active presentation has different candidates: original student f20240123 holds Networks PA; Demo Student 05 (f20250005) holds Networks TA. The old original-student TA appointment is cancelled and preserved in history; the new TA appointment awaits faculty submission. Existing PA+TA permission for a single student remains unchanged.

Faculty permission update: Faculty may now edit minimum grade and interview Yes/No as well as additional requirements. Year, CGPA and required course remain Admin-controlled. Changes apply to new applications; existing applications retain their submitted criteria and interview workflow.
