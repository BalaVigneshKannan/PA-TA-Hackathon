import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rmdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {openDatabase} from '../src/db.js';

test('a packaged embedded database reopens with missing empty directories and preserves persisted records',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pa-ta-packaged-db-test-'));let db;
 try{
  db=await openDatabase({dataDir:directory});
  await db.exec("CREATE TABLE preserved_record(value TEXT); INSERT INTO preserved_record VALUES('retain the demo data')");
  await db.close();db=null;
  // Reproduce an archive that keeps files but omits empty PostgreSQL directories.
  for(const name of ['pg_notify','pg_twophase','pg_wal/archive_status','pg_logical/mappings'])await rmdir(join(directory,name));
  db=await openDatabase({dataDir:directory});
  assert.deepEqual((await db.query('SELECT value FROM preserved_record')).rows,[{value:'retain the demo data'}]);
  for(const name of ['pg_notify','pg_twophase','pg_wal/archive_status','pg_logical/mappings'])assert.ok((await stat(join(directory,name))).isDirectory());
 }finally{
  if(db)await db.close();
  const target=resolve(directory);
  if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('pa-ta-packaged-db-test-'))throw new Error('Refusing to remove an unexpected test directory.');
  await rm(target,{recursive:true,force:true});
 }
});
