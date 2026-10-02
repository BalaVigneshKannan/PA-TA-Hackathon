import {openDatabase} from './db.js';
import {migrate} from './migrate.js';
import {sampleCourses} from './sample-courses.js';
const db=await openDatabase();
try{await migrate(db);await db.transaction(async tx=>{for(const [code,name] of sampleCourses)await tx.query('INSERT INTO core_courses(course_code,name) VALUES($1,$2) ON CONFLICT(course_code) DO NOTHING',[code,name]);});console.log('Six sample core courses available. Existing master rows were preserved. These are demonstration data, not the approved college list.');}finally{await db.close();}
