import 'dotenv/config';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import {writeFile} from 'node:fs/promises';
import {openDatabase} from './db.js';
const db=await openDatabase();const created=[];
try{
 for(const i of [1,2]){
  const email=`demo.faculty${i}@dubai.bits-pilani.ac.in`;
  if((await db.query('SELECT id FROM users WHERE email=$1',[email])).rows.length)continue;
  const password=randomBytes(18).toString('base64url');
  await db.query('INSERT INTO users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)',[randomUUID(),email,`Demo Faculty ${i}`,await bcrypt.hash(password,12),'FACULTY']);created.push({email,password});
 }
 if(created.length)await writeFile(new URL('../../FACULTY-DEMO-ACCESS.md',import.meta.url),'# Phase 4 local faculty demo\n\nThese are generated local demonstration accounts. Existing users and semester assignments were not changed.\n\n'+created.map(a=>`- Email: ${a.email}\n  Password: \`${a.password}\`\n`).join('\n')+'\nDemo Faculty 1 heads CS F303 and CS F372 in the sample Fall semester. Demo Faculty 2 heads CS F364. The original faculty@dubai.bits-pilani.ac.in account has no sample assignment and should be denied.\n',{flag:'a'});
 console.log(`${created.length} demo faculty accounts created; existing users preserved. See FACULTY-DEMO-ACCESS.md.`);
}finally{await db.close();}
