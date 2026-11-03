import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');
for(const migration of ['0000_next_whirlwind.sql','0001_lively_slapstick.sql','0002_client_profiles.sql','0003_buffer_integration.sql','0004_comment_inbox.sql','0005_post_client_changes.sql','0006_email_digests.sql','0007_member_names.sql','0008_key_dates_internal_notes.sql','0009_reel_buffer_music.sql','0010_buffer_linkedin.sql','0011_projects.sql','0012_comment_edits.sql','0013_member_clients.sql'])sql.exec(readFileSync('migrations/'+migration,'utf8'));
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
const projectRules=await import(moduleUrl(readFileSync('shared/projects.ts','utf8').replace("import {materialLinks} from './material-links';",'const {materialLinks}=globalThis.__blauMaterial;')));globalThis.__blauProjectRules=projectRules;
const projectsApi=await import(moduleUrl(readFileSync('worker/projects.ts','utf8').replace("import {normalizeProject,normalizeTask,projectPhases,columnKeys} from '../shared/projects';",'const {normalizeProject,normalizeTask,projectPhases,columnKeys}=globalThis.__blauProjectRules;')));globalThis.__blauProjects=projectsApi;
const {importBackup}=await import(moduleUrl(readFileSync('worker/import-backup.ts','utf8').replace("import {normalizeProject,normalizeTask,parseJson} from '../shared/projects';",'const {normalizeProject,normalizeTask,parseJson}=globalThis.__blauProjectRules;').replace("import {normalizeClientProfile} from '../shared/client-profile';",'const {normalizeClientProfile}=globalThis.__blauProfiles;').replace("import {validateMaterial} from '../shared/material-links';",'const {validateMaterial}=globalThis.__blauMaterial;')));
globalThis.__blauImport=importBackup;
const welcomes=[];globalThis.__blauWelcome=async(_env,o)=>{welcomes.push(o);return 'sent';};
const {createWorkspaceApi}=await import(moduleUrl(readFileSync('worker/workspace.ts','utf8').replace("import {bufferQuery,remotePostFields} from './buffer-api';","const bufferQuery=async()=>{throw Error('Unexpected Buffer query')};const remotePostFields='';").replace("import {lockedBufferStates,bufferState,sendsToBuffer} from '../shared/buffer-scheduling';",'const {lockedBufferStates,bufferState,sendsToBuffer}=globalThis.__blauBufferRules;').replace("import {normalizeClientProfile,readClientProfile} from '../shared/client-profile';",'const {normalizeClientProfile,readClientProfile}=globalThis.__blauProfiles;').replace("import {loadProjects,projectAction,projectActions} from './projects';",'const {loadProjects,projectAction,projectActions}=globalThis.__blauProjects;').replace("import {importBackup} from './import-backup';",'const importBackup=globalThis.__blauImport;').replace("import {validateMaterial,materialLinks} from '../shared/material-links';",'const {validateMaterial,materialLinks}=globalThis.__blauMaterial;').replace("import {sendWelcome} from './email-welcome';",'const sendWelcome=(...a)=>globalThis.__blauWelcome(...a);')));
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
assert.equal(sql.prepare('SELECT state FROM buffer_jobs WHERE post_id=?').get(p.id).state,'queued','client-approved reels are queued for Buffer');sql.prepare('DELETE FROM buffer_jobs WHERE post_id=?').run(p.id);
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

