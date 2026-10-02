import {studentWorkflow,facultyWorkflow} from './student-faculty-workflow.js';
import {adminWorkflow} from './admin-workflow.js';
import express from 'express';
import {allocationRoutes} from './allocations.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {randomUUID} from 'node:crypto';
import {semesterRoutes} from './semesters.js';
import {courseImportRoutes} from './course-imports.js';
import {facultyAssignments,facultyDenied,facultyRoutes} from './faculty.js';
import {intranetRoutes} from './intranet.js';
const cookieName='portal_session';
const publicUser=({id,name,email,role})=>({id,name,email,role});
export function createApp(db,{secret,origin='http://127.0.0.1:5173',production=false,intranet=null,universityDomain='dubai.bits-pilani.ac.in'}={}){
 if(!secret || secret.length<32 || secret.startsWith('replace-')) throw new Error('JWT_SECRET must be at least 32 characters and must not be the example value.');
 const app=express();
 app.disable('x-powered-by');
 app.use(helmet(),express.json({limit:'16kb'}),cookieParser());
 app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api',(req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin')!==origin) return res.status(403).json({error:'Request origin is not allowed.'});
  next();
 });
 const options={httpOnly:true,sameSite:'strict',secure:production,path:'/'};
 const audit=(tx,userId,action)=>tx.query('INSERT INTO audit_logs(id,user_id,action) VALUES($1,$2,$3)',[randomUUID(),userId,action]);
 const issueSession=async(tx,user,action='LOGIN')=>{
  const sessionId=randomUUID();
  await tx.query('DELETE FROM auth_sessions WHERE expires_at<=now()');
  await tx.query("INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[sessionId,user.id]);
  await audit(tx,user.id,action);
  return jwt.sign({},secret,{algorithm:'HS256',subject:user.id,jwtid:sessionId,expiresIn:'8h',issuer:'pa-ta-portal',audience:'pa-ta-web'});
 };
 const setSession=(res,token)=>res.cookie(cookieName,token,{...options,maxAge:8*60*60*1000});
 intranetRoutes(app,db,{intranet,universityDomain,issueSession,setSession});
 const dummyHash=bcrypt.hashSync(randomUUID(),12);
 const requireAuth=async(req,res,next)=>{
  let claims;
  try{claims=jwt.verify(req.cookies[cookieName],secret,{algorithms:['HS256'],issuer:'pa-ta-portal',audience:'pa-ta-web'});}catch{return res.status(401).json({error:'Please sign in to continue.'});}
  const {rows}=await db.query('SELECT u.id,u.name,u.email,u.role FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.id=$1 AND u.id=$2 AND s.expires_at>now() AND u.active=TRUE',[claims.jti,claims.sub]);
  if(!rows.length) return res.status(401).json({error:'Your session has ended. Please sign in again.'});
  req.user=rows[0];req.sessionId=claims.jti;next();
 };
 const requireRole=role=>(req,res,next)=>req.user.role===role?next():res.status(403).json({error:'ACCESS DENIED'});
 const requireAdmin=requireRole('ADMIN'), requireFaculty=requireRole('FACULTY'), requireStudent=requireRole('STUDENT');
 app.get('/api/health',async(_req,res)=>{await db.query('SELECT 1');res.json({status:'OK'});});
 app.post('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many sign-in attempts. Try again in 15 minutes.'}}),async(req,res)=>{
  const {email,password,role}=req.body??{};
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim())||typeof password!=='string'||!password||Buffer.byteLength(password)>72||!['ADMIN','FACULTY','STUDENT'].includes(role)) return res.status(400).json({error:'Enter a valid email, password, and portal role.'});
  const normalized=email.trim().toLowerCase();
  const {rows}=await db.query('SELECT * FROM users WHERE email=$1',[normalized]);
  const user=rows[0];
  const matches=await bcrypt.compare(password,user?.password_hash??dummyHash);
  if(!user||!matches||!user.active||user.role!==role) return res.status(401).json({error:'The email, password, or selected portal is incorrect.'});
  if(role!=='ADMIN'&&normalized.split('@')[1]!==universityDomain) return res.status(403).json({error:'A valid university account is required.'});
  if(role==='FACULTY'&&!(await facultyAssignments(db,normalized)).length){
   await audit(db,user.id,'FACULTY_LOGIN_DENIED');
   return res.status(403).json({error:facultyDenied,code:'FACULTY_NOT_ASSIGNED'});
  }
  const token=await db.transaction(tx=>issueSession(tx,user));
  setSession(res,token).json({user:publicUser(user)});
 });
 app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:req.user}));
 app.post('/api/auth/logout',requireAuth,async(req,res)=>{
  await db.transaction(async tx=>{await tx.query('DELETE FROM auth_sessions WHERE id=$1',[req.sessionId]);await audit(tx,req.user.id,'LOGOUT');});
  res.clearCookie(cookieName,options).status(204).end();
 });
 app.use('/api/admin',requireAuth,requireAdmin);
 semesterRoutes(app,db);
 allocationRoutes(app,db);
 adminWorkflow(app,db);
 courseImportRoutes(app,db);
 app.get('/api/admin/dashboard',async(req,res)=>{
  const {rows}=await db.query("SELECT * FROM semesters WHERE status='ACTIVE'");
  res.json({user:req.user,activeSemester:rows[0]??null});
 });
 app.use('/api/faculty',requireAuth,requireFaculty);
 facultyRoutes(app,db);
 facultyWorkflow(app,db);
 app.use('/api/student',requireAuth,requireStudent);
 studentWorkflow(app,db);
 app.get('/api/student/profile',(req,res)=>res.json({user:req.user}));
 app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
 app.use((err,_req,res,_next)=>{
  if(err.type==='entity.parse.failed') return res.status(400).json({error:'Invalid JSON request.'});
  if(err.type==='entity.too.large') return res.status(413).json({error:'Request is too large.'});
  console.error('Request failed:',err.message);
  res.status(500).json({error:'Something went wrong. Please try again.'});
 });
 return app;
}
