'use strict';

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 11h18"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h2m4 0h2"/>',
  chart:'<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  settings:'<path d="m9 3-.7 2.2-2 .8-2.1-.5-2 3.4 1.5 1.7v2.8l-1.5 1.7 2 3.4 2.2-.5 1.9.8L9 21h4l.7-2.2 2-.8 2.1.5 2-3.4-1.5-1.7v-2.8l1.5-1.7-2-3.4-2.2.5-1.9-.8L13 3Z"/><circle cx="11" cy="12" r="3"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  school:'<path d="m3 10 9-6 9 6M5 9v12h14V9M9 21v-6h6v6M2 21h20M12 4V1h5l-1 2h-4"/><path d="M9 11h.01M15 11h.01"/>',
  sprout:'<path d="M12 22V12m0 5C4 18 1 11 4 6c6-1 10 3 8 11Zm0-4c-1-7 4-11 10-10 1 6-2 11-10 10Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  'chevron-right':'<path d="m9 5 7 7-7 7"/>',
  'chevron-left':'<path d="m15 5-7 7 7 7"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  circlecheck:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  edit:'<path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Zm9 0h8"/>',
  archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M10 12h4"/>',
  note:'<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Zm0 0v7h7M7 13h10M7 17h7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2"/>',
  shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>'
};
const icon = name => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.note}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const $ = selector => document.querySelector(selector);
const CATEGORIES = ['Academic','Career','Personal','Behavioral','Family','Attendance'];
const STATUSES = ['Open','In progress','Resolved'];
const PAGES = {overview:'Overview',records:'Guidance records',students:'Students',appointments:'Appointments',reports:'Reports',settings:'Workspace settings'};
let state, page = 'overview', busy = false, sampleDismissed = false, previousFocus;
let recordFilters = {q:'',status:'All',category:'All',priority:'All',sort:'newest',due:false,page:1};
let studentFilters = {q:'',grade:'All'};
let appointmentFilter = 'Upcoming', selectedDay = '', calendarMonth = '';
let reportFrom = '', reportTo = '';
let toastTimer;
let authInfo=null,authToken='',expiryTimer;
const sessionChannel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('guidancedesk-session'):null;
if(sessionChannel)sessionChannel.onmessage=event=>{if(event.data==='changed')startWorkspace();};