// Custom brand links are staff-only, validated and preserved by team edits.
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
let linkA=(await get()).clients.find(c=>c.id===a.id);
for(const invalid of [[{label:'Malo',url:'javascript:alert(1)'}],[{label:'Sin enlace',url:''}],[{label:'Usuario',url:'https://user@example.com/a'}],{label:'x'},Array.from({length:31},(_,i)=>({label:'L'+i,url:'https://example.com/'+i}))])await post({action:'client',...linkA,profile:{...profiles.readClientProfile(linkA.profile),links:invalid}},400);
await post({action:'client',...linkA,profile:{...profiles.readClientProfile(linkA.profile),links:[{label:' Fotos Luster ',url:'https://luster.example.com/descargas?marca=1'},{label:'',url:''},{label:'',url:'https://wetransfer.com/downloads/abc'}]}});
const savedLinks=[{label:'Fotos Luster',url:'https://luster.example.com/descargas?marca=1'},{label:'wetransfer.com',url:'https://wetransfer.com/downloads/abc'}];
assert.deepEqual(profiles.readClientProfile((await get()).clients.find(c=>c.id===a.id).profile).links,savedLinks);
assert.deepEqual(profiles.normalizeClientProfile(JSON.stringify({links:savedLinks})).links,savedLinks);
assert.equal(JSON.parse((await get(200,a.id)).clients[0].profile).links,undefined);
await post({action:'member',email:'links-collaborator@example.com',role:'collaborator',client_id:a.id});
identity={userId:'links-collaborator',email:'links-collaborator@example.com',displayName:'Collaborator'};
assert.equal(JSON.parse((await get()).clients[0].profile).links,undefined);
identity={userId:'profile-client',email:'profile-client@example.com',displayName:'Client'};
assert.equal(JSON.parse((await get()).clients[0].profile).links,undefined);
identity={userId:'profile-team',email:'profile-team@example.com',displayName:'Team'};
linkA=(await get()).clients.find(c=>c.id===a.id);assert.deepEqual(profiles.readClientProfile(linkA.profile).links,savedLinks);
await post({action:'client',...linkA,profile:{...profiles.readClientProfile(linkA.profile),phone:'+34 600 000 000'}});
assert.deepEqual(profiles.readClientProfile((await get()).clients.find(c=>c.id===a.id).profile).links,savedLinks);
identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};
await post({action:'removeMember',email:'links-collaborator@example.com'});
console.log('Passed: staff-only custom brand links, link validation, empty rows, team edits and client/collaborator isolation.');

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
await post({action:'member',email:'named@example.com',role:'client',client_id:b.id,name:'Ana López'});assert.equal((await get()).members.find(m=>m.email==='named@example.com').name,'Ana López');
identity={userId:'named',email:'named@example.com',displayName:'named@example.com'};const namedView=await get();assert.equal(namedView.userName,'Ana López');assert.equal(namedView.ownerName,undefined);
await post({action:'comment',id:moving.id,body:'Comentario con nombre'});await post({action:'ownerName',name:'Intruso'},403);assert.equal((await get()).comments.find(c=>c.body==='Comentario con nombre').author,'Ana López');
identity={userId:'owner',email:'owner@example.com',displayName:'owner@example.com'};await post({action:'ownerName',name:'Blau Admin'});await post({action:'comment',id:moving.id,body:'Respuesta del administrador'});
let ownerView=await get();assert.equal(ownerView.ownerName,'Blau Admin');assert.equal(ownerView.userName,'Blau Admin');assert.equal(ownerView.comments.find(c=>c.body==='Respuesta del administrador').author,'Blau Admin');
assert.equal(sql.prepare("SELECT author FROM comments WHERE body='Comentario con nombre'").get().author,'named@example.com');
await post({action:'member',email:'named@example.com',role:'client',client_id:b.id,name:'Ana María'});assert.equal((await get()).comments.find(c=>c.body==='Comentario con nombre').author,'Ana María');
identity={userId:'named',email:'named@example.com',displayName:'named@example.com'};assert.equal((await get()).comments.find(c=>c.body==='Respuesta del administrador').author,'Blau Admin');identity={userId:'owner',email:'owner@example.com',displayName:'owner@example.com'};
const namedBackup=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();assert.equal(namedBackup.owner_name,'Blau Admin');assert.equal(namedBackup.members.find(m=>m.email==='named@example.com').name,'Ana María');
console.log('Passed: member and administrator names, owner-only naming, names shown in comments for every role, stored emails unchanged and names kept in backups.');
const before=welcomes.length;const welcomeResult=await post({action:'member',email:'welcome@example.com',role:'collaborator',client_id:a.id,name:'Luis Gil'});assert.equal(welcomeResult.welcome,'sent');assert.equal(welcomes.length,before+1);assert.deepEqual(welcomes.at(-1),{name:'Luis Gil',email:'welcome@example.com',role:'collaborator',brand:a.name});
assert.equal((await post({action:'member',email:'welcome@example.com',role:'collaborator',client_id:a.id,name:'Luis G.'})).welcome,undefined);assert.equal(welcomes.length,before+1);
assert.equal((await post({action:'welcome',email:'welcome@example.com'})).welcome,'sent');assert.equal(welcomes.at(-1).name,'Luis G.');await post({action:'welcome',email:'nobody@example.com'},404);
identity={userId:'named',email:'named@example.com',displayName:'named@example.com'};await post({action:'welcome',email:'welcome@example.com'},403);identity={userId:'owner',email:'owner@example.com',displayName:'owner@example.com'};
console.log('Passed: welcome email only for new accesses, owner-only resend and role/brand passed to the template.');

