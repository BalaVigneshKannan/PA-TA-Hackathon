import multer from 'multer';
import {randomUUID,createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {rateLimit} from 'express-rate-limit';

const headers=['course code','course name','course head','faculty email'];
export const normalizeCode=value=>String(value??'').trim().toUpperCase().replace(/\s+/g,'').replace(/^([A-Z]+)([A-Z]\d+)$/,'$1 $2');
const fingerprint=courses=>createHash('sha256').update(JSON.stringify(courses)).digest('hex');
function fail(status,message){throw Object.assign(new Error(message),{status});}
function parse(buffer){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('./excel-worker.js',import.meta.url),{workerData:buffer,resourceLimits:{maxOldGenerationSizeMb:96}});
 const timer=setTimeout(()=>{worker.terminate();reject(Object.assign(new Error('Workbook processing timed out. Use a smaller, plain course-head workbook.'),{status:400}));},10000);
 worker.once('message',result=>{clearTimeout(timer);worker.terminate();result.error?reject(Object.assign(new Error(result.error),{status:400})):resolve(result.rows);});
 worker.once('error',()=>{clearTimeout(timer);reject(Object.assign(new Error('Unable to process this workbook. Check its format and size.'),{status:400}));});
 worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(Object.assign(new Error('Workbook processing stopped. Please use a smaller workbook.'),{status:400}));});
});}
export function classifyRows(grid,courses){
 const first=(grid[0]??[]).map(c=>String(c.value).trim().toLowerCase());
 if(headers.some(h=>first.filter(v=>v===h).length!==1))fail(400,'Row 1 must contain each required column exactly once: Course Code, Course Name, Course Head, Faculty Email.');
 const indices=headers.map(h=>first.indexOf(h));
 const master=new Map(courses.map(c=>[normalizeCode(c.course_code),c]));
 const rows=grid.slice(1).map((cells,index)=>({cells,index})).filter(({cells})=>cells.some(c=>String(c.value).trim()!==''||c.formula)).map(({cells,index})=>{
  const values=indices.map(i=>String(cells[i]?.value??'').trim());
  const [rawCode,course_name,faculty_name,rawEmail]=values;const course_code=normalizeCode(rawCode),faculty_email=rawEmail.toLowerCase();const errors=[];
  if(indices.some(i=>cells[i]?.formula))errors.push('Use plain values, not formulas.');
  if(!/^[A-Z]{1,10} [A-Z]\d{3,4}$/.test(course_code))errors.push('Missing or invalid course code (example: CS F303).');
  if(!course_name||course_name.length>200)errors.push('Course name is required (maximum 200 characters).');
  if(!faculty_name||faculty_name.length>150)errors.push('Course head is required (maximum 150 characters).');
  if(faculty_email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@dubai\.bits-pilani\.ac\.in$/.test(faculty_email))errors.push('A valid Dubai campus faculty email is required.');
  const core=master.get(course_code);
  return {row:index+2,course_code,course_name,faculty_name,faculty_email,core:!!core,master_name:core?.name??null,errors};
 });
 if(!rows.length)fail(400,'The worksheet contains no course rows.');
 const heads=new Map();for(const r of rows)if(r.core)heads.set(r.faculty_email,(heads.get(r.faculty_email)||0)+1);
 const counts=new Map();for(const r of rows)counts.set(r.course_code,(counts.get(r.course_code)||0)+1);
 for(const r of rows){if(r.core&&heads.get(r.faculty_email)>1)r.errors.push("A faculty member may head only one core course per semester.");if(counts.get(r.course_code)>1)r.errors.push('Duplicate course code. Keep one row per course.');r.status=r.errors.length?'INVALID':r.core?'MATCHED':'IGNORED';}
 const matched=rows.filter(r=>r.status==='MATCHED');
 return {rows,summary:{processed:rows.length,matched:matched.length,ignored:rows.filter(r=>r.status==='IGNORED').length,invalid:rows.filter(r=>r.status==='INVALID').length,faculty:new Set(matched.map(r=>r.faculty_email)).size}};
}
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:0},fileFilter:(_req,file,cb)=>cb(/\.(xlsx|xls)$/i.test(file.originalname)?null:Object.assign(new Error('Upload an .xlsx or .xls workbook.'),{status:400}),true)}).single('file');
const audit=(tx,user,action,details)=>tx.query('INSERT INTO audit_logs(id,user_id,action,details) VALUES($1,$2,$3,$4)',[randomUUID(),user,action,JSON.stringify(details)]);
async function editable(db,id,lock=false){const {rows}=await db.query(`SELECT * FROM semesters WHERE id=$1${lock?' FOR UPDATE':''}`,[id]);if(!rows[0])fail(404,'Semester not found.');if(!['DRAFT','ACTIVE'].includes(rows[0].status))fail(409,'Archived and finalized semesters are read-only.');return rows[0];}

