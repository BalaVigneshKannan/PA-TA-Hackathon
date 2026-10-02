import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {openDatabase} from '../src/db.js';
import {migrate} from '../src/migrate.js';
import {createApp} from '../src/app.js';

const origin='http://127.0.0.1:5173',issuer='https://intranet.university.example',audience='pa-ta-portal';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config={secret:'isolated-intranet-session-secret-at-least-32-characters',origin,intranet:{issuer,audience,publicKey:publicKey.export({type:'spki',format:'pem'})}};
const academic={student_id:'20260001',programme:'Computer Science',current_year:3,cgpa:8.75,courses:[{course_code:'CSF301',grade:'A'}]};
let db,app,studentId,cookie,courseId;
function sign(patch={},key=privateKey){const now=Math.floor(Date.now()/1000);return jwt.sign({iss:issuer,aud:audience,sub:'university-student-1',jti:randomUUID(),iat:now,exp:now+120,email:'student@dubai.bits-pilani.ac.in',email_verified:true,name:'University Student',role:'STUDENT',academic,...patch},key,{algorithm:'RS256'});}
const exchange=(assertion,target=app)=>request(target).post('/api/auth/intranet').set('Origin',origin).send({assertion});
before(async()=>{
 db=await openDatabase({memory:true});await migrate(db);await migrate(db);app=createApp(db,config);
 await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end,status,pa_amount) VALUES('FALL_2026_27','2026-2027','FALL',now()-interval '1 day',now()+interval '1 day','DRAFT',1200)");
 await db.query("INSERT INTO core_courses VALUES('CS F301','Programming Languages')");courseId=randomUUID();
 await db.query("INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots) VALUES($1,'FALL_2026_27','CS F301','Head','head@dubai.bits-pilani.ac.in',2)",[courseId]);
});
after(async()=>db.close());

