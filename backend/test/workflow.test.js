import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import XLSX from 'xlsx';
import {openDatabase} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createApp} from '../src/app.js';
import {eligibility} from '../src/workflow-common.js';
import {makePdf} from '../src/admin-workflow.js';
const origin='http://127.0.0.1:5173';let db,app,admin,faculty=[],students=[],ids=[],courseIds=[];
const api=(method,path,body,cookie=admin)=>request(app)[method]('/api'+path).set('Cookie',cookie).set('Origin',origin).send(body);
const rule={minimum_year:2,minimum_cgpa:7,required_course:'CS F301',minimum_grade:'A-',interview_required:false,additional_requirement:''};
const submit=(i,c,role='PA',extra={})=>api('post','/student/applications',{assignment_id:courseIds[c],role,...extra},students[i]);
const act=(id,action,fac=0,extra={})=>api('post',`/faculty/applications/${id}/action`,{action,...extra},faculty[fac]);
const find=async(i,c,role='PA')=>(await db.query('SELECT * FROM applications WHERE student_id=$1 AND assignment_id=$2 AND role=$3',[ids[i],courseIds[c],role])).rows[0];
const prepare=async(i,c,role='PA',fac=0)=>{await submit(i,c,role).expect(201);const a=await find(i,c,role);await act(a.id,'SHORTLIST',fac).expect(200);await act(a.id,'SELECT',fac).expect(200);return a.id;};
before(async()=>{
 db=await openDatabase({memory:true});await migrate(db);app=createApp(db,{secret:'workflow-tests-long-secret-over-thirty-two-characters',origin});
 await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end,status,pa_amount,ta_amount) VALUES('FALL_2026_27','2026-2027','FALL',now()-interval '1 day',now()+interval '30 days','ACTIVE',1200,1500)");
 const hash=await bcrypt.hash('Workflow-test-password',4);
 async function user(email,role,name){const id=randomUUID();await db.query('INSERT INTO users(id,email,role,name,password_hash) VALUES($1,$2,$3,$4,$5)',[id,email,role,name,hash]);return id;}
 async function login(email,role){return (await api('post','/auth/login',{email,role,password:'Workflow-test-password'},[]).expect(200)).headers['set-cookie'];}
 await user('admin@example.com','ADMIN','Admin');admin=await login('admin@example.com','ADMIN');
 for(let c=0;c<4;c++){const id=randomUUID();courseIds.push(id);await db.query('INSERT INTO core_courses VALUES($1,$2)',[`CS F30${c+1}`,`Course ${c+1}`]);await db.query("INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots,ta_slots) VALUES($1,'FALL_2026_27',$2,$3,$4,2,2)",[id,`CS F30${c+1}`,`Faculty ${c}`,`head${c}@dubai.bits-pilani.ac.in`]);}
 for(let f=0;f<4;f++){const email=`head${f}@dubai.bits-pilani.ac.in`;await user(email,'FACULTY',`Faculty ${f}`);faculty.push(await login(email,'FACULTY'));}
 for(let i=0;i<15;i++){const email=`f2024${String(i).padStart(4,'0')}@dubai.bits-pilani.ac.in`,id=await user(email,'STUDENT',`Student ${i}`);ids.push(id);await db.query('INSERT INTO students VALUES($1,$2,$3,$4,$5)',[id,`2024${String(i).padStart(4,'0')}`,'Computer Science',i===1?1:3,i===2?6:8.5]);await db.query('INSERT INTO student_courses VALUES($1,$2,$3,$4)',[randomUUID(),id,'CS F301',i===3?'B':'A']);students.push(await login(email,'STUDENT'));}
});
after(async()=>db.close());
test('Admin can configure eligibility for an unpublished draft semester',async()=>{
 const id=randomUUID();
 await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end) VALUES('SPRING_2026_27','2026-2027','SPRING',now(),now()+interval '30 days')");
 await db.query("INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots) VALUES($1,'SPRING_2026_27','CS F301','Faculty 0','head0@dubai.bits-pilani.ac.in',1)",[id]);
 await api('put',`/admin/assignments/${id}/criteria/PA`,rule).expect(200);
 const opportunities=(await api('get','/student/opportunities',undefined,students[0]).expect(200)).body;
 assert.ok(opportunities.opportunities.every(o=>o.semester_id==='FALL_2026_27'));
});
test('faculty owns criteria; validates global constraints and publishes per role',async()=>{
 await api('put',`/admin/assignments/${courseIds[0]}/criteria/PA`,rule,students[0]).expect(403);
 await api('put',`/admin/assignments/${courseIds[1]}/criteria/PA`,rule,faculty[0]).expect(403);
 for(const patch of [{minimum_year:1},{minimum_cgpa:10.1},{minimum_grade:'Z'},{interview_required:'yes'}])await api('put',`/admin/assignments/${courseIds[0]}/criteria/PA`,{...rule,...patch},admin).expect(400);
 for(let c=0;c<4;c++)for(const role of ['PA','TA'])await api('put',`/admin/assignments/${courseIds[c]}/criteria/${role}`,rule,admin).expect(200);
});
test('faculty can edit grade, interview and additional requirements while preserving application snapshots',async()=>{
 const path=`/faculty/assignments/${courseIds[0]}/criteria/PA`;
 await api('put',path,{minimum_cgpa:0,additional_requirement:'Changed'},faculty[0]).expect(403);
 await api('put',path,{additional_requirement:'Changed'},faculty[1]).expect(403);
 await api('put',path,{additional_requirement:'Changed'},students[0]).expect(403);
 await submit(14,0).expect(201);const before=await find(14,0);
 await api('put',path,{minimum_grade:'Z'},faculty[0]).expect(400);
 await api('put',path,{interview_required:'yes'},faculty[0]).expect(400);
 await api('put',path,{additional_requirement:'New lab experience requirement',minimum_grade:'B',interview_required:true},faculty[0]).expect(200);
 const changed=(await db.query('SELECT * FROM eligibility_criteria WHERE assignment_id=$1 AND role=$2',[courseIds[0],'PA'])).rows[0];assert.equal(changed.minimum_grade,'B');assert.equal(changed.interview_required,true);
 await act(before.id,'SHORTLIST').expect(200);await act(before.id,'SELECT').expect(200);
 assert.deepEqual((await find(14,0)).profile_snapshot,before.profile_snapshot);
 assert.equal(Number((await db.query('SELECT minimum_cgpa FROM eligibility_criteria WHERE assignment_id=$1 AND role=$2',[courseIds[0],'PA'])).rows[0].minimum_cgpa),7);
 await api('put',path,{additional_requirement:'',minimum_grade:'A-',interview_required:false},faculty[0]).expect(200);
 await api('post',`/student/applications/${before.id}/withdraw`,{},students[14]).expect(200);
});
test('student sees own profile; eligibility explains year, CGPA, grade and missing course failures',async()=>{
 for(const i of [0,1])await db.query("INSERT INTO student_timetable(id,student_id,semester_id,course_code,course_name,weekday,starts_at,ends_at,room,is_demo) VALUES($1,$2,'FALL_2026_27','CS F351','Demo class',1,'09:00','10:00',$3,TRUE)",[randomUUID(),ids[i],i===0?'My room':'Other room']);
 const schedule=(await api('get','/student/academic-profile?student_id='+ids[1],undefined,students[0]).expect(200)).body.timetable;assert.equal(schedule.length,1);assert.equal(schedule[0].room,'My room');
 const p=(await api('get','/student/academic-profile',undefined,students[0]).expect(200)).body;assert.equal(p.student.user_id,ids[0]);assert.equal(p.courses[0].grade,'A');
 for(const [i,reason] of [[1,/year 2/],[2,/CGPA/],[3,/grade/]]){const r=(await api('get','/student/opportunities',undefined,students[i]).expect(200)).body;assert.equal(r.opportunities[0].eligible,false);assert.ok(r.opportunities[0].reasons.some(s=>reason.test(s)));await submit(i,0).expect(400);}
 assert.equal(eligibility({student:{current_year:3,cgpa:9},courses:[]},rule).eligible,false);
 assert.equal(eligibility({student:{current_year:3,cgpa:9},courses:[{course_code:'CS F301',grade:'F'}]},rule).eligible,false);
});
test('one student can submit three PA and four TA applications; duplicates and edits are blocked',async()=>{
 for(let c=0;c<3;c++)await submit(0,c).expect(201);for(let c=0;c<4;c++)await submit(0,c,'TA').expect(201);
 const r=(await api('get','/student/applications',undefined,students[0]).expect(200)).body;assert.equal(r.applications.length,7);await submit(0,0).expect(409);await api('put',`/admin/assignments/${courseIds[0]}/criteria/PA`,rule,admin).expect(409);
 await api('get',`/faculty/assignments/${courseIds[0]}/workflow`,undefined,faculty[1]).expect(403);await act((await find(0,0)).id,'SHORTLIST',1).expect(403);
});
test('application window, unpublished criteria, zero slots and declarations are enforced',async()=>{
 await db.query("UPDATE semesters SET application_end=now()-interval '1 second'");await submit(4,0).expect(409);await db.query("UPDATE semesters SET application_end=now()+interval '30 days'");
 await db.query("DELETE FROM eligibility_criteria WHERE assignment_id=$1 AND role='PA'",[courseIds[3]]);await submit(4,3).expect(400);
 await api('put',`/admin/assignments/${courseIds[3]}/criteria/PA`,{...rule,additional_requirement:'Comfortable with lab support'},admin).expect(200);await submit(4,3).expect(400);await submit(4,3,'PA',{requirement_acknowledged:true}).expect(201);
 await db.query('UPDATE semester_course_assignments SET ta_slots=0 WHERE id=$1',[courseIds[3]]);await submit(5,3,'TA').expect(409);await db.query('UPDATE semester_course_assignments SET ta_slots=2 WHERE id=$1',[courseIds[3]]);
});
test('optional interview workflow requires scheduling and evaluation before selection',async()=>{
 // Use a role with no application yet in a new course.
 const c=randomUUID();await db.query("INSERT INTO core_courses VALUES('CS F399','Interview course')");await db.query("INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots) VALUES($1,'FALL_2026_27','CS F399','Faculty 4','head4@dubai.bits-pilani.ac.in',1)",[c]);
 await api('put',`/admin/assignments/${c}/criteria/PA`,{...rule,interview_required:true},admin).expect(200);
 const uid=randomUUID();await db.query('INSERT INTO users(id,email,role,name,password_hash) VALUES($1,$2,$3,$4,$5)',[uid,'head4@dubai.bits-pilani.ac.in','FACULTY','Faculty 4',await bcrypt.hash('Workflow-test-password',4)]);faculty[4]=(await request(createApp(db,{secret:'workflow-tests-long-secret-over-thirty-two-characters',origin})).post('/api/auth/login').set('Origin',origin).send({email:'head4@dubai.bits-pilani.ac.in',role:'FACULTY',password:'Workflow-test-password'}).expect(200)).headers['set-cookie'];
 const a=(await api('post','/student/applications',{assignment_id:c,role:'PA'},students[5]).expect(201)).body.application;
 await act(a.id,'ACCEPT',4).expect(409);await act(a.id,'SHORTLIST',4).expect(200);await act(a.id,'SELECT',4).expect(409);
 await act(a.id,'INTERVIEW',4,{scheduled_at:'invalid',location:'Lab'}).expect(400);
 await act(a.id,'INTERVIEW',4,{scheduled_at:new Date(Date.now()+86400000).toISOString(),location:'Lab 2'}).expect(200);await act(a.id,'SELECT',4).expect(409);await act(a.id,'EVALUATE',4,{evaluation:'Demonstrated required knowledge in the demo interview.'}).expect(200);await act(a.id,'SELECT',4).expect(200);await act(a.id,'ACCEPT',4).expect(200);
 const own=(await api('get','/student/applications',undefined,students[5])).body.applications;assert.equal(own[0].location,'Lab 2');
});
test('acceptance auto-cancels only same-role applications and permits PA plus TA',async()=>{
 const pa=await find(0,0);await act(pa.id,'REVIEW').expect(200);await act(pa.id,'SHORTLIST').expect(200);await act(pa.id,'SELECT').expect(200);await act(pa.id,'ACCEPT').expect(200);
 assert.equal((await find(0,1)).status,'AUTO_CANCELLED');assert.equal((await find(0,2)).status,'AUTO_CANCELLED');assert.equal((await find(0,0,'TA')).status,'APPLIED');
 const ta=await find(0,1,'TA');await act(ta.id,'SHORTLIST',1).expect(200);await act(ta.id,'SELECT',1).expect(200);await act(ta.id,'ACCEPT',1).expect(200);assert.equal((await find(0,0,'TA')).status,'AUTO_CANCELLED');assert.equal((await find(0,0)).status,'ACCEPTED');
 assert.equal((await db.query('SELECT * FROM assistantship_appointments WHERE student_id=$1 AND active',[ids[0]])).rows.length,2);await submit(0,3,'PA',{requirement_acknowledged:true}).expect(409);
});
test('concurrent same-role selections produce exactly one appointment for both PA and TA',async()=>{
 for(const [i,role] of [[6,'PA'],[7,'TA']]){const a=await prepare(i,0,role),b=await prepare(i,1,role,1);const results=await Promise.all([act(a,'ACCEPT'),act(b,'ACCEPT',1)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await db.query('SELECT * FROM assistantship_appointments WHERE student_id=$1 AND role=$2 AND active',[ids[i],role])).rows.length,1);}
});
test('concurrent capacity selection cannot overflow allocation; cancellation releases vacancy',async()=>{
 await db.query('UPDATE semester_course_assignments SET pa_slots=1 WHERE id=$1',[courseIds[2]]);
 await submit(8,2).expect(201);await submit(9,2).expect(201);const a=(await find(8,2)).id,b=(await find(9,2)).id;await act(a,'SHORTLIST',2).expect(200);await act(b,'SHORTLIST',2).expect(200);
 const results=await Promise.all([act(a,'SELECT',2),act(b,'SELECT',2)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results[0].status===200?a:b,loser=winner===a?b:a;
 const config=(await api('get','/admin/semesters/FALL_2026_27/allocations')).body;
 await api('put','/admin/semesters/FALL_2026_27/allocations',{pa_amount:1200,ta_amount:1500,application_start:'2026-01-01',application_end:'2026-12-31',courses:config.courses.map(c=>({id:c.id,pa_slots:c.id===courseIds[2]?0:c.pa_slots,ta_slots:c.ta_slots}))}).expect(409);
 await act(winner,'ACCEPT',2).expect(200);await act(loser,'SELECT',2).expect(409);
 const report=(await api('get','/admin/semesters/FALL_2026_27/monitor').expect(200)).body;assert.equal(report.courses.find(c=>c.id===courseIds[2]).pa_vacancy,0);assert.deepEqual(report.conflicts,[]);
 const appointment=report.appointments.find(p=>p.course_code==='CS F303');await api('post',`/admin/appointments/${appointment.id}/cancel`,{reason:'Demo cancellation'},faculty[2]).expect(403);await api('post',`/admin/appointments/${appointment.id}/cancel`,{reason:'Demo cancellation'}).expect(200);
 assert.equal((await api('get','/admin/semesters/FALL_2026_27/monitor')).body.courses.find(c=>c.id===courseIds[2]).pa_vacancy,1);
 await act(loser,'SELECT',2).expect(200);await act(loser,'REJECT',2).expect(200);
 await submit(11,2).expect(201);const replacement=(await find(11,2)).id;await act(replacement,'SHORTLIST',2).expect(200);await act(replacement,'SELECT',2).expect(200);
 await api('post',`/student/applications/${replacement}/withdraw`,{},students[11]).expect(200);
 await submit(12,2).expect(201);const next=(await find(12,2)).id;await act(next,'SHORTLIST',2).expect(200);await act(next,'SELECT',2).expect(200);
});
test('TA pending selections reserve capacity and acceptance does not count its own reservation twice',async()=>{
 await db.query('UPDATE semester_course_assignments SET ta_slots=1 WHERE id=$1',[courseIds[3]]);
 for(const i of [13,14]){await submit(i,3,'TA').expect(201);await act((await find(i,3,'TA')).id,'SHORTLIST',3).expect(200);}
 const a=(await find(13,3,'TA')).id,b=(await find(14,3,'TA')).id;
 const results=await Promise.all([act(a,'SELECT',3),act(b,'SELECT',3)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results[0].status===200?a:b,loser=winner===a?b:a;await act(winner,'ACCEPT',3).expect(200);await act(loser,'SELECT',3).expect(409);
});
test('student withdrawal is ownership protected and terminal; review actions audited',async()=>{
 await submit(10,1).expect(201);const a=await find(10,1);await api('post',`/student/applications/${a.id}/withdraw`,{},students[11]).expect(404);await api('post',`/student/applications/${a.id}/withdraw`,{},students[10]).expect(200);await act(a.id,'SHORTLIST',1).expect(409);
 const logs=(await api('get','/admin/audit').expect(200)).body.logs;assert.ok(logs.some(l=>l.action==='APPLICATION_AUTO_CANCELLED'));await api('get','/admin/audit',undefined,students[0]).expect(403);
});
test('student can edit own unreviewed application only, with window and input protection',async()=>{
 await submit(10,3,'PA',{statement:'Original interest',requirement_acknowledged:true}).expect(201);const a=await find(10,3);
 const path=`/student/applications/${a.id}`;
 await api('put',path,{statement:'Not mine'},students[11]).expect(404);
 await api('put',path,{statement:'x'.repeat(2001)},students[10]).expect(400);
 await api('put',path,{statement:'Updated interest',requirement_acknowledged:true,cgpa:10,role:'TA'},students[10]).expect(200);
 const updated=await find(10,3);assert.equal(updated.statement,'Updated interest');assert.equal(updated.role,'PA');assert.ok(updated.updated_at);
 assert.ok((await api('get','/student/applications',undefined,students[10])).body.applications.find(r=>r.id===a.id).can_edit);
 await db.query("UPDATE semesters SET application_end=now()-interval '1 minute' WHERE id='FALL_2026_27'");
 await api('put',path,{statement:'Late edit'},students[10]).expect(409);
 await db.query("UPDATE semesters SET application_end=now()+interval '30 days' WHERE id='FALL_2026_27'");
 await act(a.id,'REVIEW',3).expect(200);await api('put',path,{statement:'After review'},students[10]).expect(409);
 await api('post',path+'/withdraw',{},students[10]).expect(200);await api('put',path,{statement:'After withdrawal'},students[10]).expect(409);
});
test('student assistantships show own appointments and no premature final result',async()=>{
 const data=(await api('get','/student/assistantships?student_id='+ids[1],undefined,students[0]).expect(200)).body;
 assert.equal(data.appointments.length,2);assert.deepEqual(data.appointments.map(a=>a.role).sort(),['PA','TA']);assert.equal(data.results.length,0);
 const other=(await api('get','/student/assistantships',undefined,students[1]).expect(200)).body;assert.equal(other.appointments.length,0);
 await api('get','/student/assistantships',undefined,faculty[0]).expect(403);
});
test('faculty notes and timetable are scoped to assigned applicants and private from students',async()=>{
 const a=await find(0,0);
 await api('get',`/faculty/applications/${a.id}/profile`,undefined,faculty[1]).expect(403);
 await api('post',`/faculty/applications/${a.id}/notes`,{note:'Private candidate review'},faculty[1]).expect(403);
 await api('post',`/faculty/applications/${a.id}/notes`,{note:'  '},faculty[0]).expect(400);
 await api('post',`/faculty/applications/${a.id}/notes`,{note:'Private candidate review'},faculty[0]).expect(201);
 const profile=(await api('get',`/faculty/applications/${a.id}/profile`,undefined,faculty[0]).expect(200)).body;
 assert.equal(profile.notes[0].note,'Private candidate review');assert.ok(profile.timetable.length);assert.ok(profile.timetable.every(t=>!t.student_id));
 await api('get',`/faculty/applications/${a.id}/profile`,undefined,students[0]).expect(403);
 assert.ok(!JSON.stringify((await api('get','/student/applications',undefined,students[0])).body).includes('Private candidate review'));
});
test('faculty submits accepted appointments before Admin can finalize',async()=>{
 await api('post','/admin/semesters/FALL_2026_27/finalize',{confirm:true}).expect(409);
 await api('post',`/faculty/assignments/${courseIds[0]}/submit`,{confirm:true},faculty[1]).expect(403);
 await api('post',`/faculty/assignments/${courseIds[0]}/submit`,{},faculty[0]).expect(400);
 const courses=(await db.query("SELECT DISTINCT c.id,c.faculty_email FROM semester_course_assignments c JOIN applications a ON a.assignment_id=c.id JOIN assistantship_appointments p ON p.application_id=a.id WHERE p.active")).rows;
 for(const c of courses){const owner=Number(c.faculty_email.match(/head(\d)/)[1]);await api('post',`/faculty/assignments/${c.id}/submit`,{confirm:true},faculty[owner]).expect(200);await api('post',`/faculty/assignments/${c.id}/submit`,{confirm:true},faculty[owner]).expect(409);}
 const report=(await api('get','/admin/semesters/FALL_2026_27/monitor')).body;assert.ok(report.appointments.every(p=>p.submitted_at&&p.submitted_by));
});
test('final approval freezes results, exports Excel and PDF, blocks all later workflow mutations',async()=>{
 await api('get','/admin/semesters/FALL_2026_27/results').expect(409);await api('post','/admin/semesters/FALL_2026_27/finalize',{}).expect(400);await api('post','/admin/semesters/FALL_2026_27/finalize',{confirm:true},students[0]).expect(403);await api('post','/admin/semesters/FALL_2026_27/finalize',{confirm:true}).expect(200);
 const list=(await api('get','/admin/semesters/FALL_2026_27/results').expect(200)).body;assert.ok(list.rows.length>=4);assert.ok(list.rows.every(r=>Number(r.amount)>0));
 const excel=await api('get','/admin/semesters/FALL_2026_27/results?format=xlsx').buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>cb(null,Buffer.concat(chunks)));}).expect(200);const book=XLSX.read(excel.body,{type:'buffer'});assert.equal(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]).length,list.rows.length);
 const pdf=makePdf(Array.from({length:200},(_,i)=>`Row ${i} (test)`));assert.ok(pdf.toString().startsWith('%PDF-1.4'));assert.match(pdf.toString(),/\/Count 5/);await api('get','/admin/semesters/FALL_2026_27/results?format=pdf').expect('Content-Type',/pdf/).expect(200);
 await submit(12,0).expect(409);await act((await find(9,2)).id,'ACCEPT',2).expect(403);await api('post','/admin/semesters/FALL_2026_27/finalize',{confirm:true}).expect(409);
 const personal=(await api('get','/student/assistantships',undefined,students[0]).expect(200)).body;assert.equal(personal.results[0].rows.length,2);assert.ok(personal.results[0].rows.every(r=>r.student_id==='20240000'));
 const notAwarded=(await api('get','/student/assistantships',undefined,students[10]).expect(200)).body;assert.equal(notAwarded.results.length,1);assert.deepEqual(notAwarded.results[0].rows,[]);
 const snapshot=JSON.stringify(list.rows);await api('post','/admin/semesters/FALL_2026_27/archive',{}).expect(200);assert.equal(JSON.stringify((await api('get','/admin/semesters/FALL_2026_27/results')).body.rows),snapshot);
 const archived=(await api('get','/student/assistantships',undefined,students[0])).body;assert.ok(archived.appointments.every(a=>a.semester_status==='ARCHIVED'));assert.deepEqual(archived.results,personal.results);
 assert.equal((await api('get','/student/opportunities',undefined,students[0])).body.semester,null);assert.ok((await api('get','/student/academic-profile',undefined,students[0])).body.history.every(h=>h.approved_at));
});
test('approved results stay attached to the student after authoritative student-number changes, including legacy snapshots',async()=>{
 const before=(await api('get','/student/assistantships',undefined,students[0]).expect(200)).body.results;
 await db.query('UPDATE students SET student_id=$1 WHERE user_id=$2',['RENAMED-20240000',ids[0]]);
 const after=(await api('get','/student/assistantships',undefined,students[0]).expect(200)).body.results;
 assert.deepEqual(after,before);assert.equal(after[0].rows.length,2);
 // Simulate an existing result snapshot from before stable IDs were included.
 const snapshot=(await db.query("SELECT rows FROM final_results WHERE semester_id='FALL_2026_27'")).rows[0].rows;
 const legacy=snapshot.map(({student_user_id,...row})=>row);
 await db.query("UPDATE final_results SET rows=$1 WHERE semester_id='FALL_2026_27'",[JSON.stringify(legacy)]);
 const historical=(await api('get','/student/assistantships',undefined,students[0]).expect(200)).body.results;
 assert.equal(historical[0].rows.length,2);assert.ok(historical[0].rows.every(r=>r.student_id==='20240000'));
 assert.equal((await api('get','/student/assistantships',undefined,students[1]).expect(200)).body.results.length,0);
});
