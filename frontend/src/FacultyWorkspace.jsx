import FacultyReview from './FacultyReview.jsx';
import {money} from './WorkflowShared.jsx';
import React,{useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {BookOpen,ArrowRight,ShieldCheck,CalendarDays} from 'lucide-react';
import {campusDate,semesterName} from './SemesterManagement.jsx';

export default function FacultyWorkspace({api,user,onExpired}){
 const {courseCode}=useParams();
 const [data,setData]=useState(null),[error,setError]=useState(''),[denied,setDenied]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let alive=true;setData(null);setError('');setDenied(false);setLoading(true);
  api(courseCode?`/faculty/courses/${encodeURIComponent(courseCode)}`:'/faculty/courses').then(result=>{if(alive)setData(result);}).catch(e=>{if(!alive)return;if(e.status===401)onExpired();else{setError(e.message);setDenied(e.status===403);}}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[courseCode,refresh]);
 // Recheck permissions when returning to a tab left open during semester changes.
 useEffect(()=>{const recheck=()=>setRefresh(n=>n+1);const visible=()=>{if(document.visibilityState==='visible')recheck();};window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',visible);return()=>{window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',visible);};},[]);
 return <section className="faculty-workspace"><div className="page-crumb"><Link to="/faculty">Faculty dashboard</Link>{courseCode&&<> / {courseCode}</>}</div><div className="semester-heading"><div><span className="section-eyebrow">FACULTY · PA/TA</span><h2>{courseCode?'Course workspace':`Welcome, ${user.name}`}</h2><p>{courseCode?'Your course assignment for the current semester.':'Your assigned core courses for the active semester.'}</p></div><button className="semester-secondary" onClick={()=>setRefresh(n=>n+1)} disabled={loading}>Refresh access</button></div>
 {loading?<p role="status">Checking current semester access…</p>:error?<div className={denied?'faculty-denied':'error'} role="alert"><ShieldCheck size={28}/><h3>{denied?'Access denied':'Unable to load courses'}</h3><p>{error}</p>{denied&&<p>Contact the portal administrator if your course-head assignment needs to be updated.</p>}{courseCode&&<Link to="/faculty">Return to assigned courses</Link>}</div>:data&&<>
 <div className="active-cycle"><CalendarDays size={25}/><div><span>ACTIVE SEMESTER</span><strong>{semesterName(data.semester)}</strong><p>{campusDate(data.semester.application_start)} – {campusDate(data.semester.application_end)} · Dubai time</p></div></div>
 <div className="allocation-amounts"><span>PA assistantship <strong>{money(data.semester.pa_amount)}</strong></span><span>TA assistantship <strong>{money(data.semester.ta_amount)}</strong></span></div>
 {data.course?<article className="faculty-course-detail"><span className="course-code">{data.course.course_code}</span><h2>{data.course.course_name}</h2><p>Course head: <strong>{data.course.faculty_name}</strong></p><p className="faculty-email">{data.course.faculty_email}</p><div className="allocation-pair"><div><strong>{data.course.pa_slots}</strong><span>PA positions allocated</span></div><div><strong>{data.course.ta_slots}</strong><span>TA positions allocated</span></div></div><p className="semester-hint">Allocations are set by Admin. Use the workspace below to adjust faculty requirements and review applicants.</p><FacultyReview key={data.course.id} api={api} course={data.course} onExpired={onExpired}/></article>:<><div className="semester-list-heading"><h3>Assigned courses</h3><span>{data.courses.length} {data.courses.length===1?'course':'courses'}</span></div><div className="faculty-course-grid">{data.courses.map(c=><article className="faculty-course-card" key={c.id}><div className="course-card-top"><span className="course-code">{c.course_code}</span><BookOpen size={22}/></div><h3>{c.course_name}</h3><p>Course head: {c.faculty_name}</p><div className="course-allocation"><span><b>{c.pa_slots}</b> PA positions</span><span><b>{c.ta_slots}</b> TA positions</span></div><Link to={`/faculty/course/${encodeURIComponent(c.course_code.replace(/\s/g,''))}`}>View course <ArrowRight size={17}/></Link></article>)}</div><p className="semester-hint">Only courses assigned to your email in the active semester are shown. Admin controls course assignments and allocations.</p></>}
 </>}
 </section>;
}
