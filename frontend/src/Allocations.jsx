import React,{useEffect,useState} from 'react';
import AdminEligibility from './AdminEligibility.jsx';
import {semesterName} from './SemesterManagement.jsx';
import {money} from './WorkflowShared.jsx';
const dateInput=value=>new Date(new Date(value).getTime()+4*3600000).toISOString().slice(0,10);
const editable=result=>({...result,semester:{...result.semester,application_start:dateInput(result.semester.application_start),application_end:dateInput(result.semester.application_end)}});
export default function Allocations({api,onExpired}){
 const [semesters,setSemesters]=useState([]),[id,setId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[dirty,setDirty]=useState(false);
 const failed=e=>e.status===401?onExpired():setError(e.message);
 useEffect(()=>{api('/admin/semesters').then(r=>{setSemesters(r.semesters);setId((r.semesters.find(s=>s.status==='ACTIVE')||r.semesters[0])?.id||'');}).catch(failed);},[]);
 useEffect(()=>{let alive=true;setData(null);setError('');setNotice('');setDirty(false);if(id)api(`/admin/semesters/${id}/allocations`).then(r=>{if(alive)setData(editable(r));}).catch(e=>{if(alive)failed(e);});return()=>{alive=false;};},[id,refresh]);
 const locked=busy||!data||!['DRAFT','ACTIVE'].includes(data.semester.status);
 const change=(key,value)=>{setNotice('');setDirty(true);setData(d=>({...d,semester:{...d.semester,[key]:value}}));};
 async function save(e){e.preventDefault();if(locked)return;setBusy(true);setError('');setNotice('');try{const response=await api(`/admin/semesters/${id}/allocations`,{method:'PUT',body:JSON.stringify({pa_amount:data.semester.pa_amount,ta_amount:data.semester.ta_amount,application_start:data.semester.application_start,application_end:data.semester.application_end,courses:data.courses.map(c=>({id:c.id,pa_slots:c.pa_slots===''?null:Number(c.pa_slots),ta_slots:c.ta_slots===''?null:Number(c.ta_slots)}))})});const saved=response.semester?response:await api(`/admin/semesters/${id}/allocations`);setData(editable(saved));setDirty(false);setNotice(`Settings saved. PA amount: ${money(saved.semester.pa_amount)}. TA amount: ${money(saved.semester.ta_amount)}. Faculty and students will see these amounts when they refresh their workspace.`);}catch(e){failed(e);}finally{setBusy(false);}}
 return <section>
  <div className="semester-heading"><div><span className="section-eyebrow">ADMIN / SEMESTER SETUP</span><h2>PA/TA allocations</h2><p>Set course positions, assistantship amounts and application dates.</p></div></div>
  <label className="allocation-select">Semester<select value={id} disabled={busy} onChange={e=>setId(e.target.value)}><option value="">Select a semester</option>{semesters.map(s=><option key={s.id} value={s.id}>{semesterName(s)} ({s.status})</option>)}</select></label>
  {error&&<div className="error" role="alert">{error} <button type="button" onClick={()=>setRefresh(n=>n+1)}>Reload settings</button></div>}
  {notice&&<p className="allocation-success" role="status">{notice}</p>}{id&&!data&&!error&&<p role="status">Loading allocations...</p>}{!id&&<p>Create a semester to configure PA/TA settings.</p>}
  {data&&<form onSubmit={save} onInvalid={e=>{setNotice('');setError(`${e.target.labels?.[0]?.textContent||e.target.getAttribute('aria-label')||'Setting'}: ${e.target.validationMessage}`);}}><fieldset className="allocation-fieldset" disabled={locked}>
   <div className="allocation-settings">{[['pa_amount','PA amount (AED)'],['ta_amount','TA amount (AED)']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" max="99999999.99" step="0.01" required value={data.semester[key]} onChange={e=>change(key,e.target.value)}/></label>)}{[['application_start','Applications open'],['application_end','Applications close']].map(([key,label])=><label key={key}>{label}<input type="date" required value={data.semester[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
   <div className="allocation-save-bar"><p aria-live="polite">{dirty?'Unsaved changes. Click Save PA/TA settings to apply them.':'Edit the amounts above, then save your settings.'}</p><button className="primary allocation-save" type="submit">{busy?'Saving...':'Save PA/TA settings'}</button></div>
   <p className="semester-hint">Amounts apply to every course in this semester. Dates use Dubai time; the closing date includes the full day.</p>
   <div className="allocation-table-wrap"><table className="allocation-table"><thead><tr><th>Core course</th><th>Course head</th><th>PA slots</th><th>TA slots</th></tr></thead><tbody>{data.courses.map((c,i)=><tr key={c.id}><td><strong>{c.course_code}</strong><span>{c.course_name}</span></td><td>{c.faculty_name}</td>{['pa_slots','ta_slots'].map(key=><td key={key}><input aria-label={`${c.course_code} ${key==='pa_slots'?'PA':'TA'} slots`} type="number" min="0" max="10000" step="1" required value={c[key]} onChange={e=>{const value=e.target.value;setNotice('');setDirty(true);setData(d=>({...d,courses:d.courses.map((row,j)=>j===i?{...row,[key]:value}:row)}));}}/></td>)}</tr>)}</tbody></table></div>
   {!data.courses.length&&<p>Upload and confirm course heads to add course allocations.</p>}<button className="primary allocation-save" type="submit">{busy?'Saving...':'Save all settings'}</button>
  </fieldset>{!['DRAFT','ACTIVE'].includes(data.semester.status)&&<p className="semester-hint">This semester is read-only because it is {data.semester.status.toLowerCase()}.</p>}</form>}
  {data&&<AdminEligibility key={id} api={api} courses={data.courses} semester={data.semester} onExpired={onExpired}/>}
 </section>;
}