export function courseImportRoutes(app,db){
 const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){if(e.status)return res.status(e.status).json({error:e.message});if(e.code==='23505')return res.status(409).json({error:'Assignments changed. Refresh the semester and upload again.'});next(e);}};
 app.get('/api/admin/core-courses',handle(async(_req,res)=>res.json({courses:(await db.query('SELECT course_code,name FROM core_courses ORDER BY course_code')).rows})));
 app.get('/api/admin/semester/:semesterId/course-heads',handle(async(req,res)=>{
  const semester=(await db.query('SELECT * FROM semesters WHERE id=$1',[req.params.semesterId])).rows[0];if(!semester)fail(404,'Semester not found.');
  res.json({semester,assignments:(await db.query('SELECT a.*,c.name AS course_name FROM semester_course_assignments a JOIN core_courses c ON c.course_code=a.course_code WHERE semester_id=$1 ORDER BY a.course_code',[semester.id])).rows});
 }));
 app.post('/api/admin/semester/:semesterId/course-heads/upload',rateLimit({windowMs:60000,limit:10,legacyHeaders:false,standardHeaders:'draft-8',message:{error:'Too many uploads. Try again in a minute.'}}),(req,res,next)=>upload(req,res,error=>{if(error)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'Maximum workbook size is 2 MB.':error.message});next();}),handle(async(req,res)=>{
  await editable(db,req.params.semesterId);
  if(!req.file)fail(400,'Select an Excel workbook.');
  const buffer=req.file.buffer,ext=req.file.originalname.toLowerCase().endsWith('.xlsx')?'xlsx':'xls';
  if(ext==='xlsx'?!buffer.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])):!buffer.subarray(0,8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])))fail(400,'The file content does not match its Excel extension. Export a valid .xlsx or .xls workbook.');
  const courses=(await db.query('SELECT course_code,name FROM core_courses ORDER BY course_code')).rows;
  if(!courses.length)fail(409,'The core-course master list is empty. Load the master list before uploading.');
  const result=classifyRows(await parse(buffer),courses),id=randomUUID();
  const filename=req.file.originalname.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,180);
  await db.transaction(async tx=>{await editable(tx,req.params.semesterId,true);await tx.query('INSERT INTO course_upload_previews(id,semester_id,created_by,filename,result,master_fingerprint) VALUES($1,$2,$3,$4,$5,$6)',[id,req.params.semesterId,req.user.id,filename,JSON.stringify(result),fingerprint(courses)]);await audit(tx,req.user.id,'COURSE_HEADS_UPLOADED',{semester_id:req.params.semesterId,preview_id:id,filename,summary:result.summary});});
  res.json({preview_id:id,filename,...result,can_confirm:result.summary.invalid===0&&result.summary.matched>0});
 }));
 app.post('/api/admin/semester/:semesterId/course-heads/confirm',handle(async(req,res)=>{
  const id=req.body?.preview_id;if(typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))fail(400,'A valid preview ID is required. Upload the workbook first.');
  const summary=await db.transaction(async tx=>{
   await editable(tx,req.params.semesterId,true);
   const preview=(await tx.query('SELECT *,expires_at>now() AS valid FROM course_upload_previews WHERE id=$1 AND semester_id=$2 AND created_by=$3 FOR UPDATE',[id,req.params.semesterId,req.user.id])).rows[0];
   if(!preview)fail(404,'Preview not found for this account and semester.');
   if(preview.confirmed_at)fail(409,'This preview has already been confirmed.');
   if(!preview.valid)fail(409,'This preview expired. Upload the workbook again.');
   if(preview.result.summary.invalid||!preview.result.summary.matched)fail(409,'Resolve invalid rows and include at least one core course before confirming.');
   const courses=(await tx.query('SELECT course_code,name FROM core_courses ORDER BY course_code')).rows;
   if(fingerprint(courses)!==preview.master_fingerprint)fail(409,'The core-course master list changed. Upload again to refresh the preview.');
   if((await tx.query('SELECT id FROM semester_course_assignments WHERE semester_id=$1 LIMIT 1',[req.params.semesterId])).rows.length)fail(409,'This semester already has confirmed assignments. Existing assignments are preserved; replacement is not supported in Phase 3.');
   const matched=preview.result.rows.filter(r=>r.status==='MATCHED');if(new Set(matched.map(r=>r.faculty_email)).size!==matched.length)fail(409,'A faculty member may head only one course per semester. Upload a corrected workbook.');
   for(const row of matched)await tx.query('INSERT INTO semester_course_assignments(id,semester_id,course_code,faculty_name,faculty_email) VALUES($1,$2,$3,$4,$5)',[randomUUID(),req.params.semesterId,row.course_code,row.faculty_name,row.faculty_email]);
   await tx.query('UPDATE course_upload_previews SET confirmed_at=now() WHERE id=$1',[id]);
   await audit(tx,req.user.id,'COURSE_HEADS_CONFIRMED',{semester_id:req.params.semesterId,preview_id:id,summary:preview.result.summary});return preview.result.summary;
  });res.json({summary});
 }));
}
