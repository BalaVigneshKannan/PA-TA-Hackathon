CREATE TABLE users (
 id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE CHECK(email = lower(email)),
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('ADMIN','FACULTY','STUDENT')),
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE students (
 user_id UUID PRIMARY KEY REFERENCES users(id), student_id TEXT NOT NULL UNIQUE,
 programme TEXT NOT NULL, current_year SMALLINT NOT NULL CHECK(current_year BETWEEN 1 AND 6),
 cgpa NUMERIC(4,2) NOT NULL CHECK(cgpa BETWEEN 0 AND 10)
);
CREATE TABLE core_courses (course_code TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE student_courses (
 id UUID PRIMARY KEY, student_id UUID NOT NULL REFERENCES students(user_id),
 course_code TEXT NOT NULL, grade TEXT NOT NULL, UNIQUE(student_id,course_code)
);
CREATE TABLE semesters (
 id TEXT PRIMARY KEY, academic_year TEXT NOT NULL,
 term TEXT NOT NULL CHECK(term IN ('FALL','SPRING')),
 application_start TIMESTAMPTZ NOT NULL, application_end TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','FINALIZED','ARCHIVED')),
 pa_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(pa_amount >= 0),
 ta_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK(ta_amount >= 0),
 CHECK(application_end > application_start), UNIQUE(academic_year,term)
);
CREATE UNIQUE INDEX one_active_semester ON semesters(status) WHERE status='ACTIVE';
CREATE TABLE semester_course_assignments (
 id UUID PRIMARY KEY, semester_id TEXT NOT NULL REFERENCES semesters(id),
 course_code TEXT NOT NULL REFERENCES core_courses(course_code), faculty_name TEXT NOT NULL,
 faculty_email TEXT NOT NULL CHECK(faculty_email = lower(faculty_email)),
 pa_slots INTEGER NOT NULL DEFAULT 0 CHECK(pa_slots >= 0), ta_slots INTEGER NOT NULL DEFAULT 0 CHECK(ta_slots >= 0),
 UNIQUE(semester_id,course_code), UNIQUE(id,semester_id)
);
CREATE TABLE eligibility_criteria (
 id UUID PRIMARY KEY, assignment_id UUID NOT NULL REFERENCES semester_course_assignments(id),
 role TEXT NOT NULL CHECK(role IN ('PA','TA')), minimum_year SMALLINT NOT NULL DEFAULT 2 CHECK(minimum_year >= 2),
 minimum_cgpa NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK(minimum_cgpa BETWEEN 0 AND 10),
 required_course TEXT, minimum_grade TEXT, additional_requirement TEXT,
 interview_required BOOLEAN NOT NULL DEFAULT FALSE, UNIQUE(assignment_id,role)
);
CREATE TABLE applications (
 id UUID PRIMARY KEY, student_id UUID NOT NULL REFERENCES students(user_id),
 assignment_id UUID NOT NULL, semester_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('PA','TA')),
 status TEXT NOT NULL DEFAULT 'APPLIED' CHECK(status IN ('APPLIED','UNDER_REVIEW','SHORTLISTED','INTERVIEW','SELECTED_PENDING','ACCEPTED','NOT_SELECTED','AUTO_CANCELLED','WITHDRAWN')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(assignment_id,semester_id) REFERENCES semester_course_assignments(id,semester_id),
 UNIQUE(student_id,assignment_id,role), UNIQUE(id,student_id,semester_id,role)
);
CREATE TABLE interviews (
 id UUID PRIMARY KEY, application_id UUID NOT NULL REFERENCES applications(id),
 scheduled_at TIMESTAMPTZ NOT NULL, location TEXT, evaluation TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE assistantship_appointments (
 id UUID PRIMARY KEY, application_id UUID NOT NULL UNIQUE,
 student_id UUID NOT NULL, semester_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('PA','TA')),
 active BOOLEAN NOT NULL DEFAULT TRUE, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(application_id,student_id,semester_id,role) REFERENCES applications(id,student_id,semester_id,role)
);
CREATE UNIQUE INDEX one_active_appointment_per_role ON assistantship_appointments(student_id,semester_id,role) WHERE active;
CREATE TABLE audit_logs (
 id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), action TEXT NOT NULL,
 details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id),
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assignments_faculty ON semester_course_assignments(faculty_email,semester_id);
CREATE INDEX applications_semester ON applications(semester_id);
CREATE INDEX sessions_expiry ON auth_sessions(expires_at);
