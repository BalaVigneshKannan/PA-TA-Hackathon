import React,{useState} from 'react';
import {Requirements} from './FacultyReview.jsx';
import {useResource,Message} from './WorkflowShared.jsx';
export default function AdminEligibility({api,courses,onExpired,semester}){
 const [id,setId]=useState(''),[role,setRole]=useState('PA');const course=courses.find(c=>c.id===id);const state=useResource(api,course?`/admin/assignments/${id}/criteria`:null,onExpired);
 return <section className="workflow-panel"><h3>Admin eligibility rules</h3><p>Set year, CGPA, required course, grade and interview rules for each course and role. Faculty may edit minimum grade, interview requirement and additional requirement.</p><label>Course<select value={id} onChange={e=>setId(e.target.value)}><option value="">Choose a course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>)}</select></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option>PA</option><option>TA</option></select></label><Message error={state.error}/>{course&&state.data&&<Requirements key={role} admin api={api} course={course} role={role} rule={state.data.criteria.find(r=>r.role===role)} locked={!['DRAFT','ACTIVE'].includes(semester.status)||state.data.applications.some(a=>a.role===role)} onSaved={state.reload} onExpired={onExpired}/>}</section>;
}
