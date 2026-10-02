import {randomUUID} from 'node:crypto';

function fail(status,message){const error=new Error(message);error.status=status;throw error;}
export function dates(body){
 const {application_start,application_end}=body??{};
 for(const date of [application_start,application_end]){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail(400,'Enter valid application start and end dates.');
 }
 if(application_end<application_start)fail(400,'The application end date cannot be before the start date.');
 return [`${application_start}T00:00:00+04:00`,`${application_end}T23:59:59.999+04:00`];
}
const record=(tx,user,action,before,after)=>tx.query('INSERT INTO audit_logs(id,user_id,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),user,action,JSON.stringify({before,after})]);

export function semesterRoutes(app,db){
 const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){
  if(e.code==='23505')return res.status(409).json({error:e.constraint==='one_active_semester'?'Another semester is active. Archive it before activating this semester.':'This academic year and semester already exist.'});
  if(e.status)return res.status(e.status).json({error:e.message});next(e);
 }};
 app.get('/api/admin/semesters',handle(async(_req,res)=>{
  const {rows}=await db.query('SELECT * FROM semesters ORDER BY academic_year DESC, application_start DESC, id');res.json({semesters:rows});
 }));
 app.post('/api/admin/semesters',handle(async(req,res)=>{
  const {academic_year,term}=req.body??{};
  if(typeof academic_year!=='string'||!/^20\d{2}-20\d{2}$/.test(academic_year)||Number(academic_year.slice(5))!==Number(academic_year.slice(0,4))+1)fail(400,'Use consecutive academic years, for example 2026-2027.');
  if(!['FALL','SPRING'].includes(term))fail(400,'Semester must be Fall or Spring.');
  const [start,end]=dates(req.body);
  const id=`${term}_${academic_year.slice(0,4)}_${academic_year.slice(-2)}`;
  const semester=await db.transaction(async tx=>{
   const {rows}=await tx.query('INSERT INTO semesters(id,academic_year,term,application_start,application_end) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,academic_year,term,start,end]);
   await record(tx,req.user.id,'SEMESTER_CREATED',null,rows[0]);return rows[0];
  });res.status(201).json({semester});
 }));
 app.patch('/api/admin/semesters/:id',handle(async(req,res)=>{
  const [start,end]=dates(req.body);
  const semester=await db.transaction(async tx=>{
   const {rows}=await tx.query('SELECT * FROM semesters WHERE id=$1 FOR UPDATE',[req.params.id]);const before=rows[0];
   if(!before)fail(404,'Semester not found.');
   if(!['DRAFT','ACTIVE'].includes(before.status))fail(409,'Archived or finalized semesters cannot be edited.');
   if((req.body.academic_year!==undefined&&req.body.academic_year!==before.academic_year)||(req.body.term!==undefined&&req.body.term!==before.term))fail(400,'Academic year and term identify the semester and cannot be changed.');
   const result=await tx.query('UPDATE semesters SET application_start=$1,application_end=$2 WHERE id=$3 RETURNING *',[start,end,req.params.id]);
   await record(tx,req.user.id,'SEMESTER_UPDATED',before,result.rows[0]);return result.rows[0];
  });res.json({semester});
 }));
 for(const action of ['activate','archive'])app.post(`/api/admin/semesters/:id/${action}`,handle(async(req,res)=>{
  const semester=await db.transaction(async tx=>{
   const {rows}=await tx.query('SELECT * FROM semesters WHERE id=$1 FOR UPDATE',[req.params.id]);const before=rows[0];
   if(!before)fail(404,'Semester not found.');
   const status=action==='activate'?'ACTIVE':'ARCHIVED';
   if(before.status===status)return before;
   if(action==='activate'&&before.status!=='DRAFT')fail(409,'Only a draft semester can be activated.');
   if(action==='archive'&&!['DRAFT','ACTIVE','FINALIZED'].includes(before.status))fail(409,'This semester cannot be archived.');
   const result=await tx.query('UPDATE semesters SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]);
   await record(tx,req.user.id,action==='activate'?'SEMESTER_ACTIVATED':'SEMESTER_ARCHIVED',before,result.rows[0]);return result.rows[0];
  });res.json({semester});
 }));
}
