import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import {mkdir,stat} from 'node:fs/promises';
import {join} from 'node:path';

// ZIP archives often omit empty directories in an otherwise intact PGDATA tree.
// Restore only supporting directories; never initialize over missing database files.
async function restorePackagedDirectories(directory){
 try{await stat(join(directory,'PG_VERSION'));}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const name of ['base','global','pg_wal','pg_xact','pg_multixact','pg_subtrans']){
  if(!(await stat(join(directory,name))).isDirectory())throw new Error(`Embedded database directory ${name} is missing or invalid. Restore the original database backup.`);
 }
 for(const name of ['pg_commit_ts','pg_dynshmem','pg_notify','pg_replslot','pg_serial','pg_snapshots','pg_stat','pg_stat_tmp','pg_tblspc','pg_twophase','pg_logical/mappings','pg_logical/snapshots','pg_wal/archive_status','pg_wal/summaries']){
  await mkdir(join(directory,name),{recursive:true});
 }
}

export async function openDatabase({memory=false,dataDir}={}) {
 if(memory || dataDir || process.env.DATABASE_MODE === 'embedded') {
  const directory=dataDir??fileURLToPath(new URL('../.data/',import.meta.url));
  if(!memory)await restorePackagedDirectories(directory);
  const db = new PGlite(memory ? undefined : directory);
  await db.waitReady;
  return {query:(sql,params)=>db.query(sql,params),exec:sql=>db.exec(sql),transaction:fn=>db.transaction(tx=>fn({query:(s,p)=>tx.query(s,p),exec:s=>tx.exec(s)})),close:()=>db.close()};
 }
 if(!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL or DATABASE_MODE=embedded in backend/.env');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 return {query:(s,p)=>pool.query(s,p),exec:s=>pool.query(s),close:()=>pool.end(),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const value=await fn({query:(s,p)=>c.query(s,p),exec:s=>c.query(s)});await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
}
