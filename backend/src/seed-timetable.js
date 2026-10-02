import {randomUUID} from 'node:crypto';
import {openDatabase} from './db.js';
import {migrate} from './migrate.js';
const db=await openDatabase();
try{await migrate(db);await db.transaction(async tx=>{
 const semester=(await tx.query("SELECT id FROM semesters WHERE status='ACTIVE' FOR UPDATE")).rows[0];if(!semester)throw new Error('Activate a semester before preparing sample timetables.');
 const students=(await tx.query("SELECT s.user_id FROM students s JOIN users u ON u.id=s.user_id WHERE u.email='f20240123@dubai.bits-pilani.ac.in' OR u.email ~ '^f202500(0[1-9]|1[0-5])@dubai[.]bits-pilani[.]ac[.]in$'")).rows;
 const classes=[['CS F351','Theory of Computation',1,'09:00','10:00','B-201'],['CS F342','Computer Architecture',1,'11:00','12:00','B-204'],['CS F301','Principles of Programming Languages',2,'10:00','11:00','B-203'],['CS F351','Theory of Computation',3,'09:00','10:00','B-201'],['CS F342','Computer Architecture Lab',4,'13:00','15:00','CS Lab 2'],['CS F301','Principles of Programming Languages',5,'10:00','11:00','B-203']];
 for(const student of students)for(const [code,name,day,start,end,room] of classes)await tx.query('INSERT INTO student_timetable(id,student_id,semester_id,course_code,course_name,weekday,starts_at,ends_at,room,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE) ON CONFLICT DO NOTHING',[randomUUID(),student.user_id,semester.id,code,name,day,start,end,room]);
 console.log(`Sample timetables prepared for ${students.length} students. Existing grades and CGPA preserved.`);
});}finally{await db.close();}
