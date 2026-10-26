import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');
for(const migration of ['0000_next_whirlwind.sql','0001_lively_slapstick.sql','0002_client_profiles.sql','0003_buffer_integration.sql','0004_comment_inbox.sql','0005_post_client_changes.sql'])sql.exec(readFileSync('migrations/'+migration,'utf8'));
class Statement{
 constructor(q,args=[]){this.q=q;this.args=args;}
 bind(...args){return new Statement(this.q,args);}
 async first(){return sql.prepare(this.q).get(...this.args)??null;}
 async all(){return {results:sql.prepare(this.q).all(...this.args)};}
 async run(){const r=sql.prepare(this.q).run(...this.args);return {meta:{changes:Number(r.changes)}};}
}
const db={prepare(q){return new Statement(q)},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
const env={DB:db,ADMIN_EMAIL:'owner@example.com'};
const transpile=(src)=>ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const moduleUrl=(src)=>'data:text/javascript;base64,'+Buffer.from(transpile(src)).toString('base64');
const material=await import(moduleUrl(readFileSync('shared/material-links.ts','utf8')));
globalThis.__blauMaterial=material;
const profiles=await import(moduleUrl(readFileSync('shared/client-profile.ts','utf8')));
globalThis.__blauProfiles=profiles;
const bufferRules=await import(moduleUrl(readFileSync('shared/buffer-scheduling.ts','utf8')));globalThis.__blauBufferRules=bufferRules;
const {importBackup}=await import(moduleUrl(readFileSync('worker/import-backup.ts','utf8').replace("import {normalizeClientProfile} from '../shared/client-profile';",'const {normalizeClientProfile}=globalThis.__blauProfiles;').replace("import {validateMaterial} from '../shared/material-links';",'const {validateMaterial}=globalThis.__blauMaterial;')));
globalThis.__blauImport=importBackup;
const {createWorkspaceApi}=await import(moduleUrl(readFileSync('worker/workspace.ts','utf8').replace("import {bufferQuery,remotePostFields} from './buffer-api';","const bufferQuery=async()=>{throw Error('Unexpected Buffer query')};const remotePostFields='';").replace("import {lockedBufferStates,bufferState} from '../shared/buffer-scheduling';",'const {lockedBufferStates,bufferState}=globalThis.__blauBufferRules;').replace("import {normalizeClientProfile} from '../shared/client-profile';",'const {normalizeClientProfile}=globalThis.__blauProfiles;').replace("import {importBackup} from './import-backup';",'const importBackup=globalThis.__blauImport;').replace("import {validateMaterial,materialLinks} from '../shared/material-links';",'const {validateMaterial,materialLinks}=globalThis.__blauMaterial;')));
const api={GET:(req)=>createWorkspaceApi(env,identity).GET(req),POST:(req)=>createWorkspaceApi(env,identity).POST(req)};
async function post(body,expected=200){const r=await api.POST(new Request('https://test.local/api/workspace',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify(body)}));assert.equal(r.status,expected,JSON.stringify(await r.clone().json()));return r.json();}
async function get(expected=200,preview=''){const r=await api.GET(new Request('https://test.local/api/workspace'+(preview?'?preview='+preview:'')));assert.equal(r.status,expected);return r.json();}
identity={userId:'stranger',email:'stranger@example.com',displayName:'Stranger'};await get(403);await post({action:'init'},403);identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};assert.equal((await get()).needsSetup,true);
await post({action:'init'});
await post({action:'client',name:'Cliente A',color:'#8b7ae8'});
await post({action:'client',name:'Cliente B',color:'#3b9785'});
let data=await get();const [a,b]=data.clients;
const profile={website:'https://example.com/',contact_name:'Contacto de ejemplo',contact_email:'contact@example.com',phone:'+34 600 000 000',address:'Dirección de prueba',socials:{instagram:'https://www.instagram.com/example/'}};
await post({action:'client',...a,profile});
assert.equal(JSON.parse((await get()).clients.find(c=>c.id===a.id).profile).contact_email,profile.contact_email);
await post({action:'client',...a,profile:{website:'javascript:alert(1)'}},400);
await post({action:'client',...a,profile:{contact_email:'invalid'}},400);
await post({action:'client',id:a.id,name:a.name,color:a.color,notes:a.notes});
assert.equal(JSON.parse((await get()).clients.find(c=>c.id===a.id).profile).website,profile.website);

