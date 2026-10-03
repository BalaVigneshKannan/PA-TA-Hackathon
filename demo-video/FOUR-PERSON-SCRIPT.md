# Four-presenter demonstration script

Video duration: 02:45. Spoken script: 365 words. At 135 words per minute, allow roughly 163 seconds plus brief handoffs, staying below three minutes. Do not read headings or screen cues aloud.

## Presenter 1 - 00:00 to 00:42

**Problem, solution, users and Admin setup**

*On screen: PA & TA Application Automation; From manual coordination to a shared workflow; Three workspaces. One application cycle.; Monitor the active semester; Configure positions and application dates; Publish eligibility to generate forms.*

Professional and Teaching Assistant recruitment involves applications, academic checks, reviews, and final lists. Manual coordination makes this process harder to manage. Our solution brings the complete workflow into one portal, from generated application forms to approved results. Administrators configure and approve. Students apply and track progress. Faculty review candidates for their assigned courses. The Admin dashboard shows the active semester, application counts, filled positions, and vacancies. Admin sets course slots, assistantship amounts, application dates, and course-head assignments. Publishing year, CGPA, grade, and interview rules generates the opportunities and forms.

## Presenter 2 - 00:42 to 01:13

**Student application flow and Faculty access**

*On screen: Start with the academic profile; Discover eligible PA and TA opportunities; Submit a prefilled application; Track multiple applications; Faculty access follows course assignments.*

The student starts with a preloaded academic profile, reducing repeated data entry. Opportunities show eligibility, available positions, requirements, and assistantship amounts. The backend rechecks eligibility before submission. This form already contains academic details. The student only adds an optional statement. Here, two PA applications and one TA application are submitted and tracked separately. Faculty can access only their assigned active-semester course. Let us follow the review process.

## Presenter 3 - 01:13 to 01:48

**Faculty review, selection and interviews**

*On screen: Review the submitted academic snapshot; Shortlist and select within capacity; Accept the PA appointment; Follow the required TA interview branch; Record evaluation before TA selection; Submit both appointments to Admin.*

Faculty inspect the submitted academics, statement, and timetable. Private notes support their review. The candidate is shortlisted and selected. Capacity checks prevent the course from being overfilled. Accepting the PA appointment automatically cancels other pending applications for the same role. For the interview-required TA role, faculty schedule an interview with its time and location. An evaluation must be recorded before selection. The TA appointment is then accepted. One student may hold one PA and one TA. Faculty submit both appointments to Admin.

## Presenter 4 - 01:48 to 02:45

**Final approval, technical choices and impact**

*On screen: Review submissions and finalize; Automatically generate the final selected list; See automatic cancellation and accepted roles; View personal approved results; A full-stack system with server-enforced rules; University integration with a defined contract; Less coordination. Clearer decisions.; Ready to demonstrate. Next: university rollout..*

Admin reviews submitted appointments and conflicts, then finalizes the semester, locking the approved results. The final selected list is generated automatically and can be downloaded as Excel or PDF. The student can see the other PA application automatically cancelled, with both accepted roles retained. Personal final results show only that student's approved appointments and amounts. React and Vite provide the frontend. Express enforces access and workflow rules. PostgreSQL transactions protect appointments; local mode uses PGlite. Revocable sessions protect access. An optional signed intranet interface supports institutional identity and academic synchronization. The expected impact is less manual entry, organized reviews, clearer status tracking, and auditable final lists. This demonstration uses synthetic data. Real university sign-in and production hosting remain to configure; duty timetable-overlap detection is a future extension.