const fullName = student => student ? `${student.first_name} ${student.last_name}` : 'Unknown student';
const studentById = id => state.students.find(student => student.id === Number(id));
const recordById = id => state.records.find(record => record.id === Number(id));
const activeRecords = () => state.records.filter(record => !record.archived);
const isDue = record => !record.archived && record.status !== 'Resolved' && record.follow_up && record.follow_up <= state.today;
const dateObj = date => new Date(`${date.slice(0,10)}T12:00:00`);
const dateLabel = (date, options = {month:'short',day:'numeric'}) => date ? dateObj(date).toLocaleDateString('en-US',options) : 'Not set';
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const timeLabel = time => { const [h,m] = time.split(':').map(Number); return `${h%12 || 12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const initials = text => text.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const avatar = (student, size='') => `<span class="avatar c${(student?.id || 0)%5}" ${size}>${esc(initials(fullName(student)))}</span>`;
const pill = status => `<span class="pill ${status.toLowerCase().replace(/ /g,'-')}">${esc(status)}</span>`;
const recordCode = record => `GR-${record.opened_on.slice(0,4)}-${String(record.id).padStart(4,'0')}`;
const priority = value => `<span class="priority ${value.toLowerCase()}"><i></i>${esc(value)}</span>`;
const button = (label,action,name='plus',type='primary',extra='') => `<button type="button" class="button ${type}" data-action="${action}" ${extra}>${icon(name)}${label}</button>`;
const empty = (title,copy='',action='') => `<div class="empty-state">${icon('sprout')}<strong>${title}</strong><p>${copy}</p>${action}</div>`;

function populateIcons(root=document) { root.querySelectorAll('[data-icon]').forEach(node => node.innerHTML = icon(node.dataset.icon)); }
function toast(message,error=false) {
  clearTimeout(toastTimer); const node=$('#toast'); node.textContent=message;
  node.className=`visible${error?' error':''}`;
  toastTimer=setTimeout(()=>node.className='',4200);
}
async function request(endpoint,values) {
  const options={headers:{'X-Guidance-Token':authToken||state?.csrf_token||''},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)};
  if(values) { options.method='POST'; options.body=new URLSearchParams(values); }
  let response;
  try { response=await fetch(endpoint,options); }
  catch { throw new Error('Cannot reach the local app. Make sure GuidanceDesk is still running, then try again.'); }
  const data=await response.json();
  if(!response.ok) {
    const error=new Error(data.error||'The request could not be completed.');error.status=response.status;
    if(response.status===401&&!['/api/auth/login','/api/auth/setup'].includes(endpoint)) await startWorkspace('Your session ended. Sign in again to continue.');
    if(response.status===503) showLockedWorkspace(error.message);
    throw error;
  }
  return data;
}
async function refresh() {
  state=await request('/api/state');
  armExpiry(state.expires_in_seconds);
  calendarMonth ||= state.today.slice(0,7);
  updateShell();
  render();
}
function updateShell() {
  $('#school-name').textContent=state.settings.school_name;
  $('#workspace-name').textContent=state.settings.workspace_name;
  $('#user-name').textContent=state.account.display_name;
  $('#user-initials').textContent=initials(state.account.display_name);
  $('#footer-year').textContent=`School year ${state.settings.school_year}`;
  $('#record-count').textContent=activeRecords().filter(record=>record.status!=='Resolved').length;
  $('#notification-dot').hidden=!state.records.some(isDue);
}
function navigate(next) {
  page=Object.hasOwn(PAGES,next)?next:'overview';
  if(location.hash!==`#${page}`) location.hash=page; else render();
  closeSearch(); closeMenu();
}
function render(preserveFocus=false) {
  if(!state) return;
  const focused=preserveFocus?document.activeElement:null;
  const id=focused?.id, start=focused?.selectionStart, end=focused?.selectionEnd;
  $('#page-name').textContent=PAGES[page];
  document.title=`${PAGES[page]} · GuidanceDesk`;
  document.querySelectorAll('[data-nav]').forEach(item=>{
    item.classList.toggle('active',item.dataset.nav===page);
    if(item.dataset.nav===page) item.setAttribute('aria-current','page'); else item.removeAttribute('aria-current');
  });
  const views={overview:overviewPage,records:recordsPage,students:studentsPage,appointments:appointmentsPage,reports:reportsPage,settings:settingsPage};
  $('#content').innerHTML=views[page]();
  populateIcons($('#content'));
  if(id) { const replacement=document.getElementById(id); if(replacement) { replacement.focus({preventScroll:true}); if(typeof start==='number' && ['text','search'].includes(replacement.type)) replacement.setSelectionRange(start,end); } }
}
function pageHeading(title,copy,actions='',eyebrow='YOUR GUIDANCE WORKSPACE') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${copy}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statsCards() {
  const records=activeRecords(), active=records.filter(record=>record.status!=='Resolved').length;
  const resolved=records.length-active, due=records.filter(isDue).length;
  const cards=[['Total students',state.students.length,'In your student directory','users','students',''],['Active records',active,'Open & in progress','folder','active-records',''],['Follow-ups due',due,'Ready for your attention','clock','due',due?'attention':''],['Resolved records',resolved,`${records.length?Math.round(resolved/records.length*100):0}% of all guidance records`,'circlecheck','resolved-records','']];
  return `<div class="stats-grid">${cards.map(([label,count,detail,name,action,cls])=>`<button class="stat-card" data-action="${action}"><span class="stat-label">${label}</span><span class="stat-icon">${icon(name)}</span><strong class="stat-number">${count}</strong><span class="stat-detail ${cls}">${detail}</span></button>`).join('')}</div>`;
}
function activityChart(records=activeRecords()) {
  const months=Array.from({length:6},(_,i)=>{const d=dateObj(state.today); d.setDate(1); d.setMonth(d.getMonth()-5+i); return {key:dayKey(d).slice(0,7),label:d.toLocaleDateString('en-US',{month:'short'})};});
  months.forEach(month=>{month.total=records.filter(record=>record.opened_on.startsWith(month.key)).length; month.resolved=records.filter(record=>record.opened_on.startsWith(month.key)&&record.status==='Resolved').length;});
  const max=Math.max(4,...months.map(month=>month.total));
  const cap=Math.ceil(max/4)*4;
  return `<div class="activity-chart"><div class="chart-area" role="img" aria-label="Records opened by month: ${months.map(month=>`${month.label} ${month.total}, ${month.resolved} resolved`).join('; ')}"><div class="chart-y">${[cap,cap*.75,cap*.5,cap*.25,0].map(value=>`<span>${value}</span>`).join('')}</div>${months.map(month=>`<div class="bar-group" title="${month.label}: ${month.total} records, ${month.resolved} resolved"><div class="bar" style="height:${month.total/cap*100}%"></div><div class="bar resolved" style="height:${month.resolved/cap*100}%"></div></div>`).join('')}</div><div class="month-labels">${months.map(month=>`<span>${month.label}</span>`).join('')}</div></div>`;
}
function statusDonut(records=activeRecords()) {
  const counts=STATUSES.map(status=>records.filter(record=>record.status===status).length);
  const total=records.length||1, a=counts[0]/total*100, b=(counts[0]+counts[1])/total*100;
  return `<div class="status-body"><div class="donut" style="background:${records.length?`conic-gradient(#dbc48e 0% ${a}%,#aab4cf ${a}% ${b}%,#8aa27a ${b}% 100%)`:'#edf2e7'}" role="img" aria-label="${counts[0]} open, ${counts[1]} in progress, ${counts[2]} resolved"><div class="donut-center"><strong>${records.length}</strong><span>Total records</span></div></div><div class="status-legend">${STATUSES.map((status,i)=>`<div><i class="legend-dot" style="background:${['#dbc48e','#aab4cf','#8aa27a'][i]}"></i>${status}<strong>${counts[i]}</strong></div>`).join('')}</div></div>`;
}
function studentCell(student) {
  return `<button class="student-cell" data-student="${student.id}">${avatar(student)}<span><strong>${esc(fullName(student))}</strong><small>${esc(student.grade)} · ${esc(student.section_name||student.school_id)}</small></span></button>`;
}
function followupCell(record) {
  const due=isDue(record),overdue=due&&record.follow_up<state.today;
  return `<span class="date-cell ${due?'overdue':''}">${record.follow_up?dateLabel(record.follow_up):'—'}${due?`<small>${overdue?'Overdue':'Due today'}</small>`:''}</span>`;
}
function recordTable(records,compact=false) {
  if(!records.length) return empty('No records to show','Try a different filter, or start a new guidance record.',button('New record','new-record'));
  return `<div class="table-wrap"><table><thead><tr><th>Student</th><th>Guidance record</th>${compact?'':'<th>Category</th>'}<th>Status</th>${compact?'':'<th>Priority</th>'}<th class="${compact?'hide-medium':''}">Follow-up</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${records.map(record=>`<tr><td>${studentCell(studentById(record.student_id))}</td><td><button class="link-button" data-record="${record.id}">${esc(record.title)}<span class="record-code">${recordCode(record)}${compact?` · ${esc(record.category)}`:''}</span></button></td>${compact?'':`<td><span class="category">${esc(record.category)}</span></td>`}<td>${pill(record.archived?'Archived':record.status)}</td>${compact?'':`<td>${priority(record.priority)}</td>`}<td class="${compact?'hide-medium':''}">${followupCell(record)}</td><td><button class="icon-button" data-record="${record.id}" aria-label="Open ${esc(record.title)}">${icon('chevron-right')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function overviewPage() {
  const todayAppts=state.appointments.filter(appointment=>appointment.day===state.today&&appointment.status==='Scheduled');
  const recent=activeRecords().slice(0,5);
  return `${pageHeading('Guidance overview','Keep every conversation, next step, and student in view.',button('New guidance record','new-record'),'WELCOME BACK, '+esc(state.settings.counselor_name.split(' ')[0]).toUpperCase())}
  ${state.settings.sample_data==='true'&&!sampleDismissed?`<div class="sample-banner">${icon('info')}<span><strong>Sample workspace.</strong> All names and records are fictional. Your changes are saved on this computer.</span><button data-action="dismiss-sample" aria-label="Dismiss sample notice">${icon('close')}</button></div>`:''}
  ${statsCards()}
  <div class="overview-charts"><section class="panel"><div class="panel-head"><div><h2>Case activity</h2><p>A little progress, month by month.</p></div><div class="chart-legend"><span><i class="legend-dot" style="background:#dce6c8"></i>All records</span><span><i class="legend-dot" style="background:#668663"></i>Resolved</span></div><span class="tag">Last 6 months</span></div>${activityChart()}</section><section class="panel"><div class="panel-head"><div><h2>A look at your caseload</h2><p>Every record has a next step.</p></div></div>${statusDonut()}</section></div>
  <div class="overview-bottom"><section class="panel"><div class="panel-head"><div><h2>Recent guidance records</h2><p>Pick up where you left off.</p></div><button class="text-button" data-action="records">View all ${icon('arrow')}</button></div>${recordTable(recent,true)}<div class="panel-footer"><span>${activeRecords().length} records in your workspace</span><span>Saved to SQL ${icon('check')}</span></div></section>
  <section class="panel"><div class="panel-head"><div><h2>Today's appointments</h2><p>${dateLabel(state.today,{weekday:'long',month:'short',day:'numeric'})}</p></div><span class="tag">${todayAppts.length} scheduled</span></div><div class="schedule-list">${todayAppts.slice(0,4).map(appointment=>`<button class="schedule-item" data-appointment="${appointment.id}"><span class="schedule-time">${timeLabel(appointment.starts_at).split(' ')[0]}<small>${timeLabel(appointment.starts_at).split(' ')[1]} · ${appointment.duration} min</small></span><span class="schedule-info"><strong>${esc(fullName(studentById(appointment.student_id)))}</strong><p>${esc(studentById(appointment.student_id).grade)} · ${esc(appointment.title)}</p><span>${esc(appointment.location_name)}</span></span></button>`).join('')||empty('A little breathing room','No appointments scheduled for today.')}</div><div class="schedule-bottom"><span>Your time makes a difference.</span><button class="text-button" data-action="appointments">View calendar ${icon('arrow')}</button></div></section></div>`;
}
function filteredRecords() {
  const f=recordFilters,q=f.q.toLowerCase();
  let records=state.records.filter(record=>{
    if(f.status==='Archived'?!record.archived:record.archived) return false;
    if(STATUSES.includes(f.status)&&record.status!==f.status) return false;
    if(f.due&&!isDue(record)) return false;
    if(f.category!=='All'&&record.category!==f.category) return false;
    if(f.priority!=='All'&&record.priority!==f.priority) return false;
    const student=studentById(record.student_id);
    return !q||[record.title,recordCode(record),record.summary,fullName(student),student.school_id,record.counselor].some(value=>value.toLowerCase().includes(q));
  });
  records.sort((a,b)=>f.sort==='oldest'?a.opened_on.localeCompare(b.opened_on)||a.id-b.id:f.sort==='followup'?(a.follow_up||'9999').localeCompare(b.follow_up||'9999'):b.updated_at.localeCompare(a.updated_at)||b.id-a.id);
  return records;
}
function recordsPage() {
  const list=filteredRecords(),pages=Math.max(1,Math.ceil(list.length/8));
  recordFilters.page=Math.min(recordFilters.page,pages);
  const f=recordFilters,offset=(f.page-1)*8;
  return `${pageHeading('Guidance records','The full story, with every next step in one place.',button('Export all','export','download','secondary')+button('New record','new-record'))}<section class="panel"><div class="tabs" role="tablist" aria-label="Record status">${['All',...STATUSES,'Archived'].map(status=>{const count=state.records.filter(record=>status==='Archived'?record.archived:!record.archived&&(status==='All'||record.status===status)).length;return `<button class="tab ${status===f.status?'active':''}" data-record-status="${status}" role="tab" aria-selected="${status===f.status}">${status==='All'?'All records':status}<span>${count}</span></button>`;}).join('')}</div><div class="table-tools"><div class="search-field">${icon('search')}<input id="record-search" type="search" placeholder="Search records or students…" value="${esc(f.q)}" aria-label="Search guidance records"></div><select id="record-category" aria-label="Filter by category">${options(['All',...CATEGORIES],f.category,'All categories')}</select><select id="record-priority" aria-label="Filter by priority">${options(['All','High','Normal','Low'],f.priority,'All priorities')}</select><select id="record-sort" class="tools-end" aria-label="Sort records">${[['newest','Recently updated'],['oldest','Oldest first'],['followup','Follow-up date']].map(([value,label])=>`<option value="${value}" ${value===f.sort?'selected':''}>${label}</option>`).join('')}</select>${f.due?'<button class="filter-chip active" data-action="clear-due">Follow-ups due ×</button>':''}</div>${recordTable(list.slice(offset,offset+8))}<div class="panel-footer"><span>${list.length?`${offset+1}–${Math.min(offset+8,list.length)} of ${list.length}`:'0'} records</span><div class="pagination"><button data-page="${f.page-1}" ${f.page===1?'disabled':''} aria-label="Previous page">${icon('chevron-left')}</button><button class="current" aria-label="Current page ${f.page}">${f.page}</button><button data-page="${f.page+1}" ${f.page===pages?'disabled':''} aria-label="Next page">${icon('chevron-right')}</button></div></div></section>`;
}
function options(values,current,allLabel='All') { return values.map(value=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(value==='All'?allLabel:value)}</option>`).join(''); }
function studentsPage() {
  const q=studentFilters.q.toLowerCase(),grades=[...new Set(state.students.map(student=>student.grade))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const students=state.students.filter(student=>(studentFilters.grade==='All'||student.grade===studentFilters.grade)&&(!q||[fullName(student),student.school_id,student.section_name].some(value=>value.toLowerCase().includes(q))));
  return `${pageHeading('Student directory','Know the person behind every record.',button('Add student','new-student','users'))}<section class="panel"><div class="table-tools directory-tools"><div class="search-field">${icon('search')}<input id="student-search" type="search" placeholder="Search by name or student ID…" value="${esc(studentFilters.q)}" aria-label="Search students"></div><select id="student-grade" aria-label="Filter by grade">${options(['All',...grades],studentFilters.grade,'All grade levels')}</select><span class="count-label">${students.length} students</span></div>${students.length?`<div class="directory-grid">${students.map(student=>{const records=activeRecords().filter(record=>record.student_id===student.id);return `<button class="student-card" data-student="${student.id}"><div class="student-card-top">${avatar(student)}${icon('chevron-right')}</div><h3>${esc(fullName(student))}</h3><p>${esc(student.school_id)}</p><div class="student-card-bottom"><span>${esc(student.grade)} · ${esc(student.section_name||'No section')}</span><strong>${records.filter(record=>record.status!=='Resolved').length} active records</strong></div></button>`;}).join('')}</div>`:empty('No students found','Try a different search, or add a student to get started.',button('Add student','new-student','users'))}<div class="panel-footer"><span>${students.length} of ${state.students.length} students</span><span>Every student, a story.</span></div></section>`;
}
function appointmentsPage() {
  let list=state.appointments.filter(appointment=>selectedDay?appointment.day===selectedDay:appointmentFilter==='Upcoming'?appointment.day>=state.today&&appointment.status==='Scheduled':appointmentFilter==='All'?true:appointment.status===appointmentFilter);
  const title=selectedDay?dateLabel(selectedDay,{weekday:'long',month:'short',day:'numeric'}):appointmentFilter==='Upcoming'?'Coming up next':`${appointmentFilter} appointments`;
  return `${pageHeading('Appointments','Make room for the conversations that matter.',button('Schedule appointment','new-appointment','calendar'))}<div class="appointments-layout"><section class="panel calendar-panel"><div class="panel-head calendar-controls"><strong>${dateLabel(calendarMonth+'-01',{month:'long',year:'numeric'})}</strong><button class="text-button" data-action="calendar-today">Today</button><button class="icon-button" data-action="calendar-prev" aria-label="Previous month">${icon('chevron-left')}</button><button class="icon-button" data-action="calendar-next" aria-label="Next month">${icon('chevron-right')}</button></div>${calendarView()}<div class="panel-footer"><span>Choose a day to view its appointments.</span><button class="text-button" data-action="new-appointment">Schedule ${icon('plus')}</button></div></section><section class="panel"><div class="panel-head"><div><h2>${title}</h2><p>${list.length} appointment${list.length!==1?'s':''}${selectedDay?' on this day':''}</p></div>${selectedDay?'<button class="text-button" data-action="clear-day">Show all</button>':''}</div><div class="filter-chip-row">${['Upcoming','Completed','Cancelled','All'].map(filter=>`<button class="filter-chip ${filter===appointmentFilter&&!selectedDay?'active':''}" data-appointment-filter="${filter}">${filter}</button>`).join('')}</div><div class="appointment-list">${list.map(appointment=>appointmentCard(appointment)).join('')||empty('Nothing scheduled here','Choose another day or schedule a new conversation.',button('Schedule appointment','new-appointment','calendar'))}</div></section></div>`;
}
function calendarView() {
  const first=dateObj(calendarMonth+'-01'),offset=(first.getDay()+6)%7,last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  return `<div class="calendar"><div class="calendar-grid">${['M','T','W','T','F','S','S'].map((day,i)=>`<span class="calendar-weekday" aria-label="${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]}">${day}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:last},(_,index)=>{const key=`${calendarMonth}-${String(index+1).padStart(2,'0')}`,count=state.appointments.filter(a=>a.day===key&&a.status==='Scheduled').length;return `<button class="calendar-day ${key===state.today?'today':''} ${key===selectedDay?'selected':''}" data-day="${key}" aria-label="${dateLabel(key,{month:'long',day:'numeric'})}, ${count} scheduled appointments" aria-pressed="${key===selectedDay}">${index+1}${count?'<i></i>':''}</button>`;}).join('')}</div><div class="calendar-note"><i></i>Scheduled appointment</div></div>`;
}
function appointmentCard(appointment) {
  const student=studentById(appointment.student_id);
  return `<article class="appointment-card"><div class="appointment-card-heading"><div>${dateLabel(appointment.day,{month:'short',day:'numeric'})} · <strong>${timeLabel(appointment.starts_at)}</strong> <span>(${appointment.duration} min)</span></div>${pill(appointment.status)}</div><div class="appointment-card-body">${avatar(student)}<div><strong>${esc(fullName(student))}</strong><p>${esc(appointment.title)}</p></div><button class="icon-button" data-appointment="${appointment.id}" aria-label="Edit appointment with ${esc(fullName(student))}">${icon('edit')}</button></div><div class="appointment-card-meta"><span>${icon('location')}${esc(appointment.location_name)}</span><span>${esc(appointment.counselor)}</span></div></article>`;
}
function reportsPage() {
  const records=activeRecords().filter(record=>(!reportFrom||record.opened_on>=reportFrom)&&(!reportTo||record.opened_on<=reportTo));
  const total=records.length,resolved=records.filter(record=>record.status==='Resolved').length;
  return `${pageHeading('Reports & insights','See the patterns. Plan the next step.',button('Export all records','export','download','secondary'))}<section class="panel report-filters"><label>From<input type="date" id="report-from" value="${reportFrom}" aria-label="Report start date"></label><label>To<input type="date" id="report-to" value="${reportTo}" aria-label="Report end date"></label><button class="button soft" data-action="report-reset">All time</button><span>Filtered by record date · ${total} records · excludes archived</span></section><div class="stats-grid">${[['Guidance records',total,'Within the selected period','folder'],['Students supported',new Set(records.map(record=>record.student_id)).size,'With at least one record','users'],['Resolution rate',`${total?Math.round(resolved/total*100):0}%`,'Resolved / total records','circlecheck'],['Follow-ups due',records.filter(isDue).length,'Open or in progress','clock']].map(([label,value,copy,name])=>`<div class="stat-card"><span class="stat-label">${label}</span><span class="stat-icon">${icon(name)}</span><strong class="stat-number">${value}</strong><span class="stat-detail">${copy}</span></div>`).join('')}</div><div class="reports-grid"><section class="panel"><div class="panel-head"><div><h2>Where students need support</h2><p>Guidance records by category.</p></div></div><div class="category-bars">${CATEGORIES.map((category,i)=>{const count=records.filter(record=>record.category===category).length;return `<div class="category-bar-row"><div class="category-bar-label"><span>${category}</span><strong>${count} <span class="subtle-note">(${total?Math.round(count/total*100):0}%)</span></strong></div><div class="bar-track"><div class="bar-fill" style="width:${total?count/total*100:0}%;background:${['#849e70','#a7b88e','#c6cda9','#b5bea4','#c7c49e','#d7ccb1'][i]}"></div></div></div>`;}).join('')}</div></section><div><section class="panel"><div class="panel-head"><div><h2>Record status</h2><p>Your selected period at a glance.</p></div></div>${statusDonut(records)}</section><section class="panel" style="margin-top:22px"><div class="panel-head"><h2>Next steps at a glance</h2></div><div class="insight-list"><div class="insight"><span>${icon('clock')}</span><div><p>Overdue follow-ups</p><small>Follow-up date is before today</small></div><strong>${records.filter(record=>isDue(record)&&record.follow_up<state.today).length}</strong></div><div class="insight"><span>${icon('folder')}</span><div><p>High-priority active records</p><small>Open or in progress</small></div><strong>${records.filter(record=>record.priority==='High'&&record.status!=='Resolved').length}</strong></div></div></section></div></div>`;
}
function workspaceDetailsPage() {
  return `${pageHeading('Workspace settings','Make this space your own.')}<div class="settings-grid"><section class="panel"><div class="panel-head"><div><h2>Workspace details</h2><p>Used across your records and appointments.</p></div></div><form id="settings-form" class="settings-form" data-endpoint="/api/settings/save"><input type="hidden" name="version" value="${state.settings.workspace_version}"><div class="form-error" hidden role="alert"></div><div class="form-grid">${field('School name','school_name',state.settings.school_name,'text',true,120,'full')}${field('Workspace name','workspace_name',state.settings.workspace_name,'text',true,120,'full')}${field('Counselor name','counselor_name',state.settings.counselor_name,'text',true,120)}${field('School year','school_year',state.settings.school_year,'text',true,30)}</div><button class="button primary" type="submit" style="margin-top:25px">${icon('check')}Save changes</button></form></section><section class="panel"><div class="panel-head"><div><h2>Your data, close to home</h2><p>A local workspace on this computer.</p></div></div><div class="storage-card"><p>Changes are saved automatically to the SQL database after you submit a form. Export a SQL backup to keep a restorable copy of your workspace.</p><div class="storage-detail"><span>Storage</span><strong>Local SQL database</strong></div><div class="storage-detail"><span>Workspace</span><strong>${state.settings.sample_data==='true'?'Started with sample data':'Blank workspace'}</strong></div><div class="storage-detail"><span>Student directory</span><strong>${state.students.length} students</strong></div><div class="storage-detail"><span>Guidance records</span><strong>${state.records.length} total</strong></div><div class="storage-actions">${button('Download SQL backup','backup','download','secondary')}${button('Export all records as CSV','export','download','soft')}</div><p class="subtle-note" style="margin:17px 0 0">Owner sign-in protects this local workspace. Keep the matching integrity key with your backups. This demonstration app is intended for one computer.</p></div></section></div>`;
}

let fieldNumber=0;
function settingsPage() {
  const labels={'BASELINE':'Integrity baseline created','auth/setup':'Owner account created','auth/password':'Passphrase changed','students/save':'Student saved','records/save':'Guidance record saved','records/archive':'Record archived or restored','notes/add':'Case note added','appointments/save':'Appointment saved','appointments/status':'Appointment status changed','settings/save':'Workspace settings changed','LOGIN_SUCCEEDED':'Signed in','LOGIN_FAILED':'Sign-in attempt failed','LOGOUT':'Signed out','EXPORT_CSV':'Records exported','EXPORT_SQL':'SQL backup exported'};
  return workspaceDetailsPage()+`<section class="panel security-panel"><div class="panel-head"><div><h2>Security & activity</h2><p>Signed in as ${esc(state.account.username)}. Sessions lock after 15 minutes without an app request.</p></div>${button('Change passphrase','change-password','shield','secondary')}</div><div class="security-summary">${icon('shield')}<strong>Integrity verified</strong><span>Record changes and this audit trail are checked before data is read or saved.</span></div><div class="table-wrap"><table class="audit-table"><thead><tr><th>Activity</th><th>Account</th><th>Time · Asia/Manila</th></tr></thead><tbody>${state.audit.map(event=>`<tr><td>${esc(labels[event.action_name]||'Workspace activity')}${event.entity_id?` <small>#${esc(event.entity_id)}</small>`:''}</td><td>${esc(event.actor)}</td><td>${esc(new Date(event.occurred_at).toLocaleString('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</td></tr>`).join('')}</tbody></table></div><div class="panel-footer"><span>${state.security.audit_count} verified events</span><span>Showing the latest ${state.audit.length}</span></div></section>`;
}

function clearPrivateView() {
  clearTimeout(expiryTimer);closeModal();state=null;
  $('#content').innerHTML='';$('#global-results').innerHTML='';$('#global-search').value='';
  $('#user-name').textContent='Counselor';$('#user-initials').textContent='';$('#school-name').textContent='School workspace';$('#footer-year').textContent='';$('#record-count').textContent='0';
  recordFilters={q:'',status:'All',category:'All',priority:'All',sort:'newest',due:false,page:1};studentFilters={q:'',grade:'All'};
  $('.sidebar').hidden=true;$('.app-shell').hidden=true;closeMenu();document.body.classList.add('workspace-locked');
}
function showAuth(info,message='') {
  clearPrivateView();authInfo=info;authToken=info.csrf_token;
  const setup=!info.configured;
  $('#auth-root').hidden=false;
  $('#auth-root').innerHTML=`<main class="auth-layout"><section class="auth-intro"><a class="auth-brand" href="#overview">${icon('sprout')}GuidanceDesk</a><div><h2>A place for every conversation.</h2><p>Student records, thoughtful follow-ups, and the next step forward. Keep them together in your local guidance workspace.</p></div><p class="auth-local">${icon('shield')}Owner access · Saved on this computer</p></section><section class="auth-content"><div class="auth-mobile-brand">${icon('sprout')} GuidanceDesk</div><h1>${setup?'Set up your workspace':'Welcome back'}</h1><p class="auth-description">${setup?'Create the owner account to protect your guidance records on this computer.':'Sign in to open your guidance workspace.'}</p>${message?`<div class="auth-message" role="status">${esc(message)}</div>`:''}<form id="auth-form" data-endpoint="/api/auth/${setup?'setup':'login'}"><div class="form-error" role="alert" hidden></div>${setup?'<label class="auth-field">Your name<input name="display_name" autocomplete="name" required maxlength="80" placeholder="Your name"></label>':''}<label class="auth-field">Username<input name="username" autocomplete="username" required minlength="3" maxlength="40" ${setup?'pattern="[A-Za-z0-9._-]{3,40}"':''} spellcheck="false" autocapitalize="none" placeholder="Your username"></label><div class="auth-field"><label for="auth-password">Passphrase</label><span class="password-control"><input id="auth-password" name="password" type="password" autocomplete="${setup?'new-password':'current-password'}" required ${setup?'minlength="15"':''} maxlength="256" aria-describedby="passphrase-hint"><button type="button" data-action="toggle-password" data-target="auth-password" aria-pressed="false" aria-label="Show passphrase">Show</button></span></div>${setup?'<p class="auth-hint" id="passphrase-hint">Use 15–128 characters. A few memorable words work well. Spaces are welcome.</p><label class="auth-field">Confirm passphrase<input name="password_confirmation" type="password" autocomplete="new-password" required minlength="15" maxlength="256"></label>':'<p class="auth-hint" id="passphrase-hint">Your session locks after 15 minutes of inactivity.</p>'}<button class="button primary auth-submit" type="submit">${setup?'Create owner account':'Sign in'}${icon('arrow')}</button></form><p class="auth-footnote">${setup?'This account can manage and export the workspace. There is no email password recovery.':'This app is available only on this computer. No default account or passphrase is supplied.'}</p></section></main>`;
  document.title=`${setup?'Set up workspace':'Sign in'} · GuidanceDesk`;
  requestAnimationFrame(()=>$('#auth-root input')?.focus({preventScroll:true}));
}
function showLockedWorkspace(message) {
  clearPrivateView();$('#auth-root').hidden=false;
  $('#auth-root').innerHTML=`<main class="auth-failure">${icon('shield')}<h1>Workspace unavailable</h1><p>${esc(message)}</p>${button('Try again','auth-retry','refresh','primary')}</main>`;
}
async function openWorkspace(info) {
  authInfo=info;authToken=info.csrf_token;$('#auth-root').innerHTML='';$('#auth-root').hidden=true;
  $('.sidebar').hidden=false;$('.app-shell').hidden=false;document.body.classList.remove('workspace-locked');
  await refresh();
}
async function startWorkspace(message='') {
  try { const info=await request('/api/auth/status');if(info.authenticated) await openWorkspace(info);else showAuth(info,message); }
  catch(error) { showLockedWorkspace(error.message); }
}
function armExpiry(seconds) {
  clearTimeout(expiryTimer);
  expiryTimer=setTimeout(async()=>{
    try { const info=await request('/api/auth/status');if(info.authenticated) armExpiry(info.expires_in_seconds);else showAuth(info,'Your session ended. Sign in again to continue.'); }
    catch(error) { showLockedWorkspace(error.message); }
  },Math.max(1,Number(seconds)||900)*1000+200);
}
function openPasswordForm() {
  showModal('Change your passphrase','All open sessions will be signed out after this change.',`<div class="form-grid"><label class="field full">Current passphrase<input name="current_password" type="password" autocomplete="current-password" required maxlength="256"></label><div class="field full"><label for="new-owner-passphrase">New passphrase</label><input id="new-owner-passphrase" name="password" type="password" autocomplete="new-password" required minlength="15" maxlength="256" aria-describedby="new-owner-passphrase-hint"><span id="new-owner-passphrase-hint" class="field-hint">15–128 characters. Spaces are welcome.</span></div><label class="field full">Confirm new passphrase<input name="password_confirmation" type="password" autocomplete="new-password" required minlength="15" maxlength="256"></label></div>`,`${button('Cancel','close-modal','close','secondary')}<button class="button primary" type="submit">${icon('check')}Change passphrase</button>`,false,{id:'password-form',endpoint:'/api/auth/password'});
}
function field(label,name,value='',type='text',required=true,max=180,cls='',placeholder='') {
  const id=`input-${name}-${++fieldNumber}`;
  return `<label class="field ${cls}" for="${id}">${label}${required?' *':''}<input id="${id}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='text'||type==='email'?`maxlength="${max}"`:''} ${placeholder?`placeholder="${esc(placeholder)}"`:''}></label>`;
}
function selectField(label,name,values,current,cls='') {
  const id=`input-${name}-${++fieldNumber}`;
  return `<label class="field ${cls}" for="${id}">${label} *<select id="${id}" name="${name}" required>${values.map(item=>{const [value,text]=Array.isArray(item)?item:[item,item];return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(text)}</option>`;}).join('')}</select></label>`;
}
function textareaField(label,name,value='',max=6000,required=false) {
  const id=`input-${name}-${++fieldNumber}`;
  return `<label class="field full" for="${id}">${label}${required?' *':''}<textarea id="${id}" name="${name}" maxlength="${max}" ${required?'required':''} placeholder="Add a little context…">${esc(value)}</textarea></label>`;
}
function studentSelect(current) {
  return selectField('Student','student_id',[['','Choose a student…'],...state.students.map(student=>[student.id,`${fullName(student)} · ${student.school_id}`])],current,'full');
}
function showModal(title,subtitle,body,footer='',drawer=false,form=null) {
  if(!$('#overlay-root').firstElementChild) previousFocus=document.activeElement;
  closeSearch();
  const content=`<div class="modal-body">${form?'<div class="form-error" hidden role="alert"></div>':''}${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
  $('#overlay-root').innerHTML=`<div class="overlay ${drawer?'drawer-overlay':''}"><section class="modal ${drawer?'drawer':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><div><h2 id="dialog-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button type="button" class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${form?`<form id="${form.id}" data-endpoint="${form.endpoint}">${content}</form>`:content}</section></div>`;
  document.body.classList.add('overlay-open');
  $('.app-shell').inert=true; $('.sidebar').inert=true;
  requestAnimationFrame(()=>{
    const first=$('#overlay-root input:not([type="hidden"]),#overlay-root select,#overlay-root textarea')||$('#overlay-root button');
    first?.focus({preventScroll:true});
  });
}
function closeModal() {
  $('#overlay-root').innerHTML=''; document.body.classList.remove('overlay-open');
  $('.app-shell').inert=false; $('.sidebar').inert=false;
  if(previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); else $('#content').focus({preventScroll:true});
}
function openRecordForm(id=null,studentId='') {
  if(!state.students.length) { toast('Add a student before creating a guidance record.'); openStudentForm(); return; }
  const record=id?recordById(id):null;
  const value={student_id:studentId,title:'',category:'Academic',priority:'Normal',status:'Open',opened_on:state.today,follow_up:'',counselor:state.settings.counselor_name,summary:'',...record};
  const body=`<p class="form-help">Capture the conversation and give it a clear next step. Fields marked * are required.</p><input type="hidden" name="id" value="${record?.id||''}"><input type="hidden" name="version" value="${record?.version||0}"><div class="form-grid">${studentSelect(value.student_id)}${field('Record title','title',value.title,'text',true,180,'full','e.g. Building better study habits')}${selectField('Category','category',CATEGORIES,value.category)}${selectField('Priority','priority',['Low','Normal','High'],value.priority)}${selectField('Status','status',STATUSES,value.status)}${field('Record date','opened_on',value.opened_on,'date')}${field('Follow-up date','follow_up',value.follow_up,'date',false)}${field('Counselor','counselor',value.counselor,'text',true,120)}${textareaField('Conversation summary','summary',value.summary)}</div>`;
  showModal(record?'Edit guidance record':'A new conversation',record?esc(recordCode(record)):'A small step toward a brighter path.',body,`${record?button('Back to record','back-record','chevron-left','secondary',`data-id="${record.id}"`):button('Cancel','close-modal','close','secondary')}<button class="button primary" type="submit">${icon('check')}${record?'Save changes':'Create record'}</button>`,false,{id:'record-form',endpoint:'/api/records/save'});
}
function openRecord(id) {
  const record=recordById(id); if(!record) { toast('This record could not be found.',true); return; }
  const student=studentById(record.student_id),notes=state.notes.filter(note=>note.record_id===record.id);
  const body=`<div class="detail-kicker">${pill(record.archived?'Archived':record.status)}${priority(record.priority)}<span>${esc(record.category)}</span></div><button class="detail-student" data-student="${student.id}">${avatar(student)}<span><strong>${esc(fullName(student))}</strong><small>${esc(student.school_id)} · ${esc(student.grade)} · ${esc(student.section_name)}</small></span>${icon('chevron-right')}</button><dl class="detail-grid"><div><dt>RECORD DATE</dt><dd>${dateLabel(record.opened_on,{month:'long',day:'numeric',year:'numeric'})}</dd></div><div><dt>FOLLOW-UP</dt><dd>${record.follow_up?followupCell(record):'Not scheduled'}</dd></div><div><dt>COUNSELOR</dt><dd>${esc(record.counselor)}</dd></div><div><dt>RECORD ID</dt><dd>${recordCode(record)}</dd></div></dl><section class="detail-section"><h3>Conversation summary</h3><p class="prose">${esc(record.summary)||'No summary added yet.'}</p></section><section class="detail-section"><h3>Case notes <span class="subtle-note">(${notes.length})</span></h3><form id="note-form" class="notes-form" data-endpoint="/api/notes/add"><div class="form-error" hidden role="alert"></div><input type="hidden" name="record_id" value="${record.id}"><input type="hidden" name="version" value="${record.version}"><input type="hidden" name="author" value="${esc(state.account.display_name)}"><label class="sr-only" for="case-note">New case note</label><textarea id="case-note" name="body" maxlength="6000" required placeholder="What happened since the last conversation?"></textarea><div class="notes-form-footer"><span>As ${esc(state.account.display_name)}</span><button class="button soft small" type="submit">${icon('plus')}Add note</button></div></form><div class="timeline">${notes.map(note=>`<article class="note-item"><header><strong>${esc(note.author)}</strong><span>${dateLabel(note.created_at,{month:'short',day:'numeric',year:'numeric'})}</span></header><p class="prose">${esc(note.body)}</p></article>`).join('')}</div></section>`;
  const footer=`${button(record.archived?'Restore':'Archive','archive-record',record.archived?'refresh':'archive','secondary',`data-id="${record.id}"`)}${!record.archived?button(record.status==='Resolved'?'Reopen':'Resolve','toggle-record','circlecheck','soft',`data-id="${record.id}"`):''}${button('Edit record','edit-record','edit','primary',`data-id="${record.id}"`)}`;
  showModal(esc(record.title),esc(recordCode(record)),body,footer,true);
  requestAnimationFrame(()=>$('#overlay-root .modal-head button')?.focus({preventScroll:true}));
}
function openStudentForm(id=null) {
  const student=id?studentById(id):null;
  const value={school_id:'',first_name:'',last_name:'',grade:'Grade 10',section_name:'',email:'',...student};
  const grades=['Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12','1st year','2nd year','3rd year','4th year','Other'];
  if(!grades.includes(value.grade)) grades.push(value.grade);
  const body=`<p class="form-help">Keep the essentials in one place. Fields marked * are required.</p><input type="hidden" name="id" value="${student?.id||''}"><input type="hidden" name="version" value="${student?.version||0}"><div class="form-grid">${field('First name','first_name',value.first_name,'text',true,80)}${field('Last name','last_name',value.last_name,'text',true,80)}${field('Student ID','school_id',value.school_id,'text',true,40,'full','e.g. ST-2026013')}${selectField('Grade / year level','grade',grades,value.grade)}${field('Section / course','section_name',value.section_name,'text',false,60)}${field('Email address','email',value.email,'email',false,150,'full','Optional')}</div>`;
  showModal(student?'Edit student details':'Welcome a new student',student?esc(fullName(student)):'Every student has a story. Start with the basics.',body,`${button('Cancel','close-modal','close','secondary')}<button class="button primary" type="submit">${icon('check')}${student?'Save changes':'Add student'}</button>`,false,{id:'student-form',endpoint:'/api/students/save'});
}
function openStudent(id) {
  const student=studentById(id); if(!student) return;
  const records=state.records.filter(record=>record.student_id===student.id),active=records.filter(record=>!record.archived&&record.status!=='Resolved');
  const appointments=state.appointments.filter(appointment=>appointment.student_id===student.id&&appointment.status==='Scheduled'&&appointment.day>=state.today);
  const body=`<div class="profile-hero">${avatar(student)}<h2>${esc(fullName(student))}</h2><p>${esc(student.school_id)} · ${esc(student.grade)}${student.section_name?' · '+esc(student.section_name):''}</p>${student.email?`<p>${icon('mail')} ${esc(student.email)}</p>`:''}<div class="profile-stat-row"><span><strong>${records.length}</strong><small>Total records</small></span><span><strong>${active.length}</strong><small>Active records</small></span><span><strong>${appointments.length}</strong><small>Appointments</small></span></div></div><section class="detail-section"><h3>Guidance history</h3>${records.map(record=>`<button class="profile-record" data-record="${record.id}"><strong>${esc(record.title)}</strong><p>${pill(record.archived?'Archived':record.status)}<span>${dateLabel(record.opened_on)} · ${esc(record.category)}</span></p></button>`).join('')||empty('A fresh start','No guidance records for this student yet.')}</section>${appointments.length?`<section class="detail-section"><h3>Upcoming appointments</h3>${appointments.map(appointment=>appointmentCard(appointment)).join('')}</section>`:''}`;
  showModal('Student profile','A little context goes a long way.',body,`${button('Edit details','edit-student','edit','secondary',`data-id="${student.id}"`)}${button('New record','student-new-record','plus','primary',`data-id="${student.id}"`)}`,true);
}
function openAppointmentForm(id=null) {
  if(!state.students.length) { toast('Add a student before scheduling an appointment.'); openStudentForm(); return; }
  const appointment=id?state.appointments.find(item=>item.id===Number(id)):null;
  const value={student_id:'',title:'Individual counseling',day:selectedDay||state.today,starts_at:'09:00',duration:45,counselor:state.settings.counselor_name,location_name:'Guidance office',notes:'',status:'Scheduled',...appointment};
  const durations=[...new Set([15,30,45,60,90,120,180,Number(value.duration)])].sort((a,b)=>a-b).map(minutes=>[minutes,`${minutes} minutes`]);
  const body=`<p class="form-help">Times follow the workspace time zone, Asia/Manila. Overlapping bookings for a student or counselor are checked when you save.</p><input type="hidden" name="id" value="${appointment?.id||''}"><input type="hidden" name="version" value="${appointment?.version||0}"><div class="form-grid">${studentSelect(value.student_id)}${field('Appointment title','title',value.title,'text',true,180,'full')}${field('Date','day',value.day,'date')}${field('Start time','starts_at',value.starts_at,'time')}${selectField('Duration','duration',durations,value.duration)}${selectField('Status','status',['Scheduled','Completed','Cancelled'],value.status)}${field('Counselor','counselor',value.counselor,'text',true,120)}${field('Location','location_name',value.location_name,'text',true,120)}${textareaField('Appointment notes','notes',value.notes,3000)}</div>`;
  const statusButtons=appointment?.status==='Scheduled'?`${button('Cancel appointment','cancel-appointment','close','secondary',`data-id="${appointment.id}"`)}${button('Mark completed','complete-appointment','check','soft',`data-id="${appointment.id}"`)}`:button('Close','close-modal','close','secondary');
  showModal(appointment?'Appointment details':'Make time for a conversation',appointment?esc(fullName(studentById(appointment.student_id))):'Give the next step a time and place.',body,`${statusButtons}<button class="button primary" type="submit">${icon('check')}${appointment?'Save changes':'Schedule'}</button>`,false,{id:'appointment-form',endpoint:'/api/appointments/save'});
}
function closeSearch() { $('#global-results').hidden=true; $('#global-search').setAttribute('aria-expanded','false'); }
function globalSearch() {
  const q=$('#global-search').value.trim().toLowerCase(),root=$('#global-results');
  if(!q) { closeSearch(); return; }
  const students=state.students.filter(student=>[fullName(student),student.school_id].some(value=>value.toLowerCase().includes(q))).slice(0,4);
  const records=state.records.filter(record=>[record.title,recordCode(record),fullName(studentById(record.student_id))].some(value=>value.toLowerCase().includes(q))).slice(0,4);
  root.innerHTML=`${students.length?`<div class="search-label">Students</div>${students.map(student=>`<button class="search-result" data-student="${student.id}">${avatar(student)}<span><strong>${esc(fullName(student))}</strong><small>${esc(student.school_id)} · ${esc(student.grade)}</small></span></button>`).join('')}`:''}${records.length?`<div class="search-label">Guidance records</div>${records.map(record=>`<button class="search-result" data-record="${record.id}">${icon('folder')}<span><strong>${esc(record.title)}</strong><small>${esc(fullName(studentById(record.student_id)))} · ${recordCode(record)}</small></span></button>`).join('')}`:''}${!students.length&&!records.length?empty('No matches yet','Try a name, student ID, or record title.'):''}`;
  root.hidden=false; $('#global-search').setAttribute('aria-expanded','true');
}
async function download(endpoint,filename) {
  try {
    const response=await fetch(endpoint,{headers:{'X-Guidance-Token':state.csrf_token}});
    if(!response.ok) { const error=await response.json(); throw new Error(error.error||'Export failed.'); }
    const url=URL.createObjectURL(await response.blob());
    const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Download ready. Check your browser downloads.');
  } catch(error) { toast(error.message,true); }
}
function closeMenu() { $('.sidebar').classList.remove('open'); $('#sidebar-shade').classList.remove('visible'); }
async function handleAction(action,element) {
  const id=Number(element.dataset.id);
  switch(action) {
    case 'overview': case 'records': case 'students': case 'appointments': case 'reports': case 'settings': navigate(action); break;
    case 'new-record': openRecordForm(); break;
    case 'auth-retry': await startWorkspace();break;
    case 'sign-out': {const info=await request('/api/auth/logout',{});showAuth(info,'You have signed out.');sessionChannel?.postMessage('changed');break;}
    case 'change-password': openPasswordForm();break;
    case 'toggle-password': {const input=document.getElementById(element.dataset.target),show=input.type==='password';input.type=show?'text':'password';element.textContent=show?'Hide':'Show';element.setAttribute('aria-pressed',String(show));element.setAttribute('aria-label',show?'Hide passphrase':'Show passphrase');break;}
    case 'new-student': openStudentForm(); break;
    case 'new-appointment': openAppointmentForm(); break;
    case 'close-modal': if(!busy) closeModal(); break;
    case 'edit-record': openRecordForm(id); break;
    case 'edit-student': openStudentForm(id); break;
    case 'student-new-record': openRecordForm(null,id); break;
    case 'back-record': openRecord(id); break;
    case 'dismiss-sample': sampleDismissed=true; render(); break;
    case 'active-records': recordFilters={...recordFilters,status:'All',due:false,q:'',page:1}; navigate('records'); break;
    case 'resolved-records': recordFilters={...recordFilters,status:'Resolved',due:false,q:'',page:1}; navigate('records'); break;
    case 'due': recordFilters={q:'',status:'All',category:'All',priority:'All',sort:'followup',due:true,page:1}; navigate('records'); break;
    case 'clear-due': recordFilters.due=false; render(); break;
    case 'export': await download('/api/export/records.csv',`guidance-records-${state.today}.csv`); break;
    case 'backup': await download('/api/backup.sql',`guidancedesk-backup-${state.today}.sql`); break;
    case 'calendar-prev': case 'calendar-next': {const date=dateObj(calendarMonth+'-01'); date.setMonth(date.getMonth()+(action==='calendar-next'?1:-1)); calendarMonth=dayKey(date).slice(0,7);render();break;}
    case 'calendar-today': calendarMonth=state.today.slice(0,7);selectedDay=state.today;render();break;
    case 'clear-day': selectedDay='';render();break;
    case 'report-reset': reportFrom='';reportTo='';render();break;
    case 'archive-record': {
      const record=recordById(id); await request('/api/records/archive',{id,version:record.version,archived:String(!record.archived)});await refresh();openRecord(id);toast(record.archived?'Record restored.':'Record archived. You can restore it from the Archived tab.');break;
    }
    case 'toggle-record': {
      const record=recordById(id),status=record.status==='Resolved'?'Open':'Resolved';
      await request('/api/records/save',{...record,follow_up:record.follow_up||'',status});await refresh();openRecord(id);toast(status==='Resolved'?'Record marked as resolved.':'Record reopened.');break;
    }
    case 'complete-appointment': case 'cancel-appointment': {
      const status=action==='complete-appointment'?'Completed':'Cancelled';
      await request('/api/appointments/status',{id,version:state.appointments.find(appointment=>appointment.id===id).version,status});await refresh();closeModal();toast(`Appointment ${status.toLowerCase()}.`);break;
    }
    case 'menu': $('.sidebar').classList.toggle('open');$('#sidebar-shade').classList.toggle('visible');break;
    case 'retry': await refresh();break;
  }
}

document.addEventListener('click',async event=>{
  if(event.target===$('#sidebar-shade')) closeMenu();
  if(event.target.classList.contains('overlay')&&!busy) closeModal();
  if(!event.target.closest('.global-search')) closeSearch();
  const element=event.target.closest('button,a'); if(!element) return;
  try {
    if(element.dataset.action) { event.preventDefault(); if(!busy) await handleAction(element.dataset.action,element); }
    else if(element.dataset.record) openRecord(element.dataset.record);
    else if(element.dataset.student) openStudent(element.dataset.student);
    else if(element.dataset.appointment) openAppointmentForm(element.dataset.appointment);
    else if(element.dataset.recordStatus) { recordFilters.status=element.dataset.recordStatus;recordFilters.page=1;recordFilters.due=false;render(); }
    else if(element.dataset.page) { recordFilters.page=Number(element.dataset.page);render(); }
    else if(element.dataset.day) { selectedDay=element.dataset.day;render(); }
    else if(element.dataset.appointmentFilter) { appointmentFilter=element.dataset.appointmentFilter;selectedDay='';render(); }
    if(element.dataset.nav) closeMenu();
  } catch(error) { toast(error.message,true); }
});
document.addEventListener('input',event=>{
  switch(event.target.id) {
    case 'global-search': if(state) globalSearch(); break;
    case 'record-search': recordFilters.q=event.target.value;recordFilters.page=1;render(true);break;
    case 'student-search': studentFilters.q=event.target.value;render(true);break;
  }
});
document.addEventListener('change',event=>{
  const fields={'record-category':'category','record-priority':'priority','record-sort':'sort'};
  if(fields[event.target.id]) { recordFilters[fields[event.target.id]]=event.target.value;recordFilters.page=1;render(true); }
  else if(event.target.id==='student-grade') { studentFilters.grade=event.target.value;render(true); }
  else if(event.target.id==='report-from'||event.target.id==='report-to') {
    let from=event.target.id==='report-from'?event.target.value:reportFrom,to=event.target.id==='report-to'?event.target.value:reportTo;
    if(from&&to&&from>to) { toast('The start date must be on or before the end date.',true);event.target.value=event.target.id==='report-from'?reportFrom:reportTo;return; }
    reportFrom=from;reportTo=to;render(true);
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-endpoint]'); if(!form) return;
  event.preventDefault(); if(busy) return;
  // A hidden input named "id" shadows HTMLFormElement.id in browsers.
  const formId=form.getAttribute('id');
  const errorBox=form.querySelector('.form-error');errorBox.hidden=true;
  const values=Object.fromEntries(new FormData(form).entries()),submit=form.querySelector('[type="submit"]');
  busy=true; if(submit) submit.disabled=true;
  try {
    const result=await request(form.dataset.endpoint,values);
    if(formId==='auth-form'||formId==='password-form') {
      authToken=result.csrf_token;
      if(result.authenticated) await openWorkspace(result);
      else showAuth(result,'Passphrase changed. Sign in with your new passphrase.');
      sessionChannel?.postMessage('changed');
      return;
    }
    await refresh();
    if(formId==='note-form') { openRecord(Number(values.record_id));toast('Case note added.'); }
    else if(formId==='record-form') { openRecord(result.id);toast(values.id?'Record updated.':'Guidance record created.'); }
    else if(formId==='student-form') { openStudent(result.id);toast(values.id?'Student details updated.':'Student added to the directory.'); }
    else if(formId==='settings-form') toast('Workspace settings saved.');
    else { closeModal();toast(values.id?'Appointment updated.':'Appointment scheduled.'); }
  } catch(error) {
    if(errorBox.isConnected) { errorBox.textContent=error.message;errorBox.hidden=false;errorBox.scrollIntoView({block:'nearest'}); }
    else toast(error.message,true);
  } finally { busy=false;if(submit?.isConnected) submit.disabled=false; }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape') { if($('#overlay-root').firstElementChild&&!busy) closeModal();else {closeSearch();closeMenu();} }
  if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$('#overlay-root').firstElementChild) { event.preventDefault();$('#global-search').focus(); }
  if(event.key==='Tab'&&$('#overlay-root').firstElementChild) {
    const focusable=[...$('#overlay-root').querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href]')].filter(node=>!node.disabled&&node.offsetParent!==null);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first) {event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first?.focus();}
  }
  if(event.key==='ArrowDown'&&document.activeElement===$('#global-search')&&!$('#global-results').hidden) {event.preventDefault();$('#global-results button')?.focus();}
});
window.addEventListener('hashchange',()=>{page=Object.hasOwn(PAGES,location.hash.slice(1))?location.hash.slice(1):'overview';render();window.scrollTo(0,0);});
populateIcons();
page=Object.hasOwn(PAGES,location.hash.slice(1))?location.hash.slice(1):'overview';
startWorkspace();