const draft={action:'post',client_id:a.id,title:'Prueba',copy:'Copy original',channel:'Instagram',format:'Reel',date:'2026-10-20T10:00',status:'Borrador',asset:''};
await post({...draft,status:'Aprobado'},400);
await post({...draft,asset:'javascript:alert(1)'},400);
const carouselAssets='https://drive.google.com/file/d/imageA/view\nhttps://drive.google.com/file/d/imageB/view';
await post({...draft,title:'Carrusel de prueba',format:'Carrusel',asset:carouselAssets});
assert.equal((await get()).posts.find(x=>x.title==='Carrusel de prueba').asset,carouselAssets);
await post({...draft,asset:carouselAssets},400);
await post({...draft,format:'Carrusel',asset:carouselAssets+'\njavascript:alert(1)'},400);
await post({...draft,format:'Carrusel',asset:Array(21).fill('https://example.com/image.png').join('\n')},400);
await post(draft);
await post({...draft,client_id:b.id,title:'Otro cliente',status:'En revisión'});
let p=(await get()).posts.find(x=>x.client_id===a.id);

// A collaborator is an editor scoped to one brand, including drafts.
await post({action:'member',email:'collab@example.com',role:'collaborator'},400);
await post({action:'member',email:'collab@example.com',role:'collaborator',client_id:a.id});
identity={userId:'collab',email:'collab@example.com',displayName:'Colaborador'};
const scoped=await get();assert.equal(scoped.clients.length,1);assert.equal(scoped.clients[0].id,a.id);assert(scoped.posts.every(x=>x.client_id===a.id));assert(scoped.posts.some(x=>x.status==='Borrador'));assert.equal(scoped.members.length,0);
const foreign=sql.prepare('SELECT * FROM posts WHERE client_id=?').get(b.id);
for(const action of ['post','review','comment','delete'])await post({...foreign,action,body:'Forbidden',status:'Aprobado'},403);
await post({...draft,client_id:b.id},403);
await post({action:'review',id:p.id,updated_at:p.updated_at,status:'Aprobado'},403);
await post({action:'delete',id:p.id},403);
await post({action:'client',name:'Forbidden',color:'#111111'},403);
await post({action:'member',email:'escape@example.com',role:'team'},403);
await get(403,a.id);
const exported=await api.GET(new Request('https://test.local/api/workspace?export=1'));assert.equal(exported.status,403);
await post({...p,action:'post',copy:'Colaborador editó este borrador'});
p=(await get()).posts.find(x=>x.id===p.id);assert.equal(p.copy,'Colaborador editó este borrador');
await post({action:'comment',id:p.id,body:'Comentario de colaborador'});
assert.equal((await get()).comments.find(x=>x.post_id===p.id).role,'team');
// Restore the fixture so existing client visibility tests remain unchanged.
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({...p,action:'post',copy:'Copy original'});
p=(await get()).posts.find(x=>x.id===p.id);
sql.prepare('DELETE FROM comments WHERE post_id=?').run(p.id);

