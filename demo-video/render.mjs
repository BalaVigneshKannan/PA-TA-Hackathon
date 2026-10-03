import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import path from 'node:path';
const root=fileURLToPath(new URL('./',import.meta.url));
const runtime=path.join(root,'.runtime');
await mkdir(path.join(runtime,'font-cache'),{recursive:true});
const fontConfig=path.join(runtime,'fonts.conf');
await writeFile(fontConfig,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>C:/Windows/Fonts</dir><cachedir>${path.join(runtime,'font-cache').replaceAll('\\','/')}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE=fontConfig;
const req=createRequire(new URL('tools/package.json',import.meta.url));
const sharp=req('sharp'),ffmpeg=req('ffmpeg-static');
const scenes=JSON.parse(await readFile(path.join(root,'scenes.json'),'utf8'));
const W=1920,H=1080;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(value,x,y,size=32,fill='#eef5ff',weight=400)=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`;
function lines(value,max){const result=[];let line='';for(const word of value.split(' ')){if((line+' '+word).trim().length>max&&line){result.push(line);line=word;}else line=(line+' '+word).trim();}if(line)result.push(line);return result;}
function card(x,y,w,h,title,body,accent='#5ee7e0'){
 return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="#11243a" stroke="#28455f"/><rect x="${x+26}" y="${y+28}" width="48" height="5" rx="2" fill="${accent}"/>`+text(title,x+26,y+95,34,'#ffffff',700)+lines(body,Math.floor(w/17)).map((line,i)=>text(line,x+26,y+150+i*42,27,'#b9cedf')).join('');
}
function slide(scene,index){
 let body='';
 if(scene.kind==='title')body=text('PA & TA',120,370,108,'#ffffff',700)+text('Application Automation',120,470,72,'#5ee7e0',700)+text('Academic Administration · BITS Pilani, Dubai Campus',125,555,31,'#b9cedf')+text('Working prototype demonstration',125,624,34,'#ffffff')+`<rect x="1280" y="235" width="460" height="490" rx="32" fill="#11243a" stroke="#345d78"/>`+text('ONE SHARED WORKFLOW',1312,307,24,'#5ee7e0',700)+['Publish forms','Check eligibility','Review candidates','Approve final results','Export selected list'].map((s,i)=>text(`${String(i+1).padStart(2,'0')}  ${s}`,1315,383+i*62,29)).join('');
 if(scene.kind==='problem')body=card(100,230,540,390,'The administrative problem','Collect applications. Check records. Coordinate reviews. Prepare final lists.')+card(690,230,540,390,'The proposed solution','Generate forms from rules. Organize applicants. Enforce access. Preserve approvals.')+card(1280,230,540,390,'A complete cycle','Semester setup through student results and Excel/PDF exports.')+text('CONFIGURE   →   APPLY   →   REVIEW   →   APPROVE   →   EXPORT',165,760,36,'#5ee7e0',700);
 if(scene.kind==='roles')body=card(100,260,540,400,'Admin','Semester dates, course heads, positions, eligibility, vacancies and final approval.')+card(690,260,540,400,'Student','Prefilled applications, eligibility reasons, progress tracking and personal results.')+card(1280,260,540,400,'Faculty','Assigned-course access, applicant review, interviews and selection submission.')+text('Role and course ownership are checked by the backend.',290,780,37,'#5ee7e0',700);
 if(scene.kind==='technology')body=card(100,230,540,310,'React + Vite','Role workspaces and a responsive frontend.')+card(690,230,540,310,'Node.js + Express','Validated API, role checks and revocable sessions.')+card(1280,230,540,310,'PostgreSQL / PGlite','Transactions, migrations and local embedded storage.')+text('BROWSER    →    SAME-ORIGIN API    →    TRANSACTIONAL DATA',210,650,39,'#5ee7e0',700)+card(290,725,1340,175,'Correctness controls','Capacity reservations · Same-role limits · Saved snapshots · Audit history');
 if(scene.kind==='integration')body=card(100,245,820,330,'Local authentication','Hashed passwords and signed cookies backed by revocable database sessions.')+card(1000,245,820,330,'Optional intranet connection','RS256 assertions bind verified campus identities and synchronize academic records.')+`<rect x="210" y="680" width="1500" height="145" rx="24" fill="#163348" stroke="#5ee7e0"/>`+text('Live university integration is still to configure.',330,737,40,'#ffffff',700)+text('Institutional issuer, audience, signing key and authoritative data are required.',300,790,28,'#b9cedf');
 if(scene.kind==='impact')body=card(100,230,540,320,'Reduce repeated entry','Prefilled academics and generated application forms.')+card(690,230,540,320,'Organize reviews','Centralized applications, clear statuses and assigned ownership.')+card(1280,230,540,320,'Preserve decisions','Approved snapshots, exportable lists and audit records.')+text('A CENTRALIZED APPLICATION WORKFLOW',285,678,42,'#5ee7e0',700)+text('Clear status tracking · Organized reviews · Preserved final results',285,741,30,'#ffffff')+text('Expected benefits; no measured time-savings claim.',285,804,27,'#b9cedf');
 if(scene.kind==='closing')body=text('A working end-to-end local prototype',120,305,66,'#ffffff',700)+text('Next steps: university configuration and staged deployment',125,398,37,'#5ee7e0',700)+card(120,475,790,270,'Current scope','Synthetic academic data. Live university SSO and production hosting remain to configure.')+card(990,475,790,270,'Future extension','Duty timetable-overlap detection requires real duty schedules and an overlap engine.')+text('From applications to approved results, in one place.',180,832,36,'#b9cedf');
 return body;
}
function chrome(scene,index){
 const titleLines=lines(scene.title,78);
 return `<rect width="1920" height="1080" fill="#081526"/><defs><linearGradient id="glow" x2="1" y2="1"><stop stop-color="#102f43"/><stop offset="1" stop-color="#081526"/></linearGradient></defs><path d="M1320 0H1920V880Z" fill="url(#glow)"/><rect x="78" y="34" width="7" height="31" rx="3" fill="#5ee7e0"/>`+text(scene.chapter,100,59,23,'#5ee7e0',700)+titleLines.map((line,i)=>text(line,80,112+i*44,38,'#ffffff',700)).join('')+text(`PRESENTER ${scene.presenter}`,1550,57,23,'#9bb3c7')+`<rect x="80" y="990" width="1760" height="2" fill="#264257"/><rect x="80" y="990" width="${1760*(index+1)/scenes.length}" height="2" fill="#5ee7e0"/>`+text(scene.caption,80,1034,27,'#e9f2fb')+text('SYNTHETIC DEMO',1590,1070,17,'#94b0c8');
}
function wavDuration(buffer){
 let rate=0,size=0;
 for(let offset=12;offset+8<=buffer.length;){const kind=buffer.toString('ascii',offset,offset+4),n=buffer.readUInt32LE(offset+4);if(kind==='fmt ')rate=buffer.readUInt32LE(offset+16);if(kind==='data')size=n;offset+=8+n+(n%2);}
 if(!rate||!size)throw new Error('Unsupported narration WAV');
 return size/rate;
}
async function run(args){
 await new Promise((resolve,reject)=>{const child=spawn(ffmpeg,args,{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-8000));child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(stderr)));});
}
await mkdir(path.join(runtime,'frames'),{recursive:true});await mkdir(path.join(runtime,'clips'),{recursive:true});
const rawDurations=await Promise.all(scenes.map(async(_,i)=>wavDuration(await readFile(path.join(runtime,'audio',`${String(i).padStart(2,'0')}.wav`)))));
const padding=.5;
// Pitch-preserving tempo adjustment keeps the complete narrative inside the three-minute limit.
const tempo=Math.max(1,rawDurations.reduce((a,b)=>a+b,0)/(165-padding*scenes.length));
let total=0;const timeline=[];const clips=[];
for(let i=0;i<scenes.length;i++){
 const scene=scenes[i],num=String(i).padStart(2,'0');
 const duration=Math.ceil((rawDurations[i]/tempo+padding)*30)/30;
 const background=Buffer.from(`<svg width="1920" height="1080">${chrome(scene,i)}${scene.kind?slide(scene,i):''}</svg>`);
 const layers=[];
 if(scene.image){
  const screenshot=await sharp(path.join(runtime,'captures',scene.image)).resize(1760,820,{fit:'inside'}).png().toBuffer();
  const meta=await sharp(screenshot).metadata();
  layers.push({input:screenshot,left:Math.round((W-meta.width)/2),top:Math.round(155+(820-meta.height)/2)});
 }
 const frame=path.join(runtime,'frames',`${num}.png`);
 await sharp(background).composite(layers).png().toFile(frame);
 const clip=path.join(runtime,'clips',`${num}.mp4`);clips.push(clip);
 await run(['-hide_banner','-loglevel','error','-y','-loop','1','-framerate','30','-i',frame,'-i',path.join(runtime,'audio',`${num}.wav`),'-vf',`fade=t=in:st=0:d=0.18,fade=t=out:st=${(duration-.15).toFixed(3)}:d=0.15,format=yuv420p`,'-af',`atempo=${tempo.toFixed(6)},apad,atrim=duration=${duration},afade=t=out:st=${(duration-.12).toFixed(3)}:d=0.12`,'-t',String(duration),'-c:v','libx264','-preset','veryfast','-crf','21','-threads','2','-c:a','aac','-b:a','128k','-ar','48000','-ac','2',clip]);
 timeline.push({...scene,start:Number(total.toFixed(3)),duration:Number(duration.toFixed(3))});total+=duration;
 console.log(`Rendered scene ${i+1}/${scenes.length} (${duration.toFixed(1)} seconds)`);
}
if(total>=180)throw new Error(`Demo exceeds limit: ${total}`);
const concat=path.join(runtime,'concat.txt');await writeFile(concat,clips.map(file=>`file '${file.replaceAll('\\','/')}'`).join('\n'));
const output=path.join(root,'PA-TA-Demo.mp4');
await run(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',concat,'-c:v','copy','-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart',output]);
const time=value=>{const ms=Math.round(value*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
let srt='',cue=0;
for(const scene of timeline){
 const sentences=scene.narration.match(/[^.!?]+[.!?]+/g)||[scene.narration];
 const length=sentences.reduce((sum,s)=>sum+s.length,0);let at=scene.start;
 for(const sentence of sentences){const end=at+(scene.duration-padding)*sentence.length/length;srt+=`${++cue}\n${time(at)} --> ${time(end)}\n${lines(sentence.trim(),66).join('\n')}\n\n`;at=end;}
}
await writeFile(path.join(root,'PA-TA-Demo.srt'),srt.trimEnd()+'\n');
await writeFile(path.join(root,'timeline.json'),JSON.stringify({duration:Number(total.toFixed(3)),width:W,height:H,fps:30,narrationTempo:Number(tempo.toFixed(4)),scenes:timeline},null,2));
await writeFile(path.join(root,'TRANSCRIPT.md'),'# Demo video narration\n\n'+timeline.map(scene=>`## ${time(scene.start).slice(0,8)} — ${scene.title}\n\n${scene.narration}\n`).join('\n'));

const groups=[1,2,3,4].map(presenter=>timeline.filter(scene=>scene.presenter===presenter));
const humanNarration=value=>value.replaceAll('C G P A','CGPA').replaceAll('P G Lite','PGlite').replaceAll('P D F','PDF').replaceAll('P A','PA').replaceAll('T A','TA');
const clock=value=>time(value).slice(3,8);
const topics=['Problem, solution, users and Admin setup','Student application flow and Faculty access','Faculty review, selection and interviews','Final approval, technical choices and impact'];
const humanWords=timeline.reduce((count,scene)=>count+humanNarration(scene.narration).split(/\s+/).length,0);
const script='# Four-presenter demonstration script\n\nVideo duration: '+clock(total)+'. Spoken script: '+humanWords+' words. At 135 words per minute, allow roughly '+Math.ceil(humanWords/135*60)+' seconds plus brief handoffs, staying below three minutes. Do not read headings or screen cues aloud.\n\n'+groups.map((group,i)=>'## Presenter '+(i+1)+' - '+clock(group[0].start)+' to '+clock(group.at(-1).start+group.at(-1).duration)+'\n\n**'+topics[i]+'**\n\n*On screen: '+group.map(scene=>scene.title).join('; ')+'.*\n\n'+group.map(scene=>humanNarration(scene.narration)).join(' ')+'\n').join('\n');
await writeFile(path.join(root,'FOUR-PERSON-SCRIPT.md'),script);
await writeFile(path.join(root,'FOUR-PERSON-SCRIPT.txt'),script.replaceAll('**','').replaceAll('*','').replace(/^#+ /gm,''));

await sharp(path.join(runtime,'frames','00.png')).resize(1280,720).png().toFile(path.join(root,'poster.png'));
console.log(`Video ready: ${output}; duration ${total.toFixed(2)} seconds.`);
