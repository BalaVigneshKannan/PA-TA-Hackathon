import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const secret=randomBytes(48).toString('hex');
const password=randomBytes(18).toString('base64url');
const facultyPassword=randomBytes(18).toString('base64url');
const studentPassword=randomBytes(18).toString('base64url');
const env=`DATABASE_MODE=embedded\nJWT_SECRET=${secret}\nPORT=3001\nAPP_ORIGIN=http://127.0.0.1:5173\nNODE_ENV=development\nSEED_ADMIN_EMAIL=admin@dubai.bits-pilani.ac.in\nSEED_ADMIN_PASSWORD=${password}\nSEED_FACULTY_PASSWORD=${facultyPassword}\nSEED_STUDENT_PASSWORD=${studentPassword}\n`;
try{await writeFile(new URL('../.env',import.meta.url),env,{flag:'wx'});}catch(e){if(e.code==='EEXIST'){console.log('Existing backend/.env preserved.');process.exit(0);}throw e;}
await writeFile(new URL('../../LOCAL-ACCESS.md',import.meta.url),`# Local development access\n\nOpen http://127.0.0.1:5173 after running the portal. These randomly generated credentials are local only. This file is excluded from Git.\n\n| Portal | Email | Password |\n|---|---|---|\n| Admin | admin@dubai.bits-pilani.ac.in | ${password} |\n| Faculty | faculty@dubai.bits-pilani.ac.in | ${facultyPassword} |\n| Student | f20240123@dubai.bits-pilani.ac.in | ${studentPassword} |\n\nFaculty access requires a matching active-semester course assignment. Student profiles and eligibility rules must be loaded before applications are available.\n`,{flag:'wx'});
console.log('Created backend/.env and LOCAL-ACCESS.md with random development credentials.');