await post({action:'member',email:'client@example.com',role:'client',client_id:a.id});
identity={userId:'client',email:'client@example.com',displayName:'Cliente'};
assert.equal((await get()).posts.length,0,'Client must not see drafts or another brand');
await post({...draft,id:p.id,updated_at:p.updated_at},403);
await post({action:'member',email:'bad@example.com',role:'team'},403);
identity={userId:'stranger',email:'stranger@example.com',displayName:'Stranger'};
await get(403);await post({action:'client',name:'Unauthorized',color:'#111111'},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({...draft,id:p.id,updated_at:p.updated_at,status:'En revisión'});
p=(await get()).posts.find(x=>x.client_id===a.id);
identity={userId:'client',email:'client@example.com',displayName:'Cliente'};
data=await get();assert.equal(data.posts.length,1);assert.equal(data.clients.length,1);
await get(403,a.id);
const other=sql.prepare('SELECT * FROM posts WHERE client_id=?').get(b.id);
await post({action:'review',id:other.id,updated_at:other.updated_at,status:'Aprobado'},403);
await post({action:'review',id:p.id,updated_at:'stale',status:'Aprobado'},409);
await post({action:'review',id:p.id,updated_at:p.updated_at,status:'Cambios solicitados'},400);
await post({action:'review',id:p.id,updated_at:p.updated_at,status:'Aprobado',body:'Perfecto'});
data=await get();assert.equal(data.posts[0].status,'Aprobado');assert.equal(data.comments.length,1);assert.equal(data.reviews.length,1);assert.equal(data.reviews[0].role,'client');assert.equal(JSON.parse(data.reviews[0].snapshot).copy,'Copy original');
await post({action:'delete',id:p.id},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
p=(await get()).posts.find(x=>x.id===p.id);
await post({...p,action:'post',copy:'Copy modificado',status:'Planificado'});
const edited=(await get()).posts.find(x=>x.id===p.id);assert.equal(edited.status,'En revisión','Edits to approved content require approval again');
await post({...p,action:'post'},409);
await post({action:'delete',id:p.id});assert.equal((await get()).comments.length,0);assert.equal((await get()).reviews.length,0);
const preview=await get(200,b.id);assert.equal(preview.preview,true);assert.equal(preview.role,'client');assert.equal(preview.clients.length,1);assert.ok(preview.posts.every(x=>x.client_id===b.id));
const previewWrite=await api.POST(new Request('https://test.local/api/workspace?preview='+b.id,{method:'POST',body:JSON.stringify({action:'client',name:'No write',color:'#000000'})}));assert.equal(previewWrite.status,403);
const previewPost=(await get()).posts.find(x=>x.client_id===b.id);
const scopedReview=await api.POST(new Request('https://test.local/api/workspace?preview='+b.id,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify({action:'review',id:previewPost.id,updated_at:previewPost.updated_at,status:'Aprobado'})}));assert.equal(scopedReview.status,200);assert.equal((await get()).posts.find(x=>x.id===previewPost.id).status,'Aprobado');
const wrongScope=await api.POST(new Request('https://test.local/api/workspace?preview='+a.id,{method:'POST',body:JSON.stringify({action:'comment',id:previewPost.id,body:'Denied'})}));assert.equal(wrongScope.status,403);
identity={userId:'different-dispatch-id',email:'owner@example.com',displayName:'Owner'};assert.equal((await get()).role,'owner');
// Published records are immutable; undated drafts and compatible formats are supported.
let approved=(await get()).posts.find(x=>x.id===previewPost.id);
assert.equal((await get()).reviews[0].role,'team','Preview decisions must not be attributed to a client');
await post({...approved,action:'post',status:'Publicado'});
let published=(await get()).posts.find(x=>x.id===approved.id);
await post({...published,action:'post',copy:'Overwrite published'},400);

await post({...draft,title:'Idea sin fecha',status:'Idea',date:''});
await post({...draft,title:'Wrong format',channel:'Email',format:'Reel'},400);
await post({...draft,title:'Missing review date',status:'En revisión',date:''},400);
await post({action:'client',id:a.id,name:'Cliente A actualizado',color:'#003680',notes:'Notas',archived:1});
assert.equal((await get()).clients.find(x=>x.id===a.id).archived,1);
await post({...draft,title:'Archived client'},400);
const exportResponse=await api.GET(new Request('https://test.local/api/workspace?export=1'));
assert.equal(exportResponse.status,200);assert.ok((await exportResponse.json()).reviews.length);
await post({action:'delete',id:published.id});
assert.ok(!(await get()).posts.some(p=>p.id===published.id));
identity={userId:'client',email:'client@example.com',displayName:'Cliente'};
assert.equal((await api.GET(new Request('https://test.local/api/workspace?export=1'))).status,403);
assert.ok((await get()).reviews.every(x=>x.post_id!==published.id));

console.log('Passed: authentication, client isolation, restricted edits, validation, review, comments, stale revisions, approval reset and deletion.');

identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
const backup=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();
await post({action:'import',backup},400);
await db.batch(['reviews','comments','posts','members','clients'].map(t=>db.prepare(`DELETE FROM ${t}`)));
await post({action:'import',backup});
assert.equal((await get()).posts.length,backup.posts.length);
assert.equal((await get()).reviews.length,backup.reviews.length);
console.log('Passed: restricted administrator bootstrap, empty-space import and review history preservation.');

// A verified email gains access only after an administrator registers it in D1.
identity={userId:'new-client',email:'new-client@example.com',displayName:'New client'};
await get(403);await post({action:'init'},403);await post({action:'client',name:'Denied',color:'#111111'},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'member',email:'new-client@example.com',role:'client',client_id:b.id});
identity={userId:'new-client',email:'new-client@example.com',displayName:'New client'};
let added=await get();assert.equal(added.role,'client');assert.ok(added.posts.every(p=>p.client_id===b.id));assert.equal(added.members.length,0);
await post({action:'member',email:'self-upgrade@example.com',role:'team'},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'removeMember',email:'new-client@example.com'});
identity={userId:'new-client',email:'new-client@example.com',displayName:'New client'};
await get(403);await post({action:'comment',id:published.id,body:'Access revoked'},403);
console.log('Passed: app-only onboarding, unregistered verified identities, scoped client access and immediate API revocation.');

identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
assert.equal(JSON.parse((await get()).clients.find(c=>c.id===a.id).profile).website,profile.website,'Profile survives backup import');
await post({action:'member',email:'profile-team@example.com',role:'team'});
await post({action:'member',email:'profile-client@example.com',role:'client',client_id:a.id});
identity={userId:'profile-team',email:'profile-team@example.com',displayName:'Team'};
const teamProfiles=await get();assert.ok(teamProfiles.members.some(m=>m.email==='profile-client@example.com'&&m.client_id===a.id));assert.ok(teamProfiles.members.every(m=>['client','collaborator'].includes(m.role)));
await post({action:'member',email:'forbidden@example.com',role:'client',client_id:a.id},403);
identity={userId:'profile-client',email:'profile-client@example.com',displayName:'Client'};
const clientProfiles=await get();assert.equal(clientProfiles.clients.length,1);assert.equal(clientProfiles.clients[0].id,a.id);assert.equal(clientProfiles.members.length,0);
assert.equal(profiles.readClientProfile({website:'htt',contact_email:'person@'}).website,'htt','Editing preserves unfinished values');
assert.equal(profiles.normalizeClientProfile(undefined).website,'','Old backups accept missing profiles');
console.log('Passed: client profiles, URL/email validation, backup persistence and scoped user visibility.');

// Drive is administrator-only and must preserve the complete monthly agreement.
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
const goals={feed:12,stories:20,email:2,linkedin:4};
const currentA=(await get()).clients.find(c=>c.id===a.id);
await post({action:'client',...currentA,profile:{...profiles.readClientProfile(currentA.profile),monthly_goals:goals,drive_folder_url:'https://drive.google.com/drive/folders/clientA'}});
for(const invalid of ['javascript:alert(1)','https://drive.google.com.evil.test/drive/folders/a','https://drive.google.com/file/d/a/view','https://user@drive.google.com/drive/folders/a'])await post({action:'member',email:'profile-client@example.com',role:'client',client_id:a.id,drive_folder_url:invalid},400);
await post({action:'member',email:'profile-client@example.com',role:'client',client_id:a.id,drive_folder_url:'https://drive.google.com/drive/u/0/folders/newFolder?usp=sharing'});
let driveProfile=profiles.readClientProfile((await get()).clients.find(c=>c.id===a.id).profile);
assert.deepEqual(driveProfile.monthly_goals,goals);assert.equal(driveProfile.website,profile.website);assert.equal(driveProfile.drive_folder_url,'https://drive.google.com/drive/u/0/folders/newFolder?usp=sharing');
assert.equal(profiles.readClientProfile((await get()).clients.find(c=>c.id===b.id).profile).drive_folder_url,'');
assert.equal(JSON.parse((await get(200,a.id)).clients[0].profile).drive_folder_url,undefined);
identity={userId:'profile-client',email:'profile-client@example.com',displayName:'Client'};
assert.equal(JSON.parse((await get()).clients[0].profile).drive_folder_url,undefined);
await post({action:'member',email:'profile-client@example.com',role:'client',client_id:a.id,drive_folder_url:''},403);
identity={userId:'profile-team',email:'profile-team@example.com',displayName:'Team'};
const teamA=(await get()).clients.find(c=>c.id===a.id);assert.equal(JSON.parse(teamA.profile).drive_folder_url,undefined);
await post({action:'client',...teamA,profile:{...profiles.readClientProfile(teamA.profile),drive_folder_url:'https://drive.google.com/drive/folders/forbidden'}});
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
driveProfile=profiles.readClientProfile((await get()).clients.find(c=>c.id===a.id).profile);assert.equal(driveProfile.drive_folder_url,'https://drive.google.com/drive/u/0/folders/newFolder?usp=sharing');assert.deepEqual(driveProfile.monthly_goals,goals);
await post({action:'member',email:'profile-client@example.com',role:'client',client_id:a.id,drive_folder_url:''});
assert.equal(profiles.readClientProfile((await get()).clients.find(c=>c.id===a.id).profile).drive_folder_url,'');
console.log('Passed: owner-only Drive visibility and edits, URL validation, member updates, preview isolation and monthly commitment preservation.');

