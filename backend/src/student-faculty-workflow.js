import {randomUUID} from 'node:crypto';
import {normalizeCode} from './course-imports.js';
import {pending,grades,fail,handle,audit,textValue,lockSemester,assignment,profile,criteria,eligibility,applications} from './workflow-common.js';
export function studentWorkflow(app,db){
 app.get('/api/student/assistantships',handle(async(req,res)=>{
  const appointments=(await db.query(`SELECT p.id,p.role,p.active,p.approved_at,p.submitted_at,p.semester_id,c.course_code,cc.name AS course_name,c.faculty_name,se.term,se.academic_year,se.status AS semester_status,CASE WHEN p.role='PA' THEN se.pa_amount ELSE se.ta_amount END AS amount FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id JOIN semester_course_assignments c ON c.id=a.assignment_id JOIN core_courses cc USING(course_code) JOIN semesters se ON se.id=p.semester_id WHERE p.student_id=$1 ORDER BY se.academic_year DESC,se.application_start DESC,c.course_code`,[req.user.id])).rows;
  const results=(await db.query(`SELECT f.semester_id,f.approved_at,se.term,se.academic_year,
   COALESCE((SELECT jsonb_agg(r) FROM jsonb_array_elements(f.rows) r WHERE
    r->>'student_user_id'=s.user_id::text OR (NOT (r ? 'student_user_id') AND
     (r->>'student_id'=s.student_id OR EXISTS(
      SELECT 1 FROM applications original JOIN semester_course_assignments c ON c.id=original.assignment_id
      WHERE original.student_id=s.user_id AND original.semester_id=f.semester_id
       AND original.role=r->>'role' AND c.course_code=r->>'course_code'
       AND original.profile_snapshot->'student'->>'student_id'=r->>'student_id')))), '[]'::jsonb) AS rows
   FROM final_results f JOIN semesters se ON se.id=f.semester_id JOIN students s ON s.user_id=$1
   WHERE EXISTS(SELECT 1 FROM applications a WHERE a.student_id=$1 AND a.semester_id=f.semester_id)
   ORDER BY se.academic_year DESC,se.application_start DESC`,[req.user.id])).rows;
  res.json({appointments,results});
 }));
 app.put('/api/student/applications/:id',handle(async(req,res)=>{
  const statement=textValue(req.body?.statement??'','application statement',2000);
  await db.transaction(async tx=>{
   const initial=(await tx.query('SELECT * FROM applications WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id])).rows[0];if(!initial)fail(404,'Application not found.');
   const semester=await lockSemester(tx,initial.semester_id);const a=(await tx.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[initial.id])).rows[0];
   if(a.status!=='APPLIED')fail(409,'Applications can only be edited before faculty review starts.');
   if(Date.now()<new Date(semester.application_start)||Date.now()>new Date(semester.application_end))fail(409,'The application window is closed.');
   const rule=a.profile_snapshot?.criteria||await criteria(tx,a.assignment_id,a.role),check=eligibility(await profile(tx,req.user.id),rule);if(!check.eligible)fail(400,check.reasons.join(' '));
   if(rule.additional_requirement&&req.body?.requirement_acknowledged!==true)fail(400,'Confirm the additional requirement.');
   await tx.query('UPDATE applications SET statement=$1,requirement_acknowledged=$2,updated_at=now() WHERE id=$3',[statement,req.body?.requirement_acknowledged===true,a.id]);
   await audit(tx,req.user.id,'APPLICATION_EDITED',{application_id:a.id,semester_id:a.semester_id});
  });res.json({message:'Application updated.'});
 }));
 app.get('/api/student/academic-profile',handle(async(req,res)=>{res.json({...await profile(db,req.user.id),timetable:(await db.query("SELECT t.* FROM student_timetable t JOIN semesters s ON s.id=t.semester_id WHERE t.student_id=$1 AND s.status='ACTIVE' ORDER BY t.weekday,t.starts_at",[req.user.id])).rows,history:(await db.query(`SELECT p.role,p.active,p.approved_at,p.semester_id,c.course_code FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id JOIN semester_course_assignments c ON c.id=a.assignment_id WHERE p.student_id=$1 ORDER BY p.created_at DESC`,[req.user.id])).rows});}));
 app.get('/api/student/opportunities',handle(async(req,res)=>{
  const semester=(await db.query("SELECT * FROM semesters WHERE status='ACTIVE'")).rows[0]??null;if(!semester)return res.json({semester:null,courses:[],opportunities:[]});
  const courses=(await db.query('SELECT a.*,c.name AS course_name FROM semester_course_assignments a JOIN core_courses c USING(course_code) WHERE semester_id=$1 AND (pa_slots>0 OR ta_slots>0) ORDER BY course_code',[semester.id])).rows;
  const record=await profile(db,req.user.id),own=await applications(db,'a.student_id=$1 AND a.semester_id=$2',[req.user.id,semester.id]);const appointments=(await db.query('SELECT role FROM assistantship_appointments WHERE student_id=$1 AND semester_id=$2 AND active',[req.user.id,semester.id])).rows;
  const open=Date.now()>=new Date(semester.application_start).getTime()&&Date.now()<=new Date(semester.application_end).getTime(),opportunities=[];
  for(const c of courses)for(const role of ['PA','TA']){if(!c[role.toLowerCase()+'_slots'])continue;const rule=await criteria(db,c.id,role),check=eligibility(record,rule),application=own.find(a=>a.assignment_id===c.id&&a.role===role);const blocked=appointments.some(a=>a.role===role);opportunities.push({...c,role,criteria:rule,...check,application_status:application?.status??null,can_apply:open&&check.eligible&&!application&&!blocked,unavailable_reason:application?'You have already applied to this opportunity.':blocked?`You already hold an active ${role} appointment.`:!open?'The application window is closed.':null,amount:semester[role.toLowerCase()+'_amount']});}
  res.json({semester,courses,opportunities,window_open:open,profile:record});
 }));
 app.get('/api/student/applications',handle(async(req,res)=>res.json({applications:(await applications(db,'a.student_id=$1',[req.user.id])).map(({evaluation,...row})=>({...row,can_edit:row.status==='APPLIED'&&row.semester_status==='ACTIVE'&&Date.now()>=new Date(row.application_start)&&Date.now()<=new Date(row.application_end),can_withdraw:pending.includes(row.status)&&row.semester_status==='ACTIVE'}))})));
 app.post('/api/student/applications',handle(async(req,res)=>{
  const {assignment_id,role,requirement_acknowledged}=req.body??{};const statement=textValue(req.body?.statement??'','application statement',2000);if(!['PA','TA'].includes(role))fail(400,'Choose PA or TA.');
  const result=await db.transaction(async tx=>{const initial=await assignment(tx,assignment_id);const semester=await lockSemester(tx,initial.semester_id),course=await assignment(tx,assignment_id);
   if(Date.now()<new Date(semester.application_start)||Date.now()>new Date(semester.application_end))fail(409,'The application window is closed.');if(!course[role.toLowerCase()+'_slots'])fail(409,'No positions are allocated for this role.');
   const record=await profile(tx,req.user.id),rule=await criteria(tx,course.id,role),check=eligibility(record,rule);if(!check.eligible)fail(400,check.reasons.join(' '));
   if(rule.additional_requirement&&requirement_acknowledged!==true)fail(400,'Confirm that you meet the additional requirement. Faculty will verify it during review.');
   if((await tx.query('SELECT id FROM assistantship_appointments WHERE student_id=$1 AND semester_id=$2 AND role=$3 AND active',[req.user.id,semester.id,role])).rows.length)fail(409,`You already hold an active ${role} appointment.`);
   const row=(await tx.query('INSERT INTO applications(id,student_id,assignment_id,semester_id,role,requirement_acknowledged,profile_snapshot,statement) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[randomUUID(),req.user.id,course.id,semester.id,role,requirement_acknowledged===true,JSON.stringify({...record,criteria:rule}),statement])).rows[0];await audit(tx,req.user.id,'APPLICATION_SUBMITTED',{application_id:row.id,semester_id:semester.id,course:course.course_code,role});return row;
  });res.status(201).json({application:result});
 }));
 app.post('/api/student/applications/:id/withdraw',handle(async(req,res)=>{
  await db.transaction(async tx=>{const initial=(await tx.query('SELECT * FROM applications WHERE id=$1 AND student_id=$2',[req.params.id,req.user.id])).rows[0];if(!initial)fail(404,'Application not found.');await lockSemester(tx,initial.semester_id);const a=(await tx.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[initial.id])).rows[0];if(!pending.includes(a.status))fail(409,'Only pending applications can be withdrawn.');await tx.query("UPDATE applications SET status='WITHDRAWN' WHERE id=$1",[a.id]);await audit(tx,req.user.id,'APPLICATION_WITHDRAWN',{application_id:a.id,semester_id:a.semester_id});});res.json({message:'Application withdrawn.'});
 }));
}
export function facultyWorkflow(app,db){
 async function applicant(db,id,email){
  const a=(await db.query('SELECT * FROM applications WHERE id=$1',[id])).rows[0];if(!a)fail(404,'Application not found.');
  await assignment(db,a.assignment_id,email);return a;
 }
 app.get('/api/faculty/applications/:id/profile',handle(async(req,res)=>{
  const a=await applicant(db,req.params.id,req.user.email);
  if(!req.facultyCourses.some(c=>c.id===a.assignment_id))fail(403,'Course is not assigned in the active semester.');
  res.json({timetable:(await db.query('SELECT course_code,course_name,weekday,starts_at,ends_at,room,is_demo FROM student_timetable WHERE student_id=$1 AND semester_id=$2 ORDER BY weekday,starts_at',[a.student_id,a.semester_id])).rows,
   notes:(await db.query('SELECT n.id,n.note,n.created_at,u.name AS author FROM faculty_application_notes n JOIN users u ON u.id=n.author_id WHERE n.application_id=$1 ORDER BY n.created_at DESC',[a.id])).rows});
 }));
 app.post('/api/faculty/applications/:id/notes',handle(async(req,res)=>{
  const note=textValue(req.body?.note??'','note',2000);if(!note)fail(400,'Enter an applicant note.');
  await db.transaction(async tx=>{const a=await applicant(tx,req.params.id,req.user.email);await lockSemester(tx,a.semester_id);await assignment(tx,a.assignment_id,req.user.email);
   await tx.query('INSERT INTO faculty_application_notes(id,application_id,author_id,note) VALUES($1,$2,$3,$4)',[randomUUID(),a.id,req.user.id,note]);
   await audit(tx,req.user.id,'FACULTY_NOTE_ADDED',{application_id:a.id,semester_id:a.semester_id});
  });res.status(201).json({message:'Note saved.'});
 }));
 app.post('/api/faculty/assignments/:id/submit',handle(async(req,res)=>{
  if(req.body?.confirm!==true)fail(400,'Confirm submission to Admin.');
  const rows=await db.transaction(async tx=>{const c=await assignment(tx,req.params.id,req.user.email);await lockSemester(tx,c.semester_id);await assignment(tx,c.id,req.user.email);
   const rows=(await tx.query('UPDATE assistantship_appointments p SET submitted_at=now(),submitted_by=$1 FROM applications a WHERE p.application_id=a.id AND a.assignment_id=$2 AND p.active AND p.submitted_at IS NULL RETURNING p.id',[req.user.id,c.id])).rows;
   if(!rows.length)fail(409,'No new accepted appointments to submit.');
   await audit(tx,req.user.id,'FACULTY_SELECTIONS_SUBMITTED',{semester_id:c.semester_id,assignment_id:c.id,appointment_ids:rows.map(r=>r.id)});return rows;
  });res.json({submitted:rows.length});
 }));
 app.get('/api/faculty/assignments/:id/workflow',handle(async(req,res)=>{const c=await assignment(db,req.params.id,req.user.email);if(!req.facultyCourses.some(a=>a.id===c.id))fail(403,'Course is not assigned in the active semester.');res.json({appointments:(await db.query('SELECT p.application_id,p.submitted_at FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id WHERE a.assignment_id=$1 AND p.active',[c.id])).rows,criteria:(await db.query('SELECT * FROM eligibility_criteria WHERE assignment_id=$1 ORDER BY role',[c.id])).rows,applications:await applications(db,'a.assignment_id=$1',[c.id])});}));
 app.put('/api/faculty/assignments/:id/criteria/:role',handle(async(req,res)=>{
  const b=req.body??{};if(Object.keys(b).some(k=>!['additional_requirement','minimum_grade','interview_required'].includes(k)))fail(403,'Faculty may edit minimum grade, interview requirement and additional requirement only.');
  const additional=textValue(b.additional_requirement??'','additional requirement',1000);
  await db.transaction(async tx=>{const c=await assignment(tx,req.params.id,req.user.email);await lockSemester(tx,c.semester_id);await assignment(tx,c.id,req.user.email);
   const before=await criteria(tx,c.id,req.params.role);if(!before)fail(409,'Admin must publish eligibility rules first.');
   const grade=b.minimum_grade===undefined?before.minimum_grade:b.minimum_grade||null,interview=b.interview_required===undefined?before.interview_required:b.interview_required;
   if(grade&&(!before.required_course||!grades.includes(grade)))fail(400,'A valid minimum grade requires an Admin-assigned course.');if(typeof interview!=='boolean')fail(400,'Choose Yes or No for the interview requirement.');
   await tx.query('UPDATE eligibility_criteria SET additional_requirement=$1,minimum_grade=$2,interview_required=$3 WHERE id=$4',[b.additional_requirement===undefined?before.additional_requirement:additional||null,grade,interview,before.id]);
   await audit(tx,req.user.id,'FACULTY_REQUIREMENTS_UPDATED',{semester_id:c.semester_id,assignment_id:c.id,role:req.params.role,before,after:b});
  });res.json({message:'Requirements saved for new applications. Existing applications keep their submitted requirements.'});
 }));
 app.get('/api/admin/assignments/:id/criteria',handle(async(req,res)=>{await assignment(db,req.params.id);res.json({criteria:(await db.query('SELECT * FROM eligibility_criteria WHERE assignment_id=$1 ORDER BY role',[req.params.id])).rows,applications:(await db.query('SELECT role FROM applications WHERE assignment_id=$1',[req.params.id])).rows});}));
 app.put('/api/admin/assignments/:id/criteria/:role',handle(async(req,res)=>{
  const b=req.body??{},role=req.params.role;if(!['PA','TA'].includes(role))fail(400,'Choose PA or TA.');
  if(!Number.isInteger(b.minimum_year)||b.minimum_year<2||b.minimum_year>6||typeof b.minimum_cgpa!=='number'||!Number.isFinite(b.minimum_cgpa)||b.minimum_cgpa<0||b.minimum_cgpa>10||Math.abs(b.minimum_cgpa*100-Math.round(b.minimum_cgpa*100))>1e-7)fail(400,'Use a minimum year from 2 to 6 and CGPA from 0 to 10 (two decimals).');
  const required=normalizeCode(textValue(b.required_course??'','required course',30)),grade=b.minimum_grade||null,additional=textValue(b.additional_requirement??'','additional requirement',1000);
  if(grade&&(!required||!grades.includes(grade)))fail(400,'A valid minimum grade requires a course code.');if(typeof b.interview_required!=='boolean')fail(400,'Choose whether an interview is required.');
  await db.transaction(async tx=>{const initial=await assignment(tx,req.params.id);await lockSemester(tx,initial.semester_id,{allowDraft:true});await assignment(tx,initial.id);
   if((await tx.query('SELECT id FROM applications WHERE assignment_id=$1 AND role=$2 LIMIT 1',[initial.id,role])).rows.length)fail(409,'Admin requirements are locked once this role receives an application. Existing applications preserve their submitted rules.');
   const before=await criteria(tx,initial.id,role);
   await tx.query(`INSERT INTO eligibility_criteria(id,assignment_id,role,minimum_year,minimum_cgpa,required_course,minimum_grade,additional_requirement,interview_required) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(assignment_id,role) DO UPDATE SET minimum_year=$4,minimum_cgpa=$5,required_course=$6,minimum_grade=$7,additional_requirement=$8,interview_required=$9`,[randomUUID(),initial.id,role,b.minimum_year,b.minimum_cgpa,required||null,grade,additional||null,b.interview_required]);await audit(tx,req.user.id,'ELIGIBILITY_UPDATED',{semester_id:initial.semester_id,assignment_id:initial.id,role,before,after:b});
  });res.json({message:'Requirements published.'});
 }));
 app.post('/api/faculty/applications/:id/action',handle(async(req,res)=>{
  const b=req.body??{},action=b.action;const allowed=['REVIEW','SHORTLIST','INTERVIEW','EVALUATE','SELECT','ACCEPT','REJECT'];if(!allowed.includes(action))fail(400,'Unknown application action.');
  const result=await db.transaction(async tx=>{
   const initial=(await tx.query('SELECT * FROM applications WHERE id=$1',[req.params.id])).rows[0];if(!initial)fail(404,'Application not found.');await lockSemester(tx,initial.semester_id);const course=await assignment(tx,initial.assignment_id,req.user.email);const a=(await tx.query('SELECT * FROM applications WHERE id=$1 FOR UPDATE',[initial.id])).rows[0];if(!pending.includes(a.status))fail(409,'This application is no longer pending. Refresh the applicant list.');
   const rule=a.profile_snapshot?.criteria||await criteria(tx,course.id,a.role);let status=a.status;
   const transitions={REVIEW:['APPLIED'],SHORTLIST:['APPLIED','UNDER_REVIEW'],INTERVIEW:['SHORTLISTED','INTERVIEW'],EVALUATE:['INTERVIEW'],SELECT:rule?.interview_required?['INTERVIEW']:['SHORTLISTED'],ACCEPT:['SELECTED_PENDING'],REJECT:pending};
   if(!transitions[action].includes(a.status))fail(409,'This action is not valid for the current application status.');
   if(action==='REVIEW')status='UNDER_REVIEW';if(action==='SHORTLIST')status='SHORTLISTED';if(action==='REJECT')status='NOT_SELECTED';
   if(action==='INTERVIEW'){
    if(!rule?.interview_required)fail(409,'Interviews are not required for this role.');if(typeof b.scheduled_at!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(b.scheduled_at)||!Number.isFinite(Date.parse(b.scheduled_at))||Date.parse(b.scheduled_at)<=Date.now())fail(400,'Choose a future interview time including its timezone.');const location=textValue(b.location??'','interview location',250);if(!location)fail(400,'Enter the interview location or meeting link.');
    await tx.query('INSERT INTO interviews(id,application_id,scheduled_at,location) VALUES($1,$2,$3,$4) ON CONFLICT(application_id) DO UPDATE SET scheduled_at=$3,location=$4,evaluation=NULL',[randomUUID(),a.id,b.scheduled_at,location]);status='INTERVIEW';
   }
   if(action==='EVALUATE'){const evaluation=textValue(b.evaluation??'','evaluation',2000);if(!evaluation)fail(400,'Record an interview evaluation.');await tx.query('UPDATE interviews SET evaluation=$1 WHERE application_id=$2',[evaluation,a.id]);}
   // All capacity mutations hold the same semester lock, including Admin allocation edits.
   if(action==='SELECT'||action==='ACCEPT'){
    const reserved=Number((await tx.query("SELECT count(*) AS total FROM applications a WHERE a.assignment_id=$1 AND a.role=$2 AND a.id<>$3 AND (a.status='SELECTED_PENDING' OR EXISTS(SELECT 1 FROM assistantship_appointments p WHERE p.application_id=a.id AND p.active))",[course.id,a.role,a.id])).rows[0].total);
    if(reserved>=course[a.role.toLowerCase()+'_slots'])fail(409,`Allocation exceeded. Pending selections and active appointments already use all ${course[a.role.toLowerCase()+'_slots']} ${a.role} positions for ${course.course_code}.`);
   }
   if(action==='SELECT'){if(rule?.interview_required){const i=(await tx.query('SELECT evaluation FROM interviews WHERE application_id=$1',[a.id])).rows[0];if(!i?.evaluation)fail(409,'Record the required interview evaluation before selection.');}status='SELECTED_PENDING';}
   if(action==='ACCEPT'){
    if((await tx.query('SELECT id FROM assistantship_appointments WHERE student_id=$1 AND semester_id=$2 AND role=$3 AND active',[a.student_id,a.semester_id,a.role])).rows.length)fail(409,`Conflict: this student already holds an active ${a.role} position.`);
    await tx.query('INSERT INTO assistantship_appointments(id,application_id,student_id,semester_id,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),a.id,a.student_id,a.semester_id,a.role]);status='ACCEPTED';
    const cancelled=(await tx.query("UPDATE applications SET status='AUTO_CANCELLED' WHERE student_id=$1 AND semester_id=$2 AND role=$3 AND id<>$4 AND status IN ('APPLIED','UNDER_REVIEW','SHORTLISTED','INTERVIEW','SELECTED_PENDING') RETURNING id",[a.student_id,a.semester_id,a.role,a.id])).rows;
    await audit(tx,req.user.id,'APPOINTMENT_CREATED',{application_id:a.id,semester_id:a.semester_id,role:a.role});for(const c of cancelled)await audit(tx,req.user.id,'APPLICATION_AUTO_CANCELLED',{application_id:c.id,accepted_application_id:a.id,semester_id:a.semester_id,role:a.role});
   }
   await tx.query('UPDATE applications SET status=$1 WHERE id=$2',[status,a.id]);await audit(tx,req.user.id,`FACULTY_${action}`,{application_id:a.id,semester_id:a.semester_id,before:a.status,after:status,...(action==='INTERVIEW'?{scheduled_at:b.scheduled_at,location:b.location}:{}),...(action==='EVALUATE'?{evaluation:b.evaluation}:{})});return status;
  });res.json({status:result});
 }));
}
