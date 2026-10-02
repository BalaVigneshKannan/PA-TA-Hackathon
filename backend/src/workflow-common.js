import {randomUUID} from 'node:crypto';
export const pending=['APPLIED','UNDER_REVIEW','SHORTLISTED','INTERVIEW','SELECTED_PENDING'];
export const grades=['A','A-','B','B-','C','C-','D','E'];
export function fail(status,message){throw Object.assign(new Error(message),{status});}
export const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){if(e.status)return res.status(e.status).json({error:e.message});if(e.code==='23505')return res.status(409).json({error:'This application or appointment already exists. Refresh to see the latest status.'});if(e.code==='22P02')return res.status(400).json({error:'Invalid identifier or value.'});next(e);}};
export const audit=(tx,user,action,details={})=>tx.query('INSERT INTO audit_logs(id,user_id,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),user,action,JSON.stringify(details)]);
export function textValue(value,label,max=1000){if(typeof value!=='string'||value.trim().length>max)fail(400,`Enter a valid ${label} (maximum ${max} characters).`);return value.trim();}
export async function lockSemester(tx,id,{allowDraft=false}={}){const s=(await tx.query('SELECT * FROM semesters WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!s)fail(404,'Semester not found.');if(s.status!=='ACTIVE'&&!(allowDraft&&s.status==='DRAFT'))fail(409,'Only an active semester can be changed. Finalized and archived results are read-only.');return s;}
export async function assignment(tx,id,email){const a=(await tx.query('SELECT a.*,c.name AS course_name FROM semester_course_assignments a JOIN core_courses c USING(course_code) WHERE a.id=$1',[id])).rows[0];if(!a)fail(404,'Course assignment not found.');if(email&&a.faculty_email!==email)fail(403,'You are not authorized for this course.');return a;}
export async function profile(db,id){const student=(await db.query('SELECT s.*,u.name,u.email FROM students s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1',[id])).rows[0]??null;const courses=student?(await db.query('SELECT course_code,grade FROM student_courses WHERE student_id=$1 ORDER BY course_code',[id])).rows:[];return {student,courses};}
export async function criteria(db,id,role){return (await db.query('SELECT * FROM eligibility_criteria WHERE assignment_id=$1 AND role=$2',[id,role])).rows[0]??null;}
export function eligibility(record,rule){
 const reasons=[];if(!record.student)return {eligible:false,reasons:['Your academic profile has not been loaded. Contact Admin.']};
 const s=record.student;if(s.current_year<2)reasons.push('University rule: only students in year 2 or above may apply.');
 if(!rule)reasons.push('Faculty has not published requirements for this role.');
 else{if(s.current_year<rule.minimum_year)reasons.push(`Minimum year: ${rule.minimum_year}. Your year: ${s.current_year}.`);if(Number(s.cgpa)<Number(rule.minimum_cgpa))reasons.push(`Minimum CGPA: ${rule.minimum_cgpa}/10. Your CGPA: ${s.cgpa}/10.`);
 if(rule.required_course){const c=record.courses.find(c=>c.course_code===rule.required_course);if(!c||!grades.includes(c.grade))reasons.push(`Complete ${rule.required_course} with a passing grade.`);else if(rule.minimum_grade&&grades.indexOf(c.grade)>grades.indexOf(rule.minimum_grade))reasons.push(`Minimum grade in ${rule.required_course}: ${rule.minimum_grade}. Your grade: ${c.grade}.`);}}
 return {eligible:reasons.length===0,reasons};
}
export async function applications(db,where,params){return (await db.query(`SELECT a.*,u.name,u.email,s.student_id AS university_id,s.programme,s.current_year,s.cgpa,c.course_code,cc.name AS course_name,c.faculty_name,c.faculty_email,i.scheduled_at,i.location,i.evaluation,se.status AS semester_status,se.application_start,se.application_end,
 EXISTS(SELECT 1 FROM assistantship_appointments x WHERE x.student_id=a.student_id AND x.semester_id=a.semester_id AND x.role=a.role AND x.active AND x.application_id<>a.id) AS same_role_conflict,
 EXISTS(SELECT 1 FROM assistantship_appointments x WHERE x.student_id=a.student_id AND x.semester_id<>a.semester_id) AS previous_assistantship
 FROM applications a JOIN semesters se ON se.id=a.semester_id JOIN users u ON u.id=a.student_id JOIN students s ON s.user_id=a.student_id JOIN semester_course_assignments c ON c.id=a.assignment_id JOIN core_courses cc USING(course_code) LEFT JOIN interviews i ON i.application_id=a.id WHERE ${where} ORDER BY a.created_at DESC,a.id`,params)).rows;}
