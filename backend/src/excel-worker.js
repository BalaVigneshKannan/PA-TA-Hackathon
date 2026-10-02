import {parentPort,workerData} from 'node:worker_threads';
import * as XLSX from 'xlsx';
try{
 const workbook=XLSX.read(Buffer.from(workerData),{type:'buffer',sheetRows:1002,cellFormula:true});
 if(workbook.SheetNames.length!==1)throw Error('Use exactly one worksheet with the course-head table.');
 const sheet=workbook.Sheets[workbook.SheetNames[0]];
 if(!sheet['!ref'])throw Error('The worksheet is empty.');
 const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']);
 if(range.e.r>1000||range.e.c>19)throw Error('Use at most 1,000 course rows and 20 columns, with headers in row 1.');
 const rows=[];
 for(let r=0;r<=range.e.r;r++){
  const cells=[];for(let c=0;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];cells.push({value:cell?.v??'',formula:!!cell?.f});}rows.push(cells);
 }
 parentPort.postMessage({rows});
}catch(e){parentPort.postMessage({error:e.message||'Unable to read the workbook.'});}
