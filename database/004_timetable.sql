CREATE TABLE student_timetable (
 id UUID PRIMARY KEY, student_id UUID NOT NULL REFERENCES students(user_id),
 semester_id TEXT NOT NULL REFERENCES semesters(id), course_code TEXT NOT NULL,
 course_name TEXT NOT NULL, weekday SMALLINT NOT NULL CHECK(weekday BETWEEN 1 AND 7),
 starts_at TIME NOT NULL, ends_at TIME NOT NULL, room TEXT NOT NULL,
 is_demo BOOLEAN NOT NULL DEFAULT FALSE, CHECK(ends_at>starts_at),
 UNIQUE(student_id,semester_id,weekday,starts_at,course_code)
);
