import {normalizeCode} from './course-imports.js';

export const facultyDenied='ACCESS DENIED. You are not currently assigned as the head of an eligible core course in the active semester.';

// Never cache these assignments in a JWT: semester and course-head changes
// must take effect on the next protected request, even for an existing session.
export async function facultyAssignments(db,email){
 const {rows}=await db.query(`SELECT a.id,a.semester_id,a.course_code,c.name AS course_name,
  a.faculty_name,a.faculty_email,a.pa_slots,a.ta_slots,
  s.pa_amount,s.ta_amount,s.academic_year,s.term,s.application_start,s.application_end
  FROM semester_course_assignments a
  JOIN semesters s ON s.id=a.semester_id AND s.status='ACTIVE'
  JOIN core_courses c ON c.course_code=a.course_code
  WHERE a.faculty_email=$1 ORDER BY a.course_code`,[email]);
 return rows;
}
export function facultyRoutes(app,db){
 app.use('/api/faculty',async(req,res,next)=>{
  const courses=await facultyAssignments(db,req.user.email);
  if(!courses.length)return res.status(403).json({error:facultyDenied,code:'FACULTY_NOT_ASSIGNED'});
  req.facultyCourses=courses;next();
 });
 const semester=req=>{const first=req.facultyCourses[0];return {id:first.semester_id,pa_amount:first.pa_amount,ta_amount:first.ta_amount,academic_year:first.academic_year,term:first.term,application_start:first.application_start,application_end:first.application_end};};
 app.get('/api/faculty/profile',(req,res)=>res.json({user:req.user,semester:semester(req),courses:req.facultyCourses}));
 app.get('/api/faculty/courses',(req,res)=>res.json({semester:semester(req),courses:req.facultyCourses}));
 app.get('/api/faculty/courses/:courseCode',(req,res)=>{
  const code=normalizeCode(req.params.courseCode);
  const course=req.facultyCourses.find(c=>c.course_code===code);
  if(!course)return res.status(403).json({error:'ACCESS DENIED. You are not authorized to access this course in the active semester.',code:'COURSE_NOT_ASSIGNED'});
  res.json({semester:semester(req),course});
 });
}
