import jwt from 'jsonwebtoken';
import {rateLimit} from 'express-rate-limit';
import {createPublicKey,randomUUID} from 'node:crypto';
import {normalizeCode} from './course-imports.js';
import {audit,fail,handle,textValue} from './workflow-common.js';
import {facultyAssignments,facultyDenied} from './faculty.js';

// The university's server signs assertions; browsers never receive its private key.
export function intranetRoutes(app,db,{intranet,universityDomain,issueSession,setSession}){
 let key;
 if(intranet){
  if(!intranet.issuer||!intranet.audience||!intranet.publicKey)throw new Error('Configure the intranet issuer, audience and RSA public key together.');
  key=createPublicKey(intranet.publicKey.replace(/\\n/g,'\n'));
  if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<2048)throw new Error('The intranet public key must be RSA with at least 2048 bits.');
 }
 app.post('/api/auth/intranet',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many intranet sign-in attempts. Try again later.'}}),handle(async(req,res)=>{
  if(!key)fail(503,'University intranet sign-in has not been configured.');
  if(typeof req.body?.assertion!=='string')fail(400,'An intranet assertion is required.');
  let claims;
  try{claims=jwt.verify(req.body.assertion,key,{algorithms:['RS256'],issuer:intranet.issuer,audience:intranet.audience,maxAge:'5m'});}catch{fail(401,'The university assertion is invalid or expired.');}
  const now=Math.floor(Date.now()/1000);
  if(!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.iat>now||claims.exp<=claims.iat||claims.exp-claims.iat>300||typeof claims.jti!=='string'||!claims.jti||claims.jti.length>200||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>200)fail(401,'The assertion must have a subject, unique token ID and a lifetime of at most five minutes.');
  const email=textValue(claims.email,'university email',254).toLowerCase(),name=textValue(claims.name,'name',150),role=claims.role;
  if(claims.email_verified!==true||!name||!/^[^\s@]+@[^\s@]+$/.test(email)||email.split('@')[1]!==universityDomain||!['STUDENT','FACULTY','ADMIN'].includes(role))fail(403,'A verified university identity and authorized portal role are required.');
  const academic=role==='STUDENT'&&claims.academic?validateAcademic(claims.academic):null;
  const {user,token}=await db.transaction(async tx=>{
   await tx.query('DELETE FROM intranet_assertions WHERE expires_at<=now()');
   const consumed=await tx.query('INSERT INTO intranet_assertions(issuer,token_id,expires_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING token_id',[intranet.issuer,claims.jti,new Date(claims.exp*1000).toISOString()]);
   if(!consumed.rows.length)fail(401,'This university assertion has already been used.');
   const identity=(await tx.query('SELECT u.* FROM intranet_identities i JOIN users u ON u.id=i.user_id WHERE i.issuer=$1 AND i.subject=$2 FOR UPDATE',[intranet.issuer,claims.sub])).rows[0];
   let user=identity??(await tx.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[email])).rows[0];
   if(user&&(!user.active||user.role!==role))fail(403,'This account is disabled or its portal role does not match.');
   if(!user&&role==='ADMIN')fail(403,'An administrator must provision this staff account before intranet sign-in.');
   if(role==='FACULTY'&&!(await facultyAssignments(tx,email)).length)fail(403,facultyDenied);
   if(!user){user=(await tx.query('INSERT INTO users(id,email,name,role) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),email,name,role])).rows[0];}
   const linked=await tx.query('INSERT INTO intranet_identities(issuer,subject,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING user_id',[intranet.issuer,claims.sub,user.id]);
   if(!identity&&!linked.rows.length)fail(409,'This account is already linked to a different institutional identity.');
   user=(await tx.query('UPDATE users SET email=$1,name=$2 WHERE id=$3 RETURNING id,email,name,role',[email,name,user.id])).rows[0];
   if(academic){
    await tx.query('INSERT INTO students(user_id,student_id,programme,current_year,cgpa) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET student_id=$2,programme=$3,current_year=$4,cgpa=$5',[user.id,academic.student_id,academic.programme,academic.current_year,academic.cgpa]);
    await tx.query('UPDATE students SET academic_source=$1,academic_synced_at=now() WHERE user_id=$2',[intranet.issuer,user.id]);
    await tx.query('DELETE FROM student_courses WHERE student_id=$1',[user.id]);
    for(const c of academic.courses)await tx.query('INSERT INTO student_courses(id,student_id,course_code,grade) VALUES($1,$2,$3,$4)',[randomUUID(),user.id,c.course_code,c.grade]);
    await audit(tx,user.id,'ACADEMIC_PROFILE_SYNCED',{source:intranet.issuer,courses:academic.courses.length});
   }
   return {user,token:await issueSession(tx,user,'INTRANET_LOGIN')};
  });
  setSession(res,token).json({user});
 }));
}

function validateAcademic(value){
 const student_id=textValue(value.student_id,'student ID',50),programme=textValue(value.programme,'programme',150);
 if(!student_id||!programme||!Number.isInteger(value.current_year)||value.current_year<1||value.current_year>6||typeof value.cgpa!=='number'||!Number.isFinite(value.cgpa)||value.cgpa<0||value.cgpa>10||Math.abs(value.cgpa*100-Math.round(value.cgpa*100))>1e-7||!Array.isArray(value.courses)||value.courses.length>100)fail(400,'Provide a valid complete academic profile (year 1–6, CGPA 0–10 with two decimals, and up to 100 courses).');
 const codes=new Set(),courses=value.courses.map(c=>{
  const course_code=normalizeCode(textValue(c?.course_code,'course code',30)),grade=textValue(c?.grade,'grade',10);
  if(!/^[A-Z]{1,10} [A-Z]\d{3,4}$/.test(course_code)||!grade||codes.has(course_code))fail(400,'Academic courses must have valid, unique course codes and grades.');
  codes.add(course_code);return {course_code,grade};
 });
 return {student_id,programme,current_year:value.current_year,cgpa:value.cgpa,courses};
}
