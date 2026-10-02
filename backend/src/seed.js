import {randomUUID} from 'node:crypto';
import bcrypt from 'bcrypt';
import {openDatabase} from './db.js';
import {migrate} from './migrate.js';
const db=await openDatabase();
try {
 await migrate(db);
 const accounts=[['ADMIN',process.env.SEED_ADMIN_EMAIL,'Portal Administrator',process.env.SEED_ADMIN_PASSWORD],['FACULTY','faculty@dubai.bits-pilani.ac.in','Demo Faculty',process.env.SEED_FACULTY_PASSWORD],['STUDENT','f20240123@dubai.bits-pilani.ac.in','Demo Student',process.env.SEED_STUDENT_PASSWORD]];
 if(!accounts[0][1] || !accounts[0][3]) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env');
 for(const [role,email,name,password] of accounts){
  if(!password) continue;
  if(password.length<12 || Buffer.byteLength(password)>72) throw new Error('Seed passwords must be 12+ characters and at most 72 bytes.');
  const id=randomUUID();
  const result=await db.query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING id',[id,email.trim().toLowerCase(),name,await bcrypt.hash(password,12),role]);
  if(role==='STUDENT' && result.rows.length) await db.query('INSERT INTO students(user_id,student_id,programme,current_year,cgpa) VALUES($1,$2,$3,3,8.1)',[id,'20240123','Computer Science']);
  console.log(`${role}: ${result.rows.length ? 'created' : 'already exists (unchanged)'}`);
 }
}finally{await db.close();}
