import * as XLSX from 'xlsx';
import {writeFile,mkdir} from 'node:fs/promises';
import {sampleHeaders,sampleRows} from './sample-courses.js';
const directory=new URL('../../frontend/public/samples/',import.meta.url);await mkdir(directory,{recursive:true});
for(const [name,rows] of [['course-heads-demo',sampleRows],['course-heads-template',[]]]){
 const workbook=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([sampleHeaders,...rows]);sheet['!cols']=[{wch:18},{wch:38},{wch:24},{wch:48}];XLSX.utils.book_append_sheet(workbook,sheet,'Course Heads');
 await writeFile(new URL(`${name}.xlsx`,directory),XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}));
}
console.log('Created blank template and 10-row demo workbook (6 core matches, 4 ignored, 6 distinct eligible faculty).');
