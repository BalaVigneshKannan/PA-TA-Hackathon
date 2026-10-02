import {grantTestFaculty} from './faculty-fixture.js';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import * as XLSX from 'xlsx';
import {openDatabase} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createApp} from '../src/app.js';
import {sampleCourses,sampleHeaders,sampleRows} from '../src/sample-courses.js';
import {classifyRows} from '../src/course-imports.js';
const origin='http://127.0.0.1:5173',path='/api/admin/semester/FALL_2026_27/course-heads';let db,app,admin,otherAdmin,student,faculty,preview;
function workbook(rows=sampleRows,headers=sampleHeaders,type='xlsx'){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,...rows]),'Courses');return XLSX.write(wb,{type:'buffer',bookType:type==='xls'?'biff8':'xlsx'});}
const upload=(buffer=workbook(),filename='sample.xlsx',cookie=admin,base=path)=>request(app).post(`${base}/upload`).set('Origin',origin).set('Cookie',cookie).attach('file',buffer,filename);
const confirm=(id,cookie=admin,base=path)=>request(app).post(`${base}/confirm`).set('Origin',origin).set('Cookie',cookie).send({preview_id:id});
before(async()=>{
 db=await openDatabase({memory:true});await migrate(db);app=createApp(db,{secret:'phase-three-test-secret-longer-than-32-characters',origin});
 const revoke=await grantTestFaculty(db,'faculty@dubai.bits-pilani.ac.in');
 const hash=await bcrypt.hash('test-course-password',12),cookies=[];
 for(const [email,role] of [['admin@example.com','ADMIN'],['other@example.com','ADMIN'],['f20240123@dubai.bits-pilani.ac.in','STUDENT'],['faculty@dubai.bits-pilani.ac.in','FACULTY']]){await db.query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),email,role,hash,role]);cookies.push((await request(app).post('/api/auth/login').set('Origin',origin).send({email,role,password:'test-course-password'}).expect(200)).headers['set-cookie']);}
 [admin,otherAdmin,student,faculty]=cookies;await revoke();
 for(const [code,name] of sampleCourses)await db.query('INSERT INTO core_courses(course_code,name) VALUES($1,$2)',[code,name]);
 for(const term of ['FALL','SPRING'])await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end) VALUES($1,'2026-2027',$2,'2026-09-01','2026-10-01')",[`${term}_2026_27`,term]);
});
after(async()=>await db.close());
test('upload and confirm are admin-only',async()=>{await request(app).post(`${path}/upload`).set('Origin',origin).expect(401);for(const cookie of [student,faculty]){await upload(workbook(),'sample.xlsx',cookie).expect(403);await confirm(randomUUID(),cookie).expect(403);await request(app).get(path).set('Cookie',cookie).expect(403);}});
test('valid upload previews 10 rows, 6 matches, 4 ignored, 6 faculty without changing assignments',async()=>{
 const result=await upload().expect(200);preview=result.body.preview_id;assert.deepEqual(result.body.summary,{processed:10,matched:6,ignored:4,invalid:0,faculty:6});assert.equal((await db.query('SELECT * FROM semester_course_assignments')).rows.length,0);assert.equal(result.body.can_confirm,true);
});
test('preview is bound to its admin and semester; confirmation is atomic and replay-safe',async()=>{
 await confirm(preview,otherAdmin).expect(404);await confirm(preview,admin,path.replace('FALL','SPRING')).expect(404);await confirm(preview).expect(200);await confirm(preview).expect(409);
 const rows=(await db.query('SELECT * FROM semester_course_assignments')).rows;assert.equal(rows.length,6);assert.ok(rows.every(r=>r.semester_id==='FALL_2026_27'&&r.pa_slots===0&&r.ta_slots===0));assert.equal((await db.query('SELECT * FROM core_courses')).rows.length,6);
 const logs=(await db.query("SELECT action FROM audit_logs WHERE action LIKE 'COURSE_HEADS_%'")).rows;assert.ok(logs.some(r=>r.action==='COURSE_HEADS_UPLOADED'));assert.ok(logs.some(r=>r.action==='COURSE_HEADS_CONFIRMED'));
});
test('invalid duplicates and emails are explained and block all confirmation',async()=>{
 const rows=[sampleRows[0],[...sampleRows[0]],[sampleRows[1][0],sampleRows[1][1],'Dr Test','not-an-email']];
 const result=await upload(workbook(rows)).expect(200);assert.equal(result.body.summary.invalid,3);assert.ok(result.body.rows[0].errors.some(e=>e.includes('Duplicate')));await confirm(result.body.preview_id).expect(409);
});
test('reject disguised files, missing headers, empty sheets and file size overflow',async()=>{
 await upload(Buffer.from('fake'),'bad.xlsx').expect(400);await upload(workbook(),'bad.csv').expect(400);await upload(workbook(sampleRows,['Wrong','Headers'])).expect(400);await upload(workbook([])).expect(400);await upload(Buffer.alloc(2*1024*1024+1),'large.xlsx').expect(413);
});
test('legacy xls parses and expired/master-stale previews cannot be confirmed',async()=>{
 const base=path.replace('FALL','SPRING');const result=await upload(workbook(sampleRows,sampleHeaders,'xls'),'legacy.xls',admin,base).expect(200);const id=result.body.preview_id;
 await db.query("UPDATE course_upload_previews SET expires_at=now()-interval '1 hour' WHERE id=$1",[id]);await confirm(id,admin,base).expect(409);
 await db.query("UPDATE course_upload_previews SET expires_at=now()+interval '1 hour' WHERE id=$1",[id]);await db.query("UPDATE core_courses SET name='Changed master name' WHERE course_code='CS F303'");await confirm(id,admin,base).expect(409);
 await db.query('UPDATE core_courses SET name=$1 WHERE course_code=$2',[sampleCourses[0][1],sampleCourses[0][0]]);
 const pair=await Promise.all([confirm(id,admin,base),confirm(id,admin,base)]);assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
 assert.equal((await db.query("SELECT * FROM semester_course_assignments WHERE semester_id='FALL_2026_27'")).rows.length,6);
});
test('archival between upload and confirm blocks changes and preserves assignments',async()=>{
 await db.query("UPDATE semesters SET status='ARCHIVED' WHERE id='FALL_2026_27'");await confirm(preview).expect(409);const result=await request(app).get(path).set('Cookie',admin).expect(200);assert.equal(result.body.assignments.length,6);
});
test('row classification normalizes course codes and emails and rejects formulas',()=>{
 const grid=[sampleHeaders.map(value=>({value})),[' csf303 ','Networks','Faculty','FACULTY@DUBAI.BITS-PILANI.AC.IN'].map(value=>({value}))];
 const courses=sampleCourses.map(([course_code,name])=>({course_code,name}));const result=classifyRows(grid,courses);assert.equal(result.summary.matched,1);assert.equal(result.rows[0].course_code,'CS F303');assert.equal(result.rows[0].faculty_email,'faculty@dubai.bits-pilani.ac.in');grid[1][0].formula=true;assert.equal(classifyRows(grid,courses).summary.invalid,1);
});

test('duplicate course heads are rejected in the preview',()=>{const rows=sampleRows.slice(0,2).map(r=>[...r]);rows[1][3]=rows[0][3];const result=classifyRows([sampleHeaders,...rows].map(row=>row.map(value=>({value}))),sampleCourses.map(([course_code,name])=>({course_code,name})));assert.equal(result.summary.invalid,2);});