// Deleting a client requires its exact name and removes its complete scoped graph.
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'client',name:'Cliente a eliminar',color:'#13dbfb',profile});
const doomed=(await get()).clients.find(c=>c.name==='Cliente a eliminar');
await post({...draft,client_id:doomed.id,title:'Publicación eliminable',status:'En revisión'});
const doomedPost=(await get()).posts.find(p=>p.client_id===doomed.id);
await post({action:'comment',id:doomedPost.id,body:'Comentario del cliente'});
await post({action:'review',id:doomedPost.id,updated_at:doomedPost.updated_at,status:'Aprobado',body:'Aprobación de prueba'});
const approvedDoomed=(await get()).posts.find(p=>p.id===doomedPost.id);
await post({...approvedDoomed,action:'post',status:'Publicado'});
await post({action:'member',email:'doomed@example.com',role:'client',client_id:doomed.id});
identity={userId:'profile-team',email:'profile-team@example.com',displayName:'Team'};
await post({action:'deleteClient',id:doomed.id,confirmName:doomed.name},403);
identity={userId:'doomed',email:'doomed@example.com',displayName:'Client'};
await post({action:'deleteClient',id:doomed.id,confirmName:doomed.name},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'deleteClient',id:doomed.id,confirmName:doomed.name.toLowerCase()},400);
assert.ok((await get()).posts.some(p=>p.id===doomedPost.id),'Wrong confirmation must not delete anything');
const originalBatch=db.batch;
db.batch=async statements=>{sql.prepare('UPDATE clients SET name=? WHERE id=?').run(doomed.name+' renombrado',doomed.id);return originalBatch.call(db,statements);};
await post({action:'deleteClient',id:doomed.id,confirmName:doomed.name},409);
db.batch=originalBatch;doomed.name+=' renombrado';
const afterRename=await get();assert.ok(afterRename.posts.some(p=>p.id===doomedPost.id));assert.ok(afterRename.comments.some(c=>c.post_id===doomedPost.id));assert.ok(afterRename.reviews.some(r=>r.post_id===doomedPost.id));assert.ok(afterRename.members.some(m=>m.client_id===doomed.id));
const beforeDelete=await get();
await post({action:'deleteClient',id:doomed.id,confirmName:doomed.name});
const afterDelete=await get();
assert.ok(!afterDelete.clients.some(c=>c.id===doomed.id));assert.ok(!afterDelete.posts.some(p=>p.client_id===doomed.id));assert.ok(!afterDelete.comments.some(c=>c.post_id===doomedPost.id));assert.ok(!afterDelete.reviews.some(r=>r.post_id===doomedPost.id));assert.ok(!afterDelete.members.some(m=>m.client_id===doomed.id));
assert.deepEqual(afterDelete.clients,beforeDelete.clients.filter(c=>c.id!==doomed.id));assert.deepEqual(afterDelete.posts,beforeDelete.posts.filter(p=>p.client_id!==doomed.id));
identity={userId:'doomed',email:'doomed@example.com',displayName:'Client'};await get(403);
console.log('Passed: exact client-name confirmation, administrator-only deletion, dependent records, published posts, other-client preservation and access revocation.');