test('intranet sign-in is disabled unless the university key is configured; origin checks apply',async()=>{
 await exchange(sign(),createApp(db,{secret:config.secret,origin})).expect(503);
 await request(app).post('/api/auth/intranet').set('Origin','https://untrusted.example').send({assertion:sign()}).expect(403);
 assert.throws(()=>createApp(db,{...config,intranet:{issuer}}),/Configure/);
});
test('verified identity creates a passwordless session and synchronizes complete academic records atomically',async()=>{
 const response=await exchange(sign()).expect(200);studentId=response.body.user.id;cookie=response.headers['set-cookie'];
 assert.equal(response.body.user.role,'STUDENT');assert.equal(response.body.user.password_hash,undefined);assert.match(cookie[0],/HttpOnly/);
 const data=(await request(app).get('/api/student/academic-profile').set('Cookie',cookie).expect(200)).body;
 assert.equal(data.student.student_id,academic.student_id);assert.equal(Number(data.student.cgpa),8.75);assert.equal(data.student.academic_source,issuer);assert.ok(data.student.academic_synced_at);assert.deepEqual(data.courses,[{course_code:'CS F301',grade:'A'}]);
 assert.equal((await db.query('SELECT password_hash FROM users WHERE id=$1',[studentId])).rows[0].password_hash,null);
});
test('forged, expired, wrong-audience, future-issued, unverified and oversized-lifetime assertions fail',async()=>{
 const now=Math.floor(Date.now()/1000),attacker=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
 await exchange(sign({},attacker)).expect(401);
 for(const patch of [{exp:now-1},{aud:'other-app'},{iss:'other-issuer'},{iat:now+30,exp:now+100},{iat:now,exp:now+301},{jti:''},{sub:''}]){
  const response=await exchange(sign(patch));assert.equal(response.status,401,JSON.stringify(patch));
 }
 await exchange(sign({email_verified:false})).expect(403);
 await exchange(sign({email:'student@external.example'})).expect(403);
 await exchange(sign({email:'student@dubai.bits-pilani.ac.in@external.example'})).expect(403);
 const forged=jwt.sign({sub:studentId},config.secret,{algorithm:'HS256'});await exchange(forged).expect(401);
});
test('replay protection admits exactly one concurrent exchange and logout revokes its session',async()=>{
 const assertion=sign(),responses=await Promise.all([exchange(assertion),exchange(assertion)]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);const session=responses.find(r=>r.status===200).headers['set-cookie'];
 await request(app).post('/api/auth/logout').set('Origin',origin).set('Cookie',session).expect(204);
 await request(app).get('/api/auth/me').set('Cookie',session).expect(401);
});
test('invalid academic sync preserves the old records; identity binding prevents relinking and escalation',async()=>{
 await exchange(sign({academic:{...academic,cgpa:12}})).expect(400);
 await exchange(sign({academic:{...academic,courses:[{course_code:'CS F301',grade:'A'},{course_code:'CSF301',grade:'B'}]}})).expect(400);
 await exchange(sign({role:'ADMIN',academic:undefined})).expect(403);
 await exchange(sign({sub:'different-subject'})).expect(409);
 assert.equal(Number((await db.query('SELECT cgpa FROM students WHERE user_id=$1',[studentId])).rows[0].cgpa),8.75);
 await db.query('UPDATE users SET active=FALSE WHERE id=$1',[studentId]);await exchange(sign()).expect(403);
 await request(app).get('/api/auth/me').set('Cookie',cookie).expect(401);await db.query('UPDATE users SET active=TRUE WHERE id=$1',[studentId]);
});
test('Admin configures forms in draft; activation publishes prefilled opportunities without manual academic entry',async()=>{
 const adminId=randomUUID();await db.query("INSERT INTO users(id,email,name,role) VALUES($1,'staff@dubai.bits-pilani.ac.in','Academic Admin','ADMIN')",[adminId]);
 const adminResponse=await exchange(sign({sub:'staff-1',email:'staff@dubai.bits-pilani.ac.in',role:'ADMIN',academic:undefined})).expect(200),adminCookie=adminResponse.headers['set-cookie'];
 const adminRequest=(path,body)=>request(app).put(path).set('Cookie',adminCookie).set('Origin',origin).send(body);
 await adminRequest(`/api/admin/assignments/${courseId}/criteria/PA`,{minimum_year:2,minimum_cgpa:7,required_course:'CS F301',minimum_grade:'B',additional_requirement:'',interview_required:false}).expect(200);
 assert.equal((await request(app).get('/api/student/opportunities').set('Cookie',cookie).expect(200)).body.opportunities.length,0);
 await request(app).post('/api/admin/semesters/FALL_2026_27/activate').set('Cookie',adminCookie).set('Origin',origin).send({}).expect(200);
 const opportunities=(await request(app).get('/api/student/opportunities').set('Cookie',cookie).expect(200)).body;
 assert.equal(opportunities.opportunities[0].can_apply,true);assert.equal(opportunities.profile.student.user_id,studentId);
 const result=await request(app).post('/api/student/applications').set('Cookie',cookie).set('Origin',origin).send({assignment_id:courseId,role:'PA',cgpa:10,statement:'I would like to apply.'}).expect(201);
 assert.equal(Number(result.body.application.profile_snapshot.student.cgpa),8.75);
 // New authoritative transcripts refresh the profile, while submitted applications retain their records.
 await exchange(sign({email:'renamed@dubai.bits-pilani.ac.in',academic:{...academic,cgpa:9,courses:[{course_code:'CS F302',grade:'B'}]}})).expect(200);
 assert.equal((await db.query('SELECT id FROM users WHERE email=$1',['renamed@dubai.bits-pilani.ac.in'])).rows[0].id,studentId);
 assert.deepEqual((await db.query('SELECT course_code FROM student_courses WHERE student_id=$1',[studentId])).rows,[{course_code:'CS F302'}]);
 assert.equal(Number((await db.query('SELECT profile_snapshot FROM applications WHERE id=$1',[result.body.application.id])).rows[0].profile_snapshot.student.cgpa),8.75);
});
test('faculty intranet sign-in requires an active course assignment; staff cannot self-provision Admin access',async()=>{
 const isolated=createApp(db,config);
 await exchange(sign({sub:'head-1',email:'head@dubai.bits-pilani.ac.in',name:'Head',role:'FACULTY',academic:undefined}),isolated).expect(200);
 await exchange(sign({sub:'unassigned-head',email:'other-head@dubai.bits-pilani.ac.in',role:'FACULTY',academic:undefined}),isolated).expect(403);
 await exchange(sign({sub:'new-staff',email:'new-staff@dubai.bits-pilani.ac.in',role:'ADMIN',academic:undefined}),isolated).expect(403);
});
