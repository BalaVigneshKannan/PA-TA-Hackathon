import {randomUUID,randomBytes} from 'node:crypto';
import {appendFile,writeFile,mkdir} from 'node:fs/promises';
import bcrypt from 'bcrypt';
import XLSX from 'xlsx';
import {openDatabase} from './db.js';
import {migrate} from './migrate.js';
import {sampleCourses,sampleHeaders} from './sample-courses.js';
import {audit} from './workflow-common.js';
const db=await openDatabase();
try{
 await migrate(db);const credentials=[];
 async function account(email,name,role){const existing=(await db.query('SELECT id FROM users WHERE email=$1',[email])).rows[0];if(existing)return existing.id;const id=randomUUID(),password=randomBytes(18).toString('base64url');await db.query('INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,$3,$4,$5)',[id,email,name,role,await bcrypt.hash(password,12)]);credentials.push(`| ${role} | ${name} | ${email} | ${password} |`);return id;}
 for(let i=1;i<=6;i++)await account(`demo.faculty${i}@dubai.bits-pilani.ac.in`,`Demo Faculty ${i}`,'FACULTY');
 await account('demo.noncore@dubai.bits-pilani.ac.in','Non-core Demo Faculty','FACULTY');
 for(let i=1;i<=15;i++){
  const email=`f2025${String(i).padStart(4,'0')}@dubai.bits-pilani.ac.in`,name=`Demo Student ${String(i).padStart(2,'0')}`,id=await account(email,name,'STUDENT');
  await db.query('INSERT INTO students(user_id,student_id,programme,current_year,cgpa) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO NOTHING',[id,`2025${String(i).padStart(4,'0')}`,'Computer Science',i===2?1:i%2+2,i===3?6.2:8+(i%5)/10]);
  for(const [code] of sampleCourses)await db.query('INSERT INTO student_courses(id,student_id,course_code,grade) VALUES($1,$2,$3,$4) ON CONFLICT(student_id,course_code) DO NOTHING',[randomUUID(),id,code,i===4?'B':'A']);
 }
 // Preserve existing accounts and academic values, filling only missing demo course records.
 const original=(await db.query("SELECT user_id FROM students s JOIN users u ON u.id=s.user_id WHERE u.email='f20240123@dubai.bits-pilani.ac.in'")).rows[0];
 if(original)for(const [code] of sampleCourses)await db.query('INSERT INTO student_courses(id,student_id,course_code,grade) VALUES($1,$2,$3,$4) ON CONFLICT(student_id,course_code) DO NOTHING',[randomUUID(),original.user_id,code,'A']);
 await db.transaction(async tx=>{
  const semester=(await tx.query("SELECT * FROM semesters WHERE status='ACTIVE' FOR UPDATE")).rows[0];if(!semester)return;
  const courses=(await tx.query("SELECT * FROM semester_course_assignments WHERE semester_id=$1 AND faculty_email LIKE 'demo.faculty%@dubai.bits-pilani.ac.in'",[semester.id])).rows;
  for(const c of courses){
   if(!sampleCourses.some(([code])=>code===c.course_code))continue;
   await tx.query('UPDATE semester_course_assignments SET pa_slots=CASE WHEN pa_slots=0 THEN 2 ELSE pa_slots END,ta_slots=CASE WHEN ta_slots=0 THEN 3 ELSE ta_slots END WHERE id=$1',[c.id]);
   for(const role of ['PA','TA'])await tx.query('INSERT INTO eligibility_criteria(id,assignment_id,role,minimum_year,minimum_cgpa,required_course,minimum_grade,interview_required) VALUES($1,$2,$3,2,7,$4,$5,$6) ON CONFLICT(assignment_id,role) DO NOTHING',[randomUUID(),c.id,role,c.course_code,'A-',c.course_code==='CS F303'&&role==='TA']);
  }
  if(courses.length)await audit(tx,null,'DEMO_WORKFLOW_PREPARED',{semester_id:semester.id,courses:courses.map(c=>c.course_code),note:'Synthetic academic records and missing demo criteria/slots only; existing applications preserved.'});
 });
 if(credentials.length)await appendFile(new URL('../../DEMO-ACCESS.md',import.meta.url),`\n# Generated local demo accounts\n\nExisting passwords are unchanged. This file is excluded from Git.\n\n| Role | Name | Email | Password |\n|---|---|---|---|\n${credentials.join('\n')}\n\nStudent 02 is first-year; Student 03 has low CGPA; Student 04 has grade B. Others meet the sample requirements.\n`);
 const rows=sampleCourses.map(([code,name],i)=>[code,name,`Demo Faculty ${i+1}`,`demo.faculty${i+1}@dubai.bits-pilani.ac.in`]).concat([['MATH F101','Demo Mathematics','Non-core Demo Faculty','demo.noncore@dubai.bits-pilani.ac.in'],['PHY F101','Demo Physics','Non-core Demo Faculty','demo.noncore@dubai.bits-pilani.ac.in'],['HSS F101','Demo Humanities','Non-core Demo Faculty','demo.noncore@dubai.bits-pilani.ac.in']]);
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([sampleHeaders,...rows]),'Course heads');await mkdir(new URL('../../frontend/public/samples/',import.meta.url),{recursive:true});await writeFile(new URL('../../frontend/public/samples/hackathon-course-heads.xlsx',import.meta.url),XLSX.write(book,{type:'buffer',bookType:'xlsx'}));
 console.log('Demo profiles and workbook prepared. New credentials are in DEMO-ACCESS.md; existing passwords were preserved.');
}finally{await db.close();}
