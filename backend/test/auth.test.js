import {grantTestFaculty} from './faculty-fixture.js';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {openDatabase} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createApp} from '../src/app.js';
const origin='http://127.0.0.1:5173',secret='test-secret-with-at-least-32-characters',password='Test-password-2026';
let db,app;
const ids={};
const emails={ADMIN:'admin@dubai.bits-pilani.ac.in',FACULTY:'faculty@dubai.bits-pilani.ac.in',STUDENT:'f20240123@dubai.bits-pilani.ac.in'};
const login=(role='ADMIN',pass=password)=>request(app).post('/api/auth/login').set('Origin',origin).send({email:emails[role],password:pass,role});
before(async()=>{
 db=await openDatabase({memory:true});await migrate(db);await migrate(db);
 const hash=await bcrypt.hash(password,12);
 for(const role of Object.keys(emails)){ids[role]=randomUUID();await db.query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[ids[role],emails[role],role,hash,role]);}
 app=createApp(db,{secret,origin});
});
after(async()=>{await db?.close();});
test('health verifies database and unauthenticated admin access is rejected',async()=>{assert.equal((await request(app).get('/api/health')).body.status,'OK');await request(app).get('/api/admin/dashboard').expect(401);});
test('admin login, restored session, dashboard, logout and replay rejection',async()=>{
 const res=await login();assert.equal(res.status,200);assert.equal(res.body.user.role,'ADMIN');assert.equal(res.body.user.password_hash,undefined);
 const cookies=res.headers['set-cookie'];assert.match(cookies[0],/HttpOnly/);assert.match(cookies[0],/SameSite=Strict/);
 await request(app).get('/api/auth/me').set('Cookie',cookies).expect(200);
 const dashboard=await request(app).get('/api/admin/dashboard').set('Cookie',cookies).expect(200);assert.equal(dashboard.body.activeSemester,null);
 await request(app).post('/api/auth/logout').set('Origin',origin).set('Cookie',cookies).expect(204);
 await request(app).get('/api/auth/me').set('Cookie',cookies).expect(401);
 const {rows}=await db.query('SELECT action FROM audit_logs WHERE user_id=$1',[ids.ADMIN]);assert.ok(rows.some(r=>r.action==='LOGIN'));assert.ok(rows.some(r=>r.action==='LOGOUT'));
});
test('student and faculty cannot access admin routes or each other',async()=>{
 for(const role of ['FACULTY','STUDENT']){const revoke=role==='FACULTY'?await grantTestFaculty(db,emails.FACULTY):null;const res=await login(role);assert.equal(res.status,200);const cookie=res.headers['set-cookie'];await request(app).get('/api/admin/dashboard').set('Cookie',cookie).expect(403);await request(app).get(`/api/${role.toLowerCase()}/profile`).set('Cookie',cookie).expect(200);await request(app).get(`/api/${role==='FACULTY'?'student':'faculty'}/profile`).set('Cookie',cookie).expect(403);if(revoke)await revoke();}
});
test('wrong password, role spoofing, malformed input, tampered and expired tokens fail',async()=>{
 assert.equal((await login('ADMIN','bad-password')).status,401);
 await request(app).post('/api/auth/login').set('Origin',origin).send({email:emails.STUDENT,password,role:'ADMIN'}).expect(401);
 await request(app).post('/api/auth/login').set('Origin',origin).send({email:{$ne:null},password,role:'ADMIN'}).expect(400);
 await request(app).get('/api/auth/me').set('Cookie','portal_session=invalid').expect(401);
 const expired=jwt.sign({},secret,{subject:ids.ADMIN,jwtid:randomUUID(),expiresIn:-1,issuer:'pa-ta-portal',audience:'pa-ta-web'});
 await request(app).get('/api/auth/me').set('Cookie',`portal_session=${expired}`).expect(401);
});
test('cross-origin mutations and disabled accounts are blocked',async()=>{
 await request(app).post('/api/auth/login').set('Origin','https://untrusted.example').send({}).expect(403);
 const res=await login();await db.query('UPDATE users SET active=FALSE WHERE id=$1',[ids.ADMIN]);
 await request(app).get('/api/auth/me').set('Cookie',res.headers['set-cookie']).expect(401);assert.equal((await login()).status,401);
 await db.query('UPDATE users SET active=TRUE WHERE id=$1',[ids.ADMIN]);
});
test('database permits multiple applications and PA+TA but prevents duplicate active same-role appointments',async()=>{
 await db.query('INSERT INTO students(user_id,student_id,programme,current_year,cgpa) VALUES($1,$2,$3,3,8.1)',[ids.STUDENT,'20240123','Computer Science']);
 await db.exec("INSERT INTO semesters(id,academic_year,term,application_start,application_end) VALUES('FALL_2026_27','2026-2027','FALL','2026-09-01','2026-10-01')");
 const apps=[];
 for(let i=0;i<3;i++){const course=`CS F${303+i}`,assignment=randomUUID(),id=randomUUID(),role=i===2?'TA':'PA';await db.query('INSERT INTO core_courses(course_code,name) VALUES($1,$2)',[course,'Test Course']);await db.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email) VALUES($1,$2,$3,$4,$5)',[assignment,'FALL_2026_27',course,'Faculty',`head${i}@dubai.bits-pilani.ac.in`]);await db.query('INSERT INTO applications(id,student_id,assignment_id,semester_id,role) VALUES($1,$2,$3,$4,$5)',[id,ids.STUDENT,assignment,'FALL_2026_27',role]);apps.push({id,role});}
 const appoint=a=>db.query('INSERT INTO assistantship_appointments(id,application_id,student_id,semester_id,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),a.id,ids.STUDENT,'FALL_2026_27',a.role]);
 await appoint(apps[0]);await assert.rejects(appoint(apps[1]),/unique|duplicate/i);await appoint(apps[2]);
 assert.equal((await db.query('SELECT * FROM assistantship_appointments WHERE active')).rows.length,2);
});
