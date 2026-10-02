import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import {openDatabase} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createApp} from '../src/app.js';
const origin='http://127.0.0.1:5173',password='Faculty-test-password';
const head='head@dubai.bits-pilani.ac.in',other='other@dubai.bits-pilani.ac.in',unassigned='unassigned@dubai.bits-pilani.ac.in';
let db,app,cookie,otherCookie;
const login=(email,pass=password,role='FACULTY')=>request(app).post('/api/auth/login').set('Origin',origin).send({email,password:pass,role});
const get=(path,c=cookie)=>request(app).get(`/api/faculty${path}`).set('Cookie',c);
before(async()=>{
 db=await openDatabase({memory:true});await migrate(db);app=createApp(db,{secret:'faculty-test-secret-over-thirty-two-characters',origin});const hash=await bcrypt.hash(password,12);
 for(const [email,role] of [[head,'FACULTY'],[other,'FACULTY'],[unassigned,'FACULTY'],['admin@example.com','ADMIN'],['f20240123@dubai.bits-pilani.ac.in','STUDENT']])await db.query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),email,email.split('@')[0],hash,role]);
 for(const [id,term] of [['FALL_2026_27','FALL'],['SPRING_2026_27','SPRING']])await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end) VALUES($1,'2026-2027',$2,'2026-09-01','2026-10-01')",[id,term]);
 for(const [code,name,email] of [['CS F303','Networks',head],['CS F372','Operating Systems','third@dubai.bits-pilani.ac.in'],['CS F364','Algorithms',other]]){
  await db.query('INSERT INTO core_courses(course_code,name) VALUES($1,$2)',[code,name]);
  await db.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots,ta_slots) VALUES($1,$2,$3,$4,$5,2,3)',[randomUUID(),'FALL_2026_27',code,email,email]);
 }
});
after(async()=>await db.close());
test('no active semester and unassigned faculty deny login without issuing a session',async()=>{
 let res=await login(head);assert.equal(res.status,403);assert.equal(res.headers['set-cookie'],undefined);
 await db.query("UPDATE semesters SET status='ACTIVE' WHERE id='FALL_2026_27'");
 res=await login(unassigned);assert.equal(res.status,403);assert.equal(res.headers['set-cookie'],undefined);assert.match(res.body.error,/not currently assigned/);
 assert.equal((await db.query('SELECT * FROM auth_sessions')).rows.length,0);
 assert.equal((await db.query("SELECT * FROM audit_logs WHERE action='FACULTY_LOGIN_DENIED'")).rows.length,2);
});
test('authorized head signs in and sees only one assigned core course',async()=>{
 const result=await login(head.toUpperCase());assert.equal(result.status,200);cookie=result.headers['set-cookie'];
 otherCookie=(await login(other).expect(200)).headers['set-cookie'];
 const list=await get('/courses').expect(200);assert.deepEqual(list.body.courses.map(c=>c.course_code),['CS F303']);assert.equal(list.body.semester.id,'FALL_2026_27');
 const detail=await get('/courses/CSF303').expect(200);assert.equal(detail.body.course.pa_slots,2);assert.equal(detail.body.course.ta_slots,3);
 await get('/courses/CS%20F372').expect(403);await get('/profile').expect(200);
});
test('manual URLs, wrong-role sessions and unauthenticated requests cannot expose another course',async()=>{
 await get('/courses/CSF364').expect(403);await get('/courses/UNKNOWN').expect(403);await get('/courses/CSF303',otherCookie).expect(403);
 await request(app).get('/api/faculty/courses').expect(401);
 for(const [email,role] of [['admin@example.com','ADMIN'],['f20240123@dubai.bits-pilani.ac.in','STUDENT']]){const c=(await login(email,password,role).expect(200)).headers['set-cookie'];await get('/courses',c).expect(403);}
 await login(head,'wrong-password').expect(401);
});
test('course reassignment takes effect for an existing session on its next request',async()=>{
 await db.query('UPDATE semester_course_assignments SET faculty_email=$1 WHERE course_code=$2 AND semester_id=$3',['replacement@dubai.bits-pilani.ac.in','CS F303','FALL_2026_27']);
 await get('/courses/CSF303').expect(403);await get('/courses').expect(403);
 await db.query('UPDATE semester_course_assignments SET faculty_email=$1 WHERE course_code=$2 AND semester_id=$3',['fourth@dubai.bits-pilani.ac.in','CS F372','FALL_2026_27']);await get('/courses').expect(403);await get('/profile').expect(403);
});
test('new semester starts unauthorized; only its assignments count and old history remains',async()=>{
 await db.query("UPDATE semesters SET status='ARCHIVED' WHERE id='FALL_2026_27'");await get('/courses',otherCookie).expect(403);
 await db.query("UPDATE semesters SET status='ACTIVE' WHERE id='SPRING_2026_27'");await login(head).expect(403);
 await db.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email) VALUES($1,$2,$3,$4,$5)',[randomUUID(),'SPRING_2026_27','CS F303','Head',head]);
 const list=await get('/courses').expect(200);assert.equal(list.body.courses.length,1);assert.equal(list.body.semester.id,'SPRING_2026_27');await get('/courses/CSF372').expect(403);
 assert.equal((await db.query("SELECT * FROM semester_course_assignments WHERE semester_id='FALL_2026_27'")).rows.length,3);
 await db.query("UPDATE semesters SET status='FINALIZED' WHERE id='SPRING_2026_27'");await get('/courses').expect(403);
});
test('faculty whose authorization ended can still sign out and invalidate their session',async()=>{
 await request(app).post('/api/auth/logout').set('Cookie',cookie).set('Origin',origin).expect(204);await get('/courses').expect(401);
});

test('database blocks a second course for the same faculty in a semester',async()=>{await assert.rejects(db.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email) VALUES($1,$2,$3,$4,$5)',[randomUUID(),'SPRING_2026_27','CS F372','Head',head]),/unique|duplicate/i);});