console.log('Passed: collaborator brand isolation, draft editing, team-side comments, forbidden approval/deletion, access management and export.');

// Only the owner can reassign; old feedback stays private to the team.
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'client',...a,archived:0});await post({action:'client',...b,archived:0});
await post({...draft,title:'Reasignación',status:'En revisión'});
let moving=(await get()).posts.find(p=>p.title==='Reasignación');
await post({action:'comment',id:moving.id,body:'Comentario del cliente anterior'});
await post({action:'review',id:moving.id,updated_at:moving.updated_at,status:'Aprobado'});
moving=(await get()).posts.find(p=>p.id===moving.id);
const previousVersion={...moving};
identity={userId:'profile-team',email:'profile-team@example.com',displayName:'Team'};
await post({...moving,action:'post',client_id:b.id},403);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({...moving,action:'post',client_id:'missing-client'},400);
await post({action:'client',...b,archived:1});await post({...moving,action:'post',client_id:b.id},400);await post({action:'client',...b,archived:0});
await post({...moving,action:'post',client_id:b.id});
moving=(await get()).posts.find(p=>p.id===moving.id);assert.equal(moving.client_id,b.id);assert.equal(moving.status,'Borrador');assert.ok(moving.client_changed_at);
assert((await get()).comments.some(c=>c.post_id===moving.id));assert((await get()).reviews.some(r=>r.post_id===moving.id));
assert(!(await get(200,a.id)).posts.some(p=>p.id===moving.id));assert(!(await get(200,b.id)).posts.some(p=>p.id===moving.id));
await post({...previousVersion,action:'post',client_id:a.id},409);
await post({...moving,action:'post',status:'En revisión'});moving=(await get()).posts.find(p=>p.id===moving.id);
const targetView=await get(200,b.id);assert(targetView.posts.some(p=>p.id===moving.id));assert(!targetView.comments.some(c=>c.post_id===moving.id));assert(!targetView.reviews.some(r=>r.post_id===moving.id));
await post({action:'member',email:'new-target@example.com',role:'client',client_id:b.id});
identity={userId:'new-target',email:'new-target@example.com',displayName:'Nuevo cliente'};await post({...moving,action:'post',client_id:a.id},403);
await post({action:'comment',id:moving.id,body:'Comentario del nuevo cliente'});assert((await get()).comments.some(c=>c.post_id===moving.id&&c.body==='Comentario del nuevo cliente'));
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
assert((await get()).comments.some(c=>c.post_id===moving.id&&c.body==='Comentario del cliente anterior'));
await post({...draft,title:'Con envío',status:'Borrador'});const withJob=(await get()).posts.find(p=>p.title==='Con envío');
for(const state of ['queued','scheduled','sent','error','cancelled']){sql.prepare("INSERT OR REPLACE INTO buffer_jobs(post_id,client_id,state,mode,snapshot,created_at,updated_at) VALUES(?,?,?,'manual','{}','now','now')").run(withJob.id,a.id,state);await post({...withJob,action:'post',client_id:b.id},409);}
assert.equal((await get()).posts.find(p=>p.id===withJob.id).client_id,a.id);
// A Buffer job created after validation must also prevent the move.
sql.prepare('DELETE FROM buffer_jobs WHERE post_id=?').run(withJob.id);const movePrepare=db.prepare;db.prepare=q=>{const statement=movePrepare(q),bind=statement.bind;statement.bind=function(...args){const bound=bind.apply(this,args);if(q.startsWith('UPDATE posts SET title')){const run=bound.run;bound.run=async()=>{sql.prepare("INSERT INTO buffer_jobs(post_id,client_id,state,mode,snapshot,created_at,updated_at) VALUES(?,?,'error','manual','{}','now','now')").run(withJob.id,a.id);return run.call(bound);};}return bound;};return statement;};
await post({...withJob,action:'post',client_id:b.id},409);db.prepare=movePrepare;assert.equal((await get()).posts.find(p=>p.id===withJob.id).client_id,a.id);
console.log('Passed: owner-only reassignment, active target validation, draft reset, stale versions, feedback isolation and concurrent Buffer protection.');
