import XLSX from 'xlsx';
import {fail,handle,audit,textValue,lockSemester,applications} from './workflow-common.js';
// A small, paginated text PDF writer keeps exports available without external services.
export function makePdf(lines){
 const safe=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?').replace(/([\\()])/g,'\\$1');
 const wrapped=lines.flatMap(line=>{const words=String(line).split(/\s+/),out=[];let row='';for(const word of words){if((row+' '+word).length>105){out.push(row);row='';}row+=(row?' ':'')+word;}out.push(row);return out;});
 const pages=[];for(let i=0;i<wrapped.length;i+=48)pages.push(wrapped.slice(i,i+48));if(!pages.length)pages.push(['No approved appointments.']);
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const kids=[];
 pages.forEach((lines,index)=>{const page=objects.length+1,content=page+1;kids.push(`${page} 0 R`);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`);const stream=`BT /F1 10 Tf 36 560 Td 11 TL ${lines.map((l,i)=>`${i?'T* ':''}(${safe(l)}) Tj`).join('\n')} T* (Page ${index+1} of ${pages.length}) Tj ET`;objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);});
 objects[1]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;let doc='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(doc));doc+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=Buffer.byteLength(doc);doc+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(doc);
}
export async function monitor(db,id){
 const semester=(await db.query('SELECT * FROM semesters WHERE id=$1',[id])).rows[0];if(!semester)fail(404,'Semester not found.');
 const courses=(await db.query(`SELECT c.*,cc.name AS course_name,
 (SELECT count(*)::int FROM applications a WHERE a.assignment_id=c.id AND a.role='PA') AS pa_apps,
 (SELECT count(*)::int FROM applications a WHERE a.assignment_id=c.id AND a.role='TA') AS ta_apps,
 (SELECT count(*)::int FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id WHERE a.assignment_id=c.id AND p.role='PA' AND p.active) AS pa_filled,
 (SELECT count(*)::int FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id WHERE a.assignment_id=c.id AND p.role='TA' AND p.active) AS ta_filled
 FROM semester_course_assignments c JOIN core_courses cc USING(course_code) WHERE c.semester_id=$1 ORDER BY c.course_code`,[id])).rows.map(c=>({...c,pa_vacancy:c.pa_slots-c.pa_filled,ta_vacancy:c.ta_slots-c.ta_filled}));
 const appointments=(await db.query(`SELECT p.*,u.name,s.student_id AS university_id,c.course_code FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id JOIN users u ON u.id=p.student_id JOIN students s ON s.user_id=p.student_id JOIN semester_course_assignments c ON c.id=a.assignment_id WHERE p.semester_id=$1 AND p.active ORDER BY c.course_code,p.role,u.name`,[id])).rows;
 const conflicts=[];for(const c of courses)if(c.pa_vacancy<0||c.ta_vacancy<0)conflicts.push(`Allocation exceeded for ${c.course_code}.`);const seen=new Set();for(const p of appointments){const key=p.student_id+p.role;if(seen.has(key))conflicts.push(`Multiple active ${p.role} appointments for ${p.university_id}.`);seen.add(key);}
 const totals=courses.reduce((a,c)=>{for(const key of ['pa_slots','ta_slots','pa_apps','ta_apps','pa_filled','ta_filled','pa_vacancy','ta_vacancy'])a[key]=(a[key]||0)+c[key];return a;},{pa_slots:0,ta_slots:0,pa_apps:0,ta_apps:0,pa_filled:0,ta_filled:0,pa_vacancy:0,ta_vacancy:0});
 return {semester,courses,appointments,conflicts,totals};
}
export function adminWorkflow(app,db){
 app.get('/api/admin/semesters/:id/monitor',handle(async(req,res)=>res.json({...await monitor(db,req.params.id),applications:await applications(db,'a.semester_id=$1',[req.params.id])})));
 app.get('/api/admin/audit',handle(async(req,res)=>{
  const limit=50,offset=Number(req.query.offset||0);if(!Number.isInteger(offset)||offset<0)fail(400,'Invalid page.');const semester=String(req.query.semester||'');
  const result=await db.query(`SELECT l.*,u.name AS actor FROM audit_logs l LEFT JOIN users u ON u.id=l.user_id WHERE ($1='' OR l.details->>'semester_id'=$1 OR l.details->'after'->>'id'=$1 OR l.details->'before'->'semester'->>'id'=$1) ORDER BY l.created_at DESC,l.id DESC LIMIT $2 OFFSET $3`,[semester,limit+1,offset]);res.json({logs:result.rows.slice(0,limit),has_more:result.rows.length>limit});
 }));
 app.post('/api/admin/appointments/:id/cancel',handle(async(req,res)=>{
  const reason=textValue(req.body?.reason??'','cancellation reason',500);if(reason.length<5)fail(400,'Provide a cancellation reason of at least five characters.');
  await db.transaction(async tx=>{const initial=(await tx.query('SELECT * FROM assistantship_appointments WHERE id=$1',[req.params.id])).rows[0];if(!initial)fail(404,'Appointment not found.');await lockSemester(tx,initial.semester_id);const row=(await tx.query('SELECT * FROM assistantship_appointments WHERE id=$1 FOR UPDATE',[initial.id])).rows[0];if(!row.active)fail(409,'Appointment already cancelled.');await tx.query('UPDATE assistantship_appointments SET active=FALSE WHERE id=$1',[row.id]);await tx.query("UPDATE applications SET status='WITHDRAWN' WHERE id=$1",[row.application_id]);await audit(tx,req.user.id,'APPOINTMENT_CANCELLED',{appointment_id:row.id,semester_id:row.semester_id,reason});});res.json({message:'Appointment cancelled. Vacancies updated; previously auto-cancelled applications remain unchanged.'});
 }));
 app.post('/api/admin/semesters/:id/finalize',handle(async(req,res)=>{
  if(req.body?.confirm!==true)fail(400,'Confirm that you have reviewed selections and remaining vacancies.');
  await db.transaction(async tx=>{const semester=await lockSemester(tx,req.params.id),summary=await monitor(tx,semester.id);if(summary.conflicts.length)fail(409,summary.conflicts.join(' '));if(summary.appointments.some(p=>!p.submitted_at))fail(409,'Faculty must submit all active appointments before final approval.');
   const rows=(await tx.query(`SELECT s.user_id AS student_user_id,s.student_id,u.name AS student_name,p.role,c.course_code,cc.name AS course_name,c.faculty_name,c.faculty_email,CASE WHEN p.role='PA' THEN se.pa_amount ELSE se.ta_amount END AS amount,se.id AS semester_id,se.academic_year,se.term FROM assistantship_appointments p JOIN applications a ON a.id=p.application_id JOIN students s ON s.user_id=p.student_id JOIN users u ON u.id=p.student_id JOIN semester_course_assignments c ON c.id=a.assignment_id JOIN core_courses cc USING(course_code) JOIN semesters se ON se.id=p.semester_id WHERE p.semester_id=$1 AND p.active ORDER BY c.course_code,p.role,s.student_id`,[semester.id])).rows;
   await tx.query('UPDATE assistantship_appointments SET approved_at=now() WHERE semester_id=$1 AND active',[semester.id]);
   const closed=(await tx.query("UPDATE applications SET status='NOT_SELECTED' WHERE semester_id=$1 AND status IN ('APPLIED','UNDER_REVIEW','SHORTLISTED','INTERVIEW','SELECTED_PENDING') RETURNING id",[semester.id])).rows;
   await tx.query('INSERT INTO final_results(semester_id,approved_by,rows,summary) VALUES($1,$2,$3,$4)',[semester.id,req.user.id,JSON.stringify(rows),JSON.stringify(summary.totals)]);await tx.query("UPDATE semesters SET status='FINALIZED' WHERE id=$1",[semester.id]);await audit(tx,req.user.id,'SEMESTER_FINALIZED',{semester_id:semester.id,approved:rows.length,closed_applications:closed.map(a=>a.id),vacancies:summary.totals.pa_vacancy+summary.totals.ta_vacancy});
  });res.json({message:'Results approved and locked. The final list is ready.'});
 }));
 app.get('/api/admin/semesters/:id/results',handle(async(req,res)=>{
  const result=(await db.query('SELECT * FROM final_results WHERE semester_id=$1',[req.params.id])).rows[0];if(!result)fail(409,'Finalize semester results before generating the approved list.');
  const format=req.query.format;if(!format)return res.json(result);
  const rows=result.rows.map(r=>({'Student ID':r.student_id,'Student Name':r.student_name,'Role':r.role,'Course Code':r.course_code,'Course Name':r.course_name,'Faculty':r.faculty_name,'Amount (AED)':Number(r.amount),'Semester':`${r.term} ${r.academic_year}`}));
  const filename=`PA-TA-${req.params.id.replace(/[^A-Za-z0-9_-]/g,'')}`;
  if(format==='xlsx'){const sheet=XLSX.utils.json_to_sheet(rows,{header:['Student ID','Student Name','Role','Course Code','Course Name','Faculty','Amount (AED)','Semester']});sheet['!cols']=[16,28,8,15,35,28,18,24].map(wch=>({wch}));const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Approved appointments');res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${filename}.xlsx`).send(XLSX.write(book,{type:'buffer',bookType:'xlsx'}));}
  else if(format==='pdf'){const lines=[`BITS Pilani Dubai Campus - Approved PA/TA List`,req.params.id,`Approved: ${new Date(result.approved_at).toISOString()} | Appointments: ${rows.length}`,''];for(const r of rows){lines.push(`${r['Student ID']} | ${r['Student Name']} | ${r.Role} | ${r['Course Code']} | AED ${r['Amount (AED)']}`,`${r['Course Name']} | Faculty: ${r.Faculty} | ${r.Semester}`,'');}res.type('application/pdf').attachment(`${filename}.pdf`).send(makePdf(lines));}
  else fail(400,'Choose xlsx or pdf.');
 }));
}
