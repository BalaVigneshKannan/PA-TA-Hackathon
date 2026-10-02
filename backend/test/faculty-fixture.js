import {randomUUID} from 'node:crypto';
// Temporary authorization for earlier role-isolation tests, in isolated test DBs.
export async function grantTestFaculty(db,email){
 const semester='FALL_2098_99',course='ZZ F999',id=randomUUID();
 await db.query('INSERT INTO core_courses(course_code,name) VALUES($1,$2)',[course,'Test authorization course']);
 await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end,status) VALUES($1,'2098-2099','FALL','2098-09-01','2098-10-01','ACTIVE')",[semester]);
 await db.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email) VALUES($1,$2,$3,$4,$5)',[id,semester,course,'Test Faculty',email]);
 return async()=>{await db.query('DELETE FROM semester_course_assignments WHERE id=$1',[id]);await db.query('DELETE FROM semesters WHERE id=$1',[semester]);await db.query('DELETE FROM core_courses WHERE course_code=$1',[course]);};
}
