import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const sql=new DatabaseSync(':memory:');
for(const migration of ['0000_next_whirlwind.sql','0001_lively_slapstick.sql'])sql.exec(readFileSync('migrations/'+migration,'utf8'));
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
const {importBackup}=await import(moduleUrl(readFileSync('worker/import-backup.ts','utf8')));
globalThis.__blauImport=importBackup;
const {createWorkspaceApi}=await import(moduleUrl(readFileSync('worker/workspace.ts','utf8').replace("import {importBackup} from './import-backup';",'const importBackup=globalThis.__blauImport;')));
const api={GET:(req)=>createWorkspaceApi(env,identity).GET(req),POST:(req)=>createWorkspaceApi(env,identity).POST(req)};
async function post(body,expected=200){const r=await api.POST(new Request('https://test.local/api/workspace',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://test.local'},body:JSON.stringify(body)}));assert.equal(r.status,expected,JSON.stringify(await r.clone().json()));return r.json();}
async function get(expected=200,preview=''){const r=await api.GET(new Request('https://test.local/api/workspace'+(preview?'?preview='+preview:'')));assert.equal(r.status,expected);return r.json();}
identity={userId:'stranger',email:'stranger@example.com',displayName:'Stranger'};await get(403);await post({action:'init'},403);identity={userId:'owner',email:'owner@example.com',displayName:'Owner'};assert.equal((await get()).needsSetup,true);
await post({action:'init'});
await post({action:'client',name:'Cliente A',color:'#8b7ae8'});
await post({action:'client',name:'Cliente B',color:'#3b9785'});
let data=await get();const [a,b]=data.clients;
const draft={action:'post',client_id:a.id,title:'Prueba',copy:'Copy original',channel:'Instagram',format:'Reel',date:'2026-10-20T10:00',status:'Borrador',asset:''};
await post({...draft,status:'Aprobado'},400);
await post({...draft,asset:'javascript:alert(1)'},400);
await post(draft);
await post({...draft,client_id:b.id,title:'Otro cliente',status:'En revisión'});
let p=(await get()).posts.find(x=>x.client_id===a.id);
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
await post({action:'delete',id:published.id},400);
await post({...draft,title:'Idea sin fecha',status:'Idea',date:''});
await post({...draft,title:'Wrong format',channel:'Email',format:'Reel'},400);
await post({...draft,title:'Missing review date',status:'En revisión',date:''},400);
await post({action:'client',id:a.id,name:'Cliente A actualizado',color:'#003680',notes:'Notas',archived:1});
assert.equal((await get()).clients.find(x=>x.id===a.id).archived,1);
await post({...draft,title:'Archived client'},400);
const exportResponse=await api.GET(new Request('https://test.local/api/workspace?export=1'));
assert.equal(exportResponse.status,200);assert.ok((await exportResponse.json()).reviews.length);
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
