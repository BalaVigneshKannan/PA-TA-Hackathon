import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {openDatabase} from './db.js';
export async function migrate(db){
 await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for(const [version,file] of [[1,'001_initial.sql'],[2,'002_course_uploads.sql'],[3,'003_workflow.sql'],[4,'004_timetable.sql'],[5,'005_faculty_review.sql'],[6,'006_student_applications.sql'],[7,'007_single_course_head.sql'],[8,'008_intranet.sql']]){
  const {rows}=await db.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
  if(!rows.length)await db.transaction(async tx=>{await tx.exec(await readFile(new URL(`../../database/${file}`,import.meta.url),'utf8'));await tx.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);});
 }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const db=await openDatabase();try{await migrate(db);console.log('Database migrations complete.');}finally{await db.close();}}
 catch(error){console.error('Database migration failed:',error.message);process.exitCode=1;}
}
