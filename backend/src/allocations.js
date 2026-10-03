import {randomUUID} from 'node:crypto';
import {dates} from './semesters.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){if(e.status)res.status(e.status).json({error:e.message});else next(e);}};
const courses=async(db,id)=>(await db.query(`SELECT a.*,c.name AS course_name FROM semester_course_assignments a JOIN core_courses c USING(course_code) WHERE semester_id=$1 ORDER BY course_code`,[id])).rows;
export function allocationRoutes(app,db){
 app.get('/api/admin/semesters/:id/allocations',handle(async(req,res)=>{
  const semester=(await db.query('SELECT * FROM semesters WHERE id=$1',[req.params.id])).rows[0];
  if(!semester)fail(404,'Semester not found.');res.json({semester,courses:await courses(db,semester.id)});
 }));
 app.put('/api/admin/semesters/:id/allocations',handle(async(req,res)=>{
  const body=req.body??{},[start,end]=dates(body);
  for(const key of ['pa_amount','ta_amount'])if(!['string','number'].includes(typeof body[key])||!/^\d{1,8}(\.\d{1,2})?$/.test(String(body[key])))fail(400,'Enter non-negative AED amounts with at most two decimal places (maximum 99,999,999.99).');
  if(!Array.isArray(body.courses)||body.courses.length>1000)fail(400,'Provide the course allocations.');
  const ids=new Set();for(const c of body.courses){if(!c||typeof c.id!=='string'||ids.has(c.id)||!['pa_slots','ta_slots'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=10000))fail(400,'Each course needs unique, whole-number PA and TA slots between 0 and 10,000.');ids.add(c.id);}
  const saved=await db.transaction(async tx=>{
   const semester=(await tx.query('SELECT * FROM semesters WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
   if(!semester)fail(404,'Semester not found.');if(!['DRAFT','ACTIVE'].includes(semester.status))fail(409,'Archived or finalized semesters cannot be edited.');
   const before=await courses(tx,semester.id);
   if(before.length!==ids.size||before.some(c=>!ids.has(c.id)))fail(409,'The course list has changed or contains a course from another semester. Reload before saving.');
   for(const c of body.courses){
    const filled=(await tx.query(`SELECT a.role,count(*)::int AS total FROM applications a WHERE a.assignment_id=$1 AND (a.status='SELECTED_PENDING' OR EXISTS(SELECT 1 FROM assistantship_appointments p WHERE p.application_id=a.id AND p.active)) GROUP BY a.role`,[c.id])).rows;
    if(filled.some(r=>r.total>c[r.role==='PA'?'pa_slots':'ta_slots']))fail(409,'Slots cannot be lower than the number of pending selections plus active appointments.');
    await tx.query('UPDATE semester_course_assignments SET pa_slots=$1,ta_slots=$2 WHERE id=$3',[c.pa_slots,c.ta_slots,c.id]);
   }
   await tx.query('UPDATE semesters SET pa_amount=$1,ta_amount=$2,application_start=$3,application_end=$4 WHERE id=$5',[body.pa_amount,body.ta_amount,start,end,semester.id]);
   await tx.query('INSERT INTO audit_logs(id,user_id,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),req.user.id,'ALLOCATIONS_UPDATED',JSON.stringify({before:{semester,courses:before},after:body})]);
   return {semester:(await tx.query('SELECT * FROM semesters WHERE id=$1',[semester.id])).rows[0],courses:await courses(tx,semester.id)};
  });res.json({message:'PA/TA settings saved.',...saved});
 }));
}