// Internal notes: only owner and team write or read them.
const as=(email,fn)=>async(...a)=>{const prev=identity;identity={userId:email,email,displayName:email};try{return await fn(...a);}finally{identity=prev;}};
await post({action:'member',email:'team2@example.com',role:'team',name:'Marta'});await post({action:'member',email:'collab2@example.com',role:'collaborator',client_id:b.id});
await post({action:'comment',id:moving.id,body:'Nota secreta del admin',internal:true});await as('team2@example.com',post)({action:'comment',id:moving.id,body:'Nota secreta del equipo',internal:true});
assert.equal(sql.prepare("SELECT internal FROM comments WHERE body='Nota secreta del admin'").get().internal,1);assert.equal(sql.prepare("SELECT internal FROM comments WHERE body='Comentario con nombre'").get().internal,0);
assert.ok((await get()).comments.some(c=>c.body==='Nota secreta del equipo'&&c.internal===1));assert.ok((await as('team2@example.com',get)()).comments.some(c=>c.body==='Nota secreta del admin'));
for(const email of ['named@example.com','collab2@example.com']){const view=await as(email,get)();assert.ok(view.comments.length>0);assert.ok(!view.comments.some(c=>c.internal),email);await as(email,post)({action:'comment',id:moving.id,body:'Intento',internal:true},403);}
assert.ok(!(await get(200,b.id)).comments.some(c=>c.internal),'preview hides internal notes');
const internalPreview=await api.POST(new Request('https://test.local/api/workspace?preview='+b.id,{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify({action:'comment',id:moving.id,body:'Desde vista previa',internal:true})}));assert.equal(internalPreview.status,403);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM comments WHERE body IN ('Intento','Desde vista previa')").get().n,0);
console.log('Passed: internal notes written by owner and team, hidden from clients, collaborators and client preview.');
// Key dates: staff manage them, scoped roles see global dates and their brand only.
await post({action:'keyDate',title:'Aniversario agencia',date:'2026-11-20',yearly:true});await post({action:'keyDate',title:'Lanzamiento B',date:'2026-11-12',client_id:b.id});await as('team2@example.com',post)({action:'keyDate',title:'Feria A',date:'2026-11-05',client_id:a.id});
await post({action:'keyDate',title:'Mal',date:'2026-02-30'},400);await post({action:'keyDate',title:'',date:'2026-02-01'},400);await post({action:'keyDate',title:'X',date:'2026-02-01',client_id:'nope'},404);
let kd=(await get()).keyDates;assert.equal(kd.length,3);assert.equal(kd.find(k=>k.title==='Aniversario agencia').yearly,1);
for(const email of ['named@example.com','collab2@example.com']){assert.deepEqual((await as(email,get)()).keyDates.map(k=>k.title).sort(),['Aniversario agencia','Lanzamiento B']);await as(email,post)({action:'keyDate',title:'No',date:'2026-11-01'},403);await as(email,post)({action:'deleteKeyDate',id:kd[0].id},403);}
assert.deepEqual((await get(200,b.id)).keyDates.map(k=>k.title).sort(),['Aniversario agencia','Lanzamiento B']);
const launch=kd.find(k=>k.title==='Lanzamiento B');await post({action:'keyDate',id:launch.id,title:'Lanzamiento B (nuevo)',date:'2026-11-13',client_id:b.id});assert.equal((await get()).keyDates.find(k=>k.id===launch.id).date,'2026-11-13');
await post({action:'keyDate',id:'missing',title:'X',date:'2026-11-13'},404);await post({action:'deleteKeyDate',id:'missing'},404);
const feria=kd.find(k=>k.title==='Feria A');await post({action:'deleteKeyDate',id:feria.id});await post({action:'keyDate',title:'Feria A',date:'2026-11-05',client_id:a.id});
console.log('Passed: key dates created, edited and deleted by staff only, validated, and scoped to global plus own brand for clients, collaborators and preview.');
// Backups keep internal notes and key dates.
const fullBackup=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();assert.equal(fullBackup.key_dates.length,3);assert.ok(fullBackup.comments.some(c=>c.internal===1));
await post({action:'import',backup:fullBackup},400);
for(const t of ['project_reviews','project_comments','project_tasks','projects','reviews','comments','buffer_jobs','posts','members','key_dates','buffer_bindings','clients'])sql.exec(`DELETE FROM ${t}`);
await post({action:'import',backup:fullBackup});
assert.deepEqual(sql.prepare('SELECT id,client_id,date,title,yearly FROM key_dates ORDER BY id').all().map(r=>({...r})),fullBackup.key_dates.map(({created_at,...r})=>r).sort((x,y)=>x.id.localeCompare(y.id)));
assert.equal(sql.prepare('SELECT COUNT(*) n FROM comments WHERE internal=1').get().n,fullBackup.comments.filter(c=>c.internal===1).length);
assert.ok(!(await as('named@example.com',get)()).comments.some(c=>c.internal));
const legacy={...fullBackup};delete legacy.key_dates;for(const t of ['reviews','comments','posts','members','key_dates','clients'])sql.exec(`DELETE FROM ${t}`);await post({action:'import',backup:legacy});assert.equal(sql.prepare('SELECT COUNT(*) n FROM key_dates').get().n,0);
console.log('Passed: backups export and import internal notes and key dates, and older backups without key dates still import.');
// The Buffer music option only applies to Instagram reels and survives backups.
await post({action:'client',name:'Música',color:'#123456'});const musicClient=(await get()).clients.find(c=>c.name==='Música');
await post({action:'post',client_id:musicClient.id,title:'Reel sin música',copy:'',channel:'Instagram',format:'Reel',date:'2030-01-10T10:00',status:'Borrador',asset:'',buffer_music:1});
await post({action:'post',client_id:musicClient.id,title:'Historia con música',copy:'',channel:'Instagram',format:'Historia',date:'2030-01-10T10:00',status:'Borrador',asset:'',buffer_music:1});
let musicPosts=(await get()).posts.filter(p=>p.client_id===musicClient.id);assert.equal(musicPosts.find(p=>p.title==='Reel sin música').buffer_music,1);assert.equal(musicPosts.find(p=>p.title==='Historia con música').buffer_music,0);
const musicReel=musicPosts.find(p=>p.title==='Reel sin música');await post({...musicReel,action:'post',buffer_music:0});assert.equal((await get()).posts.find(p=>p.id===musicReel.id).buffer_music,0);await post({...musicReel,action:'post',updated_at:(await get()).posts.find(p=>p.id===musicReel.id).updated_at,buffer_music:1});
const musicBackup=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();for(const t of ['project_reviews','project_comments','project_tasks','projects','reviews','comments','buffer_jobs','posts','members','key_dates','buffer_bindings','clients'])sql.exec(`DELETE FROM ${t}`);await post({action:'import',backup:musicBackup});assert.equal(sql.prepare('SELECT buffer_music FROM posts WHERE id=?').get(musicReel.id).buffer_music,1);
console.log('Passed: Buffer music option stored only for Instagram reels and kept in backups.');
// Projects: sections per client, staff-only management, client visibility, reviews and backups.
await post({action:'client',name:'Proyectos SA',color:'#13dbfb'});let pc=(await get()).clients.find(c=>c.name==='Proyectos SA');
assert.deepEqual(JSON.parse(pc.profile).sections,{social:true,projects:true},'Sections default to both');
await post({action:'member',email:'cli@proy.es',role:'client',client_id:pc.id});await post({action:'member',email:'col@proy.es',role:'collaborator',client_id:pc.id});await post({action:'member',email:'team@proy.es',role:'team'});
const cli=(fn)=>as('cli@proy.es',fn),col=(fn)=>as('col@proy.es',fn),team=(fn)=>as('team@proy.es',fn);
const phases=[{id:'f1',name:'Diseño',start:'2030-01-01',end:'2030-01-20',milestone:'Diseño aprobado'},{id:'f2',name:'Producción',start:'2030-01-21',end:'2030-02-20',milestone:''}];
await cli(post)({action:'project',client_id:pc.id,name:'Empaques',phases},403);await col(post)({action:'project',client_id:pc.id,name:'Empaques',phases},403);
await post({action:'project',client_id:pc.id,name:'',phases},400);await post({action:'project',client_id:pc.id,name:'X',phases:[]},400);await post({action:'project',client_id:pc.id,name:'X',phases:[{id:'a',name:'A',start:'2030-02-01',end:'2030-01-01'}]},400);
const created=await team(post)({action:'project',client_id:pc.id,name:'Empaques café',template:'pack',viewer:'pack',summary:'Cajas nuevas',phases,fields:[{name:'Material',type:'Lista',value:'Cartón',visible:true},{name:'Proveedor',type:'Texto',value:'Imprenta Secreta',visible:false}],tasks:[{title:'Arte caja',phase_id:'f1',deliverable:true,visible:true,views:['Arte plano','Inventada'],links:'https://drive.google.com/file/d/abc/view',column_key:'review'},{title:'Nota solo equipo',phase_id:'f1',visible:false},{title:'Enviar logos',phase_id:'f1',client_task:true,visible:true,column_key:'wait'}]});
assert.ok(created.id);let all=await get();const proj=all.projects.find(p=>p.id===created.id);assert.equal(all.projectTasks.filter(t=>t.project_id===proj.id).length,3);
const arte=all.projectTasks.find(t=>t.title==='Arte caja'),hidden=all.projectTasks.find(t=>t.title==='Nota solo equipo'),logos=all.projectTasks.find(t=>t.title==='Enviar logos');assert.deepEqual(JSON.parse(arte.views),['Arte plano'],'Unknown views are dropped');
let mine=await cli(get)();assert.equal(mine.projects.length,1);assert.deepEqual(JSON.parse(mine.projects[0].fields).map(f=>f.name),['Material'],'Hidden fields stay with the team');assert.ok(!mine.projectTasks.some(t=>t.id===hidden.id),'Hidden tasks stay with the team');
assert.equal((await as('named@example.com',get)()).projects?.length??0,0,'Other brands never see the project');
await post({action:'taskComment',id:hidden.id,body:'Interna',internal:true});await post({action:'taskComment',id:arte.id,body:'Nota del equipo',internal:true});await post({action:'taskComment',id:arte.id,body:'Mirad el arte'});
mine=await cli(get)();assert.deepEqual(mine.projectComments.map(c=>c.body),['Mirad el arte'],'Internal notes and hidden-task comments stay private');
await cli(post)({action:'taskComment',id:hidden.id,body:'hola'},404);await cli(post)({action:'taskComment',id:arte.id,body:'x',internal:true},403);await cli(post)({action:'taskComment',id:arte.id,body:'¿Podemos cambiar el color?'});
mine=await cli(get)();const cc=mine.projectComments.find(c=>c.body==='¿Podemos cambiar el color?'),tc=mine.projectComments.find(c=>c.body==='Mirad el arte');assert.equal(cc.mine,true);assert.ok(!tc.mine);
await cli(post)({action:'taskCommentEdit',id:tc.id,body:'hack'},403);await cli(post)({action:'taskCommentEdit',id:cc.id,body:''},400);await cli(post)({action:'taskCommentEdit',id:cc.id,body:'¿Y en azul?'});
const ed=(await get()).projectComments.find(c=>c.id===cc.id);assert.equal(ed.body,'¿Y en azul?');assert.ok(ed.edited_at);assert.equal(ed.mine,false,'Only the author sees the edit button');
const tnote=(await get()).projectComments.find(c=>c.body==='Nota del equipo');await cli(post)({action:'taskCommentEdit',id:tnote.id,body:'x'},404);await team(post)({action:'taskCommentEdit',id:tnote.id,body:'x'},403);await post({action:'taskCommentEdit',id:tnote.id,body:'Nota editada'});
await cli(post)({action:'task',id:arte.id,updated_at:arte.updated_at,title:'Hack',phase_id:'f1'},403);await cli(post)({action:'moveTask',id:arte.id,updated_at:arte.updated_at,column_key:'done'},403);await col(post)({action:'taskReview',id:arte.id,updated_at:arte.updated_at,decision:'Aprobado'},403);
await cli(post)({action:'taskReview',id:arte.id,updated_at:arte.updated_at,decision:'Cambios solicitados',body:''},400);await cli(post)({action:'taskReview',id:logos.id,updated_at:logos.updated_at,decision:'Aprobado'},400);
await cli(post)({action:'taskReview',id:arte.id,updated_at:arte.updated_at,decision:'Cambios solicitados',body:'Más grande el logo'});all=await get();let arte2=all.projectTasks.find(t=>t.id===arte.id);assert.equal(arte2.column_key,'doing');assert.equal(all.projectReviews.find(r=>r.task_id===arte.id).decision,'Cambios solicitados');
await post({action:'moveTask',id:arte.id,updated_at:arte.updated_at,column_key:'review'},409);await post({action:'moveTask',id:arte.id,updated_at:arte2.updated_at,column_key:'review'});arte2=(await get()).projectTasks.find(t=>t.id===arte.id);
await cli(post)({action:'taskReview',id:arte.id,updated_at:arte2.updated_at,decision:'Aprobado'});arte2=(await get()).projectTasks.find(t=>t.id===arte.id);assert.equal(arte2.column_key,'done');assert.ok(arte2.done_at);
await col(post)({action:'taskSent',id:logos.id,updated_at:logos.updated_at},403);await cli(post)({action:'taskSent',id:logos.id,updated_at:logos.updated_at});assert.equal((await get()).projectTasks.find(t=>t.id===logos.id).column_key,'review');
await post({action:'task',project_id:proj.id,title:'Nueva',phase_id:'nope',due:'2030-02-30'},400);await post({action:'task',project_id:proj.id,title:'Nueva',phase_id:'f2',checklist:[{text:'Uno',done:true}],links:'javascript:alert(1)'},400);await post({action:'task',project_id:proj.id,title:'Nueva',phase_id:'f2',checklist:[{text:'Uno',done:true}],visible:true});
all=await get();const nueva=all.projectTasks.find(t=>t.title==='Nueva');assert.equal(nueva.phase_id,'f2');assert.equal(nueva.position,3);
await post({action:'project',id:proj.id,updated_at:proj.updated_at,name:'Empaques café',phases:[phases[0]]},409);
await post({action:'project',id:proj.id,updated_at:'old',name:'Empaques café',phases},409);
// Sections: only the owner changes them; hiding a section hides its data and blocks its actions.
const prof=JSON.parse(pc.profile);await team(post)({action:'client',id:pc.id,name:pc.name,color:pc.color,profile:{...prof,sections:{social:true,projects:false}}},403);
await post({action:'client',id:pc.id,name:pc.name,color:pc.color,profile:{...prof,sections:{social:false,projects:false}}},400);
await post({action:'post',client_id:pc.id,title:'Post visible',copy:'',channel:'Instagram',format:'Imagen',date:'2030-01-10T10:00',status:'En revisión',asset:''});
await post({action:'client',id:pc.id,name:pc.name,color:pc.color,profile:{...prof,sections:{social:true,projects:false}}});
const pv=(await get()).posts.find(p=>p.title==='Post visible');await cli(post)({action:'comment',id:pv.id,body:'Primer comentario'});let pcm=(await cli(get)()).comments.find(c=>c.body==='Primer comentario');assert.equal(pcm.mine,true);
await team(post)({action:'editComment',id:pcm.id,body:'x'},403);await cli(post)({action:'editComment',id:pcm.id,body:'Comentario corregido'});pcm=(await get()).comments.find(c=>c.id===pcm.id);assert.equal(pcm.body,'Comentario corregido');assert.ok(pcm.edited_at);
await post({action:'comment',id:pv.id,body:'Interna',internal:true});const intc=(await get()).comments.find(c=>c.body==='Interna'&&c.post_id===pv.id);await cli(post)({action:'editComment',id:intc.id,body:'x'},404);await post({action:'editComment',id:intc.id,body:'Interna corregida'});
assert.ok(!(await get(200,pc.id)).comments.some(c=>c.mine),'Preview never offers editing');
mine=await cli(get)();assert.equal(mine.projects.length,0);assert.equal(mine.projectTasks.length,0);assert.ok(mine.posts.length>0);await cli(post)({action:'taskComment',id:arte.id,body:'x'},403);
assert.equal((await get(200,pc.id)).projects.length,0,'Preview follows the client sections');
await post({action:'client',id:pc.id,name:pc.name,color:pc.color,profile:{...prof,sections:{social:false,projects:true}}});
mine=await cli(get)();assert.equal(mine.posts.length,0);assert.equal(mine.comments.length,0);assert.equal(mine.projects.length,1);const vp=mine.posts;
const anyPost=(await get()).posts.find(p=>p.client_id===pc.id);await cli(post)({action:'comment',id:anyPost.id,body:'hola'},403);await cli(post)({action:'editComment',id:pcm.id,body:'y'},403);await col(post)({action:'post',client_id:pc.id,title:'X',copy:'',channel:'Instagram',format:'Imagen',date:'2030-01-10T10:00',status:'Borrador',asset:''},403);
assert.equal((await team(get)()).projects.length>=1,true,'The team always sees every project');
console.log('Passed: authors edit only their own comments and task comments, hidden/internal ones stay out of reach, and the edit is marked. Projects created by staff with templates, fields and tasks, hidden tasks/fields/internal notes kept from clients, client reviews and sent tasks, optimistic versions, and per-client sections enforced in the Worker.');
// Projects survive backups and client deletion removes them.
const projBackup=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();assert.equal(projBackup.projects.length,1);assert.equal(projBackup.project_tasks.length,4);assert.ok(projBackup.project_reviews.length>=2);
for(const t of ['project_reviews','project_comments','project_tasks','projects','reviews','comments','buffer_jobs','posts','members','key_dates','buffer_bindings','clients'])sql.exec(`DELETE FROM ${t}`);await post({action:'import',backup:projBackup});
const after=await get();assert.equal(after.projects.length,1);assert.equal(after.projectTasks.length,4);assert.equal(after.projectComments.length,projBackup.project_comments.length);assert.deepEqual(JSON.parse(after.clients.find(c=>c.id===pc.id).profile).sections,{social:false,projects:true});
const broken={...projBackup,project_tasks:[{...projBackup.project_tasks[0],project_id:'nope'}]};for(const t of ['project_reviews','project_comments','project_tasks','projects','reviews','comments','buffer_jobs','posts','members','key_dates','buffer_bindings','clients'])sql.exec(`DELETE FROM ${t}`);await post({action:'import',backup:broken},400);await post({action:'import',backup:projBackup});
await post({action:'deleteProject',id:proj.id,confirmName:'otro'},400);await team(post)({action:'deleteProject',id:proj.id,confirmName:'Empaques café'},403);
pc=(await get()).clients.find(c=>c.id===pc.id);await post({action:'deleteClient',id:pc.id,confirmName:pc.name});for(const t of ['projects','project_tasks','project_comments','project_reviews'])assert.equal(sql.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n,0,t+' removed with the client');
console.log('Passed: projects, tasks, comments and reviews kept in backups, invalid project backups rejected, project deletion owner-only, and client deletion removes its projects.');
// A collaborator can be assigned several brands; each brand keeps its own sections.
await post({action:'client',name:'Marca X',color:'#111111'});await post({action:'client',name:'Marca Y',color:'#222222'});await post({action:'client',name:'Marca Z',color:'#333333'});
const [mx,my,mz]=['Marca X','Marca Y','Marca Z'].map(n=>sqlClients().find(c=>c.name===n));function sqlClients(){return sql.prepare('SELECT * FROM clients').all();}
await post({action:'client',id:my.id,name:my.name,color:my.color,profile:{sections:{social:false,projects:true}}});
const multi=(fn)=>as('multi@marcas.es',fn);
await post({action:'member',email:'multi@marcas.es',role:'collaborator',client_ids:[]},400);
await post({action:'member',email:'multi@marcas.es',role:'collaborator',client_ids:[mx.id,'no-existe']},400);
await post({action:'member',email:'multi@marcas.es',role:'collaborator',client_ids:[mx.id,my.id,mx.id],name:'Multi'});
assert.match(welcomes.at(-1).brand,/Marca X, Marca Y|Marca Y, Marca X/);
let mm=(await get()).members.find(m=>m.email==='multi@marcas.es');assert.equal(mm.client_id,mx.id);assert.deepEqual(mm.client_ids,[mx.id,my.id]);
const postX={action:'post',client_id:mx.id,title:'En X',copy:'',channel:'Instagram',format:'Imagen',date:'2030-02-01T10:00',status:'Borrador',asset:''};
await multi(post)(postX);await multi(post)({...postX,client_id:my.id,title:'En Y'},403);await multi(post)({...postX,client_id:mz.id,title:'En Z'},403);
await post({...postX,client_id:mz.id,title:'Solo Z'});await post({action:'project',client_id:my.id,name:'Web Y',phases});await post({action:'project',client_id:mz.id,name:'Web Z',phases});
let seen=await multi(get)();assert.deepEqual(seen.clients.map(c=>c.id),[mx.id,my.id]);assert.deepEqual(seen.posts.map(p=>p.title),['En X']);assert.deepEqual(seen.projects.map(p=>p.name),['Web Y']);assert.equal(seen.members.length,0);
const zPost=(await get()).posts.find(p=>p.title==='Solo Z');await multi(post)({action:'comment',id:zPost.id,body:'x'},403);
await post({action:'member',email:'multi@marcas.es',role:'collaborator',client_ids:[mz.id,mx.id],name:'Multi'});seen=await multi(get)();assert.deepEqual(seen.clients.map(c=>c.id).sort(),[mx.id,mz.id].sort());assert.deepEqual(seen.posts.map(p=>p.title).sort(),['En X','Solo Z']);assert.deepEqual(seen.projects.map(p=>p.name),['Web Z']);
await multi(post)({action:'comment',id:zPost.id,body:'Comentario en Z'});
// Clients stay on one brand even if a list is sent.
await post({action:'member',email:'uno@marcas.es',role:'client',client_id:mx.id,client_ids:[mx.id,mz.id]});assert.deepEqual((await as('uno@marcas.es',get)()).clients.map(c=>c.id),[mx.id]);
// Backups keep the extra brands; deleting the main brand moves the collaborator to the next one.
const mb=await (await api.GET(new Request('https://test.local/api/workspace?export=1'))).json();assert.deepEqual(mb.member_clients.map(r=>r.client_id),[mx.id]);
await post({action:'deleteClient',id:mz.id,confirmName:'Marca Z'});mm=(await get()).members.find(m=>m.email==='multi@marcas.es');assert.equal(mm.client_id,mx.id);assert.deepEqual(mm.client_ids,[mx.id]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_clients').get().n,0);
await post({action:'removeMember',email:'multi@marcas.es'});await post({action:'member',email:'multi@marcas.es',role:'collaborator',client_ids:[my.id,mx.id]});await post({action:'removeMember',email:'multi@marcas.es'});assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_clients').get().n,0);
for(const t of ['member_clients','project_reviews','project_comments','project_tasks','projects','reviews','comments','buffer_jobs','posts','members','key_dates','buffer_bindings','clients'])sql.exec(`DELETE FROM ${t}`);await post({action:'import',backup:{...mb,member_clients:[...mb.member_clients,{email:'nadie@x.es',client_id:mx.id}]}});
mm=(await get()).members.find(m=>m.email==='multi@marcas.es');assert.deepEqual(mm.client_ids,[mz.id,mx.id]);assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_clients').get().n,1,'Rows for unknown collaborators are skipped');
console.log('Passed: collaborators with several brands see and edit only those brands, each brand keeps its own sections, backups keep the extra brands, and deleting a brand or the access cleans them up.');
