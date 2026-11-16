import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, createConnection } from 'node:net';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const scratch=process.env.GUIDANCEDESK_TEST_DIR||join(root,'build','test-data');
await mkdir(scratch,{recursive:true});
const data=await mkdtemp(join(scratch,'http-security-'));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const base=`http://127.0.0.1:${port}`;
const server=spawn('java',['--add-modules','jdk.httpserver','-jar',join(root,'guidancedesk.jar'),'--data',data,'--port',String(port),'--empty','--no-browser'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let diagnostics='',checks=0;
server.stdout.on('data',chunk=>diagnostics=(diagnostics+chunk).slice(-4000));
server.stderr.on('data',chunk=>diagnostics=(diagnostics+chunk).slice(-4000));
server.on('error',error=>{diagnostics=error.message;});
function check(condition,message){assert.ok(condition,message);checks++;}
const password=randomBytes(30).toString('base64url'),newPassword=randomBytes(30).toString('base64url');
const client=()=>({cookie:'',token:''});
async function req(who,path,body,extra={}) {
  const headers={Cookie:who.cookie,'X-Guidance-Token':who.token,...extra};
  const options={headers,signal:AbortSignal.timeout(10000)};
  if(body!==undefined){options.method='POST';options.body=typeof body==='string'?body:new URLSearchParams(body);if(!headers['Content-Type'])headers['Content-Type']='application/x-www-form-urlencoded';}
  const response=await fetch(base+path,options);
  const cookie=response.headers.get('set-cookie');if(cookie)who.cookie=cookie.split(';')[0];
  const text=await response.text();let json=null;try{json=JSON.parse(text);}catch{}
  if(json?.csrf_token)who.token=json.csrf_token;
  return {status:response.status,json,text,headers:response.headers};
}
async function boot(){const who=client();const result=await req(who,'/api/auth/status');assert.equal(result.status,200);return who;}
async function login(who,pass=password){return req(who,'/api/auth/login',{username:'owner.test',password:pass});}
async function state(who){const response=await req(who,'/api/state');assert.equal(response.status,200,response.text);return response.json;}
try {
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    try{const result=await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});if(result.ok){ready=true;break;}}catch{}
    if(server.exitCode!==null)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Test server did not start: '+diagnostics);
  const anonymous=client();
  for(const path of ['/api/state','/api/export/records.csv','/api/backup.sql'])check((await req(anonymous,path)).status===401,`Unauthenticated access blocked: ${path}`);
  check((await req(anonymous,'/api/students/save',{})).status===401,'Anonymous edits blocked');
  check((await req(anonymous,'/data/guidance.mv.db')).status===404,'Database files are not served');
  check((await req(anonymous,'/connection.key')).status===404,'Secret files are not served');
  const who=await boot(),bootstrapCookie=who.cookie,bootstrapToken=who.token;
  const status=await req(who,'/api/auth/status');check(!status.json.configured&&!status.json.authenticated,'First run has no default credentials');
  const cookieResponse=await req(client(),'/api/auth/status'),cookie=cookieResponse.headers.get('set-cookie');
  check(cookie.includes('HttpOnly')&&cookie.includes('SameSite=Strict')&&!cookie.includes('Domain='),'Session cookie is HttpOnly, Strict, and host-only');
  check(who.token.length===43&&!cookie.includes(who.token),'CSRF token is separate from the cookie');
  check((await req(who,'/api/auth/status',undefined,{Origin:'https://example.test'})).status===403,'Cross-origin bootstrap is blocked');
  check((await req(who,'/api/auth/login',{},{'Sec-Fetch-Site':'cross-site'})).status===403,'Cross-site metadata is blocked');
  check((await req(who,'/api/auth/login',{},{'Sec-Fetch-Site':'same-site'})).status===403,'Other same-site origins are not trusted');
  check((await req(who,'/api/auth/setup',{}, {'X-Guidance-Token':''})).status===403,'Setup requires CSRF protection');
  const owner={username:'owner.test',display_name:'Demo Owner',password,password_confirmation:password};
  check((await req(who,'/api/auth/setup',{...owner,password:'short',password_confirmation:'short'})).status===400,'Short passphrase is rejected');
  check((await req(who,'/api/auth/setup',{...owner,password_confirmation:'different'})).status===400,'Mismatched confirmation is rejected');
  check((await req(who,'/api/auth/setup',{...owner,username:'bad username'})).status===400,'Invalid owner username is rejected');
  const setup=await req(who,'/api/auth/setup',owner);check(setup.status===200&&setup.json.authenticated,'Owner can initialize and sign in');
  check(who.cookie!==bootstrapCookie&&who.token!==bootstrapToken,'Sign-in rotates session and CSRF identifiers');
  check((await req({cookie:bootstrapCookie,token:bootstrapToken},'/api/state')).status===401,'Pre-login session is invalid after sign-in');
  check((await req(who,'/api/auth/setup',owner)).status===409,'A second owner cannot replace the first');
  let snapshot=await state(who);check(snapshot.students.length===0&&snapshot.security.integrity==='verified','Protected state is backed by a verified database');
  check(!JSON.stringify(snapshot).includes(password)&&!JSON.stringify(snapshot).includes('password_hash'),'State excludes credentials and password hashes');
  check((await req(who,'/api/state',undefined,{'X-Guidance-Token':'wrong'})).status===403,'Authenticated reads reject the wrong CSRF token');
  const foreign=await boot();check((await req(who,'/api/students/save',{}, {'X-Guidance-Token':foreign.token})).status===403,'Tokens are bound to their own session');
  check((await req(who,'/api/students/save',{}, {Origin:'https://example.test'})).status===403,'Cross-origin edits are blocked');
  check((await req(who,'/api/students/save','id=1&id=2')).status===400,'Duplicate form keys are rejected');
  check((await req(who,'/api/students/save','x=%ZZ')).status===400,'Malformed URL encoding is rejected');
  check((await req(who,'/api/students/save','{}',{'Content-Type':'application/json'})).status===415,'Unexpected request content types are rejected');
  check((await req(who,'/api/students/save','x='+'a'.repeat(65536))).status===413,'Oversized request bodies are rejected');
  const student={school_id:'TEST-HTTP-001',first_name:'Zoë',last_name:"O'Neil",grade:'Grade 10',section_name:'Oak',email:''};
  let result=await req(who,'/api/students/save',student);check(result.status===200,'Authenticated student creation works');const studentId=result.json.id;
  result=await req(who,'/api/students/save',{...student,id:studentId,version:0,section_name:'New section'});check(result.status===200,'Versioned student edits work');
  check((await req(who,'/api/students/save',{...student,id:studentId,version:0})).status===409,'Stale student edits are rejected');
  check((await req(who,'/api/students/save',{...student,id:studentId})).status===409,'Missing edit versions are rejected');
  const record={student_id:studentId,title:"Study plan'); DROP TABLE students; --",category:'Academic',priority:'High',status:'Open',opened_on:'2026-11-15',follow_up:'2026-11-20',counselor:'Demo Owner',summary:'<script>window.bad=true</script>'};
  result=await req(who,'/api/records/save',record);check(result.status===200,'Quoted record data is saved');const recordId=result.json.id;
  snapshot=await state(who);check(snapshot.students.length===1&&snapshot.records[0].summary===record.summary,'SQL-like input cannot alter the schema');
  result=await req(who,'/api/notes/add',{record_id:recordId,version:0,author:'Forged Person',body:'A new note ✓\n<b>text</b>'});check(result.status===200,'Case notes can be added');
  snapshot=await state(who);check(snapshot.notes[0].author==='Demo Owner','Client-supplied note authors cannot impersonate another account');
  check((await req(who,'/api/records/save',{...record,id:recordId,version:0,title:'Stale overwrite'})).status===409,'Adding a note makes stale record edits fail');
  check((await req(who,'/api/records/archive',{id:recordId,version:1,archived:'true'})).status===200,'Versioned archive works');
  check((await req(who,'/api/records/archive',{id:recordId,version:1,archived:'false'})).status===409,'Stale archive/restore is rejected');
  check((await req(who,'/api/records/archive',{id:recordId,version:2,archived:'false'})).status===200,'Versioned restore works');
  const appointment={student_id:studentId,title:'Check-in',day:'2026-11-20',starts_at:'09:00',duration:45,counselor:'Demo Owner',location_name:'Office',status:'Scheduled',notes:''};
  result=await req(who,'/api/appointments/save',appointment);check(result.status===200,'Authenticated scheduling works');const appointmentId=result.json.id;
  check((await req(who,'/api/appointments/save',{...appointment,starts_at:'09:30'})).status===400,'Overlapping bookings are rejected');
  check((await req(who,'/api/appointments/status',{id:appointmentId,version:0,status:'Completed'})).status===200,'Versioned appointment status changes work');
  check((await req(who,'/api/appointments/status',{id:appointmentId,version:0,status:'Cancelled'})).status===409,'Stale appointment status changes fail');
  const settings={school_name:'Test School',workspace_name:'Test Office',counselor_name:'Untrusted label',school_year:'2026 - 2027',version:0};
  check((await req(who,'/api/settings/save',settings)).status===200,'Settings can be saved');
  check((await req(who,'/api/settings/save',settings)).status===409,'Stale settings cannot silently overwrite changes');
  result=await req(who,'/api/export/records.csv');check(result.status===200&&result.text.includes("O'Neil"),'CSV export requires and accepts a valid session');
  result=await req(who,'/api/backup.sql');check(result.status===200&&result.text.includes('AUDIT_EVENTS')&&!result.text.includes(password),'SQL backup works without plaintext account passwords');
  snapshot=await state(who);check(snapshot.audit.some(event=>event.action_name==='records/save'&&event.actor==='owner.test'),'Audit trail records the authenticated account');
  const home=await req(who,'/');check(home.headers.get('content-security-policy').includes("script-src 'self'"),'Inline scripts are disallowed');
  check(home.headers.get('x-frame-options')==='DENY'&&home.headers.get('x-content-type-options')==='nosniff','Framing and MIME sniffing protections are present');
  check(home.headers.get('cache-control')==='no-store','Private pages and responses are not cached');
  const other=await boot();check((await login(other)).status===200,'A second authenticated session can be created');
  check((await req(who,'/api/auth/password',{current_password:password,password:newPassword,password_confirmation:newPassword})).status===200,'Owner can change passphrase');
  check((await req(other,'/api/state')).status===401,'Changing passphrase invalidates all other sessions');
  check((await req(who,'/api/state')).status===401,'Passphrase change requires fresh sign-in');
  check((await login(who,password)).status===401,'Old passphrase stops working');
  check((await login(who,newPassword)).status===200,'New passphrase authenticates');
  const prior={cookie:who.cookie,token:who.token};check((await req(who,'/api/auth/logout',{})).status===200,'Sign out works');
  check((await req(prior,'/api/state')).status===401,'Signed-out sessions cannot be reused');
  for(let i=0;i<5;i++)check((await login(who,randomBytes(24).toString('base64url'))).status===401,'Failed login uses a generic response');
  check((await login(who,newPassword)).status===429,'Repeated failed sign-in attempts are throttled');
  const hostStatus=await new Promise((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port},()=>socket.write('GET /api/health HTTP/1.1\r\nHost: attacker.test\r\nConnection: close\r\n\r\n'));
    let raw='';socket.setTimeout(3000,()=>{socket.destroy();reject(new Error('Host test timed out'));});socket.on('data',chunk=>raw+=chunk);socket.on('end',()=>resolve(raw.split('\r\n')[0]));socket.on('error',reject);
  });check(hostStatus.includes('403'),'Unexpected Host values are rejected');
  console.log(`PASS: ${checks} HTTP security checks against an isolated running Java server.`);
} finally {
  server.kill();
  await Promise.race([once(server,'exit').catch(()=>{}),new Promise(resolve=>setTimeout(resolve,3000))]);
  if(server.exitCode===null)server.kill('SIGKILL');
}
