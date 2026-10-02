CREATE UNIQUE INDEX one_course_per_faculty_semester ON semester_course_assignments(semester_id,lower(faculty_email));
