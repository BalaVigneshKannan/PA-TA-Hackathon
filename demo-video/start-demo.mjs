// Isolated synthetic recording fixture. Never opens the user's persistent database.
import express from 'express';
import bcrypt from 'bcrypt';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase} from '../backend/src/db.js';
import {migrate} from '../backend/src/migrate.js';
import {createApp} from '../backend/src/app.js';
const db=await openDatabase({memory:true});await migrate(db);
const origin='http://127.0.0.1:5174';
const password=randomBytes(24).toString('base64url');
const hash=await bcrypt.hash(password,10);
const accounts={admin:'demo.admin@dubai.bits-pilani.ac.in',faculty:'demo.head@dubai.bits-pilani.ac.in',student:'demo.student@dubai.bits-pilani.ac.in'};
const users={};
for(const [role,email] of Object.entries(accounts)){
 const id=randomUUID();users[role]=id;
 await db.query('INSERT INTO users(id,email,role,name,password_hash) VALUES($1,$2,$3,$4,$5)',[id,email,role.toUpperCase(),role==='student'?'Demo Student':role==='faculty'?'Demo Faculty':'Demo Administrator',hash]);
}
await db.query('INSERT INTO students(user_id,student_id,programme,current_year,cgpa) VALUES($1,$2,$3,3,8.5)',[users.student,'20260001','Computer Science']);
await db.query("INSERT INTO semesters(id,academic_year,term,application_start,application_end,status,pa_amount,ta_amount) VALUES('FALL_2026_27','2026-2027','FALL',now()-interval '1 day',now()+interval '30 days','ACTIVE',1200,1500)");
const assignments=[];
for(const [i,code,name,email,head] of [[0,'CS F303','Computer Networks',accounts.faculty,'Demo Faculty'],[1,'CS F211','Data Structures','demo.otherhead@dubai.bits-pilani.ac.in','Demo Course Head']]){
 await db.query('INSERT INTO core_courses VALUES($1,$2)',[code,name]);
 const id=randomUUID();assignments.push(id);
 await db.query("INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email,pa_slots,ta_slots) VALUES($1,'FALL_2026_27',$2,$3,$4,2,1)",[id,code,head,email]);
 await db.query('INSERT INTO student_courses(id,student_id,course_code,grade) VALUES($1,$2,$3,$4)',[randomUUID(),users.student,code,'A']);
 for(const role of ['PA','TA'])await db.query('INSERT INTO eligibility_criteria(id,assignment_id,role,minimum_year,minimum_cgpa,required_course,minimum_grade,interview_required) VALUES($1,$2,$3,2,7,$4,$5,$6)',[randomUUID(),id,role,code,'A-',role==='TA']);
}
await db.query("INSERT INTO student_timetable(id,student_id,semester_id,course_code,course_name,weekday,starts_at,ends_at,room,is_demo) VALUES($1,$2,'FALL_2026_27','CS F303','Computer Networks',1,'09:00','10:00','Lab 2',TRUE)",[randomUUID(),users.student]);
const app=createApp(db,{secret:randomBytes(48).toString('hex'),origin});
app.use(express.static(fileURLToPath(new URL('../frontend/dist/',import.meta.url))));
app.get('/{*path}',(_req,res)=>res.sendFile(fileURLToPath(new URL('../frontend/dist/index.html',import.meta.url))));
await mkdir(new URL('.runtime/',import.meta.url),{recursive:true});
await writeFile(new URL('.runtime/session.json',import.meta.url),JSON.stringify({origin,password,accounts}));
const server=app.listen(5174,'127.0.0.1',()=>console.log('Isolated synthetic recording portal ready on '+origin));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
