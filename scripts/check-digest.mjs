import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
async function module(file){const bundle=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));}
const {madridSlot,sendDigests}=await module('worker/email-digest.ts');
assert.deepEqual(madridSlot(new Date('2026-10-27T09:00:00Z')),{hour:10,slot:'2026-10-27 10:00',weekend:false});assert.deepEqual(madridSlot(new Date('2026-07-15T08:30:00Z')),{hour:10,slot:'2026-07-15 10:00',weekend:false});assert.equal(madridSlot(new Date('2026-10-27T21:05:00Z')).hour,22);assert.equal(madridSlot(new Date('2026-11-01T23:30:00Z')).weekend,false);assert.equal(madridSlot(new Date('2026-10-31T22:30:00Z')).weekend,true);
const sql=new DatabaseSync(':memory:');for(const m of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('migrations/'+m,'utf8'));
class Statement{constructor(q,a=[]){this.q=q;this.a=a;}bind(...a){return new Statement(this.q,a);}async first(){return sql.prepare(this.q).get(...this.a)??null;}async all(){return {results:sql.prepare(this.q).all(...this.a)};}async run(){const r=sql.prepare(this.q).run(...this.a);return {meta:{changes:Number(r.changes)}};}}
const db={prepare:q=>new Statement(q)};
sql.exec(`INSERT INTO workspace(id,owner,email,owner_name) VALUES(1,'owner-id','owner@example.com','Camilo de Blau');
INSERT INTO clients(id,name,color,notes) VALUES('a','Luster','#000',''),('b','Otra marca','#000','');
INSERT INTO members(email,role,client_id) VALUES('team@example.com','team',NULL),('cliente@a.com','client','a'),('cliente@b.com','client','b'),('colab@a.com','collaborator','a');
INSERT INTO posts(id,client_id,title,channel,format,date,status,updated_at,client_changed_at) VALUES
('p1','a','Reel nuevo','Instagram','Reel','2026-10-30T10:00','En revisión','2026-10-27T15:00:00.000Z:v1',''),
('p2','a','Borrador oculto','Instagram','Reel','','Borrador','2026-10-27T15:00:00.000Z:v2',''),
('p3','a','Aprobado por cliente','LinkedIn','Imagen','','Aprobado','2026-10-27T16:00:00.000Z:v3',''),
('p4','b','Post de B','Instagram','Reel','','Cambios solicitados','2026-10-27T17:00:00.000Z:v4',''),
('p5','a','Reasignado','Instagram','Reel','','En revisión','2026-10-20T15:00:00.000Z:v5','2026-10-27T14:30:00.000Z');
INSERT INTO reviews VALUES('r1','p3','Ana','cliente@a.com','client','Aprobado','{}','2026-10-27T16:00:00.000Z'),('r2','p4','Bea','cliente@b.com','client','Cambios solicitados','{}','2026-10-27T17:00:00.000Z');
INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) VALUES
('c1','p1','Ana','¿Podemos cambiar la portada?','2026-10-27T15:30:00.000Z','client',0),
('c2','p4','Bea','Cambia el texto','2026-10-27T17:00:00.000Z','client',0),
('c3','p1','owner@example.com','Hecho, revisa la nueva versión','2026-10-27T16:30:00.000Z','team',1),
('c4','p2','camilo@agenciablau.com','Nota interna en borrador','2026-10-27T16:30:00.000Z','team',1),
('c5','p5','camilo@agenciablau.com','Comentario antes de reasignar','2026-10-27T14:00:00.000Z','team',1),
('c6','p1','Ana','Comentario antiguo','2026-10-26T15:30:00.000Z','client',0);`);
const sent=[];globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.brevo.com/v3/smtp/email');assert.equal(init.headers['api-key'],'fake-brevo-key');const b=JSON.parse(init.body);assert.equal(b.to.length,1);sent.push({to:b.to[0].email,html:b.htmlContent,text:b.textContent,subject:b.subject});return new Response('{}',{status:201});};
const env={DB:db,BREVO_API_KEY:'fake-brevo-key',EMAIL_FROM:'avisos@example.com',APP_ORIGIN:'https://app.example.com'};
sql.exec(`INSERT INTO email_digests VALUES('team:2026-10-27 10:00','2026-10-26T21:00:00.000Z','2026-10-27T09:00:00.000Z',0,'','2026-10-27T09:00:00.000Z'),('client:2026-10-27 10:00','2026-10-26T21:00:00.000Z','2026-10-27T09:00:00.000Z',0,'','2026-10-27T09:00:00.000Z')`);
await sendDigests({...env,BREVO_API_KEY:undefined},new Date('2026-10-27T21:00:00Z'));assert.equal(sent.length,0);
await sendDigests(env,new Date('2026-10-27T20:59:00Z'));assert.equal(sent.length,0);
await sendDigests(env,new Date('2026-10-27T21:00:00Z'));
const by=e=>sent.filter(s=>s.to===e);
assert.deepEqual(sent.map(s=>s.to).sort(),['owner@example.com','team@example.com']);
const owner=by('owner@example.com')[0].text;
assert.match(owner,/Luster/);assert.match(owner,/Otra marca/);assert.match(owner,/Aprobado por cliente \(LinkedIn · Imagen · por Ana\)/);assert.match(owner,/Post de B \(Instagram · Reel · Bea\): Cambia el texto/);assert.equal(by('owner@example.com')[0].subject,'Blau · 1 cambio pedido · 1 aprobada · 1 comentario');assert.match(by('owner@example.com')[0].html,/RESUMEN · 22:00/);assert.match(by('owner@example.com')[0].html,/a las 10:00 y a las 22:00/);assert.match(owner,/¿Podemos cambiar la portada\?/);assert.doesNotMatch(owner,/Comentario antiguo/);assert.equal((owner.match(/Cambia el texto/g)||[]).length,1);
await sendDigests(env,new Date('2026-10-27T21:30:00Z'));assert.equal(sent.length,2);assert.equal(sql.prepare("SELECT sent FROM email_digests WHERE slot='team:2026-10-27 22:00'").get().sent,2);assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_digests WHERE slot='client:2026-10-27 22:00'").get().n,0);
sent.length=0;await sendDigests(env,new Date('2026-10-28T09:00:00Z'));
assert.deepEqual(sent.map(s=>s.to),['cliente@a.com']);const ca=by('cliente@a.com')[0].text;
assert.match(ca,/Pendientes de tu aprobación/);assert.match(ca,/Reel nuevo/);assert.match(ca,/Reel nuevo · Camilo de Blau: Hecho, revisa la nueva versión/);assert.doesNotMatch(ca,/owner@example\.com/);assert.match(by('cliente@a.com')[0].html,/Tienes contenido listo para revisar/);assert.match(by('cliente@a.com')[0].html,/a las 10:00 y a las 16:00, de lunes a viernes/);
for(const hidden of ['Borrador oculto','Nota interna','Post de B','Otra marca','Aprobado por cliente','Comentario antes de reasignar'])assert.doesNotMatch(ca,new RegExp(hidden));
assert.match(by('cliente@a.com')[0].html,/https:\/\/app\.example\.com/);assert.equal(by('colab@a.com').length,0);
assert.equal(sql.prepare("SELECT window_from FROM email_digests WHERE slot='client:2026-10-28 10:00'").get().window_from,'2026-10-27T09:00:00.000Z');
sent.length=0;await sendDigests(env,new Date('2026-10-28T09:30:00Z'));assert.equal(sent.length,0);
sql.exec(`INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) VALUES('c8','p1','camilo@agenciablau.com','Respuesta del sábado','2026-10-31T08:00:00.000Z','team',1)`);
await sendDigests(env,new Date('2026-10-31T09:00:00Z'));assert.equal(sent.length,0);assert.equal(sql.prepare("SELECT COUNT(*) n FROM email_digests WHERE slot LIKE 'client:2026-10-31%'").get().n,0);
await sendDigests(env,new Date('2026-11-02T09:00:00Z'));assert.deepEqual(sent.map(s=>s.to),['cliente@a.com']);assert.match(sent[0].text,/Respuesta del sábado/);assert.equal(sql.prepare("SELECT window_from FROM email_digests WHERE slot='client:2026-11-02 10:00'").get().window_from,'2026-10-28T09:00:00.000Z');
sql.exec(`INSERT INTO posts(id,client_id,title,channel,format,date,status,updated_at,client_changed_at) VALUES('p6','a','Solo planificado','Instagram','Reel','','Planificado','2026-11-03T08:00:00.000Z:v6','')`);
sent.length=0;await sendDigests(env,new Date('2026-11-03T09:00:00Z'));assert.equal(sent.length,0);
sql.exec(`INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) VALUES('c7','p1','Ana','<script>x</script>','2026-11-03T10:00:00.000Z','client',0)`);
globalThis.fetch=async()=>new Response('{}',{status:500});await sendDigests(env,new Date('2026-11-03T21:00:00Z'));
const failed=sql.prepare("SELECT * FROM email_digests WHERE slot='team:2026-11-03 22:00'").get();assert.equal(failed.sent,0);assert.match(failed.error,/Brevo 500/);
const {sendDigestTest}=await module('worker/email-digest.ts');await assert.rejects(sendDigestTest({DB:db},'owner@example.com'),/BREVO_API_KEY/);sent.length=0;globalThis.fetch=async(url,init)=>{const b=JSON.parse(init.body);sent.push({to:b.to[0].email,subject:b.subject,html:b.htmlContent});return new Response('{}',{status:201});};await sendDigestTest(env,'owner@example.com');assert.equal(sent.length,2);assert.ok(sent.every(s=>s.to==='owner@example.com'&&s.subject.startsWith('[Prueba')));assert.match(sent[1].html,/Tienes contenido listo para revisar/);
globalThis.fetch=async()=>Response.json({message:'Key not found'},{status:401});await assert.rejects(sendDigestTest(env,'owner@example.com'),/Brevo 401: Key not found/);
console.log('Passed: names instead of emails, test send to the owner only, client digests at 10:00 and 16:00 on weekdays only when actionable, Madrid digest slots, once per slot, team and client recipients, client isolation, hidden drafts, client_changed_at, deduplicated change notes, Brevo errors recorded and no send without key.');
