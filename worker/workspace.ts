import type {Env,User} from './types';
import {importBackup} from './import-backup';
import {validateMaterial,materialLinks} from '../shared/material-links';
import {normalizeClientProfile} from '../shared/client-profile';
export function createWorkspaceApi(env:Env,user:User){
const statuses=['Idea','Borrador','En revisión','Cambios solicitados','Aprobado','Planificado','Publicado'];
const channels=['Instagram','LinkedIn','Email','Blog / web','TikTok','Facebook'];
const formats=['Reel','Carrusel','Historia','Imagen','Newsletter','Campaña de email','Artículo','Vídeo'];
const allowedFormats:Record<string,string[]>={Instagram:['Reel','Carrusel','Historia','Imagen'],Facebook:['Reel','Carrusel','Historia','Imagen','Vídeo'],LinkedIn:['Carrusel','Imagen','Vídeo','Artículo'],TikTok:['Vídeo','Imagen'],Email:['Newsletter','Campaña de email'],'Blog / web':['Artículo']};
const fail=(error:string,status=400)=>Response.json({error},{status});
async function context(){

 const db=env.DB!; const w:any=await db.prepare('SELECT * FROM workspace WHERE id=1').first();
 const member:any=w?await db.prepare('SELECT * FROM members WHERE email=?').bind(user.email.toLowerCase()).first():null;
 return {db,user,w,role:(w?.owner===user.userId||w?.email===user.email.toLowerCase())?'owner':member?.role??'none',clientId:member?.client_id};
}
async function GET(req?:Request){
 const c=await context(); if(!c)return fail('Inicia sesión para acceder.',401);
 if(!c.w&&c.user.email!==env.ADMIN_EMAIL?.trim().toLowerCase())return fail('El administrador debe configurar el espacio primero.',403);
 if(!c.w)return Response.json({needsSetup:true,user:c.user.displayName,clients:[],posts:[],comments:[],members:[],role:'owner'});
 if(c.role==='none')return fail('Tu cuenta no tiene acceso a este espacio. Pide al administrador que añada tu correo.',403);
 const preview=req?new URL(req.url).searchParams.get('preview'):null;
 if(preview){
  if(c.role!=='owner')return fail('Solo el administrador puede abrir una vista previa.',403);
  if(!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(preview).first())return fail('Cliente no encontrado.',404);
  c.role='client';c.clientId=preview;
 }
 const client=c.role==='client';
 if(req&&new URL(req.url).searchParams.get('export')==='1'){
  if(c.role!=='owner')return fail('Solo el administrador puede exportar.',403);
  const backup:any={exported_at:new Date().toISOString(),version:1};
  for(const table of ['clients','posts','comments','reviews','members'])backup[table]=(await c.db.prepare(`SELECT * FROM ${table}`).all()).results;
  return Response.json(backup,{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename=blau-content-backup.json'}});
 }
 const cl=await c.db.prepare(client?'SELECT * FROM clients WHERE id=?':'SELECT * FROM clients ORDER BY name').bind(...(client?[c.clientId]:[])).all();
 const p=await c.db.prepare(client?"SELECT * FROM posts WHERE client_id=? AND status NOT IN ('Idea','Borrador') ORDER BY date":"SELECT * FROM posts ORDER BY date").bind(...(client?[c.clientId]:[])).all();
 const scope=client?" WHERE post_id IN (SELECT id FROM posts WHERE client_id=? AND status NOT IN ('Idea','Borrador'))":'';
 const co=await c.db.prepare('SELECT * FROM comments'+scope+' ORDER BY created_at').bind(...(client?[c.clientId]:[])).all();
 const history=await c.db.prepare('SELECT id,post_id,actor,role,decision,snapshot,created_at FROM reviews'+scope+' ORDER BY created_at DESC').bind(...(client?[c.clientId]:[])).all();
 const m=c.role==='owner'?await c.db.prepare('SELECT * FROM members ORDER BY role,email').all():c.role==='team'?await c.db.prepare("SELECT email,role,client_id FROM members WHERE role='client' ORDER BY email").all():{results:[]};
 return Response.json({needsSetup:false,preview:!!preview,role:c.role,user:c.user.displayName,clients:cl.results,posts:p.results,comments:co.results,members:m.results,reviews:history.results},{headers:{'Cache-Control':'no-store'}});
}
function str(x:any,max=5000){return typeof x==='string'?x.trim().slice(0,max):'';}
async function POST(req:Request){
 const c=await context();if(!c)return fail('Inicia sesión para acceder.',401);
 const preview=new URL(req.url).searchParams.get('preview');
 if(preview){
  if(c.role!=='owner')return fail('Solo el administrador puede utilizar la vista de cliente.',403);
  if(!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(preview).first())return fail('Cliente no encontrado.',404);
  c.role='client';c.clientId=preview;
 }
 const origin=req.headers.get('origin'); if(origin&&origin!==new URL(req.url).origin)return fail('Origen no permitido.',403);
 let b:any;try{b=await req.json();}catch{return fail('Datos no válidos.');}
 if(!b||typeof b!=='object')return fail('Datos no válidos.');
 if(preview&&!['review','comment'].includes(b.action))return fail('Desde la vista de cliente solo puedes comentar o revisar publicaciones.',403);
 if(b.action==='init'){
  if(c.user.email!==env.ADMIN_EMAIL?.trim().toLowerCase())return fail('Solo el administrador configurado puede crear el espacio.',403);
  if(c.w)return fail('El espacio ya está configurado.',409);
  await c.db.prepare('INSERT OR IGNORE INTO workspace(id,owner,email) VALUES(1,?,?)').bind(c.user.userId,c.user.email.toLowerCase()).run();
  const w:any=await c.db.prepare('SELECT owner FROM workspace WHERE id=1').first();
  if(w.owner!==c.user.userId)return fail('El espacio pertenece a otra cuenta.',403);
  return Response.json({ok:true});
 }
 if(!c.w||c.role==='none')return fail('No tienes permiso para esta acción.',403);
 const staff=c.role==='owner'||c.role==='team';
 if(b.action==='import'){
  if(c.role!=='owner')return fail('Solo el administrador puede importar.',403);
  try{await importBackup(c.db,b.backup,c.user);}catch(e){return fail(e instanceof Error?e.message:'No se pudo importar.');}
 }else if(b.action==='deleteClient'){
  if(c.role!=='owner')return fail('Solo el administrador puede eliminar clientes.',403);
  const id=str(b.id),current=await c.db.prepare('SELECT id,name FROM clients WHERE id=?').bind(id).first<{id:string;name:string}>();
  if(!current)return fail('Cliente no encontrado.',404);
  if(typeof b.confirmName!=='string'||b.confirmName!==current.name)return fail('Escribe el nombre exacto del cliente para autorizar la eliminación.');
  // Every deletion checks the current name inside the same atomic batch, protecting against a concurrent rename.
  const guard='EXISTS (SELECT 1 FROM clients WHERE id=? AND name=?)';
  const results=await c.db.batch([
   c.db.prepare(`DELETE FROM reviews WHERE post_id IN (SELECT id FROM posts WHERE client_id=?) AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE client_id=?) AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM posts WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM members WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare('DELETE FROM clients WHERE id=? AND name=?').bind(id,current.name)
  ]);
  if(!results[4].meta.changes)return fail('El cliente ha cambiado. Vuelve a abrir su ficha antes de eliminarlo.',409);
 }else if(b.action==='client'){
  if(!staff)return fail('Solo el equipo puede gestionar clientes.',403);
  const name=str(b.name,100),color=str(b.color,7);if(!name||!/^#[0-9a-f]{6}$/i.test(color))return fail('Introduce nombre y color válidos.');
  let profile:string;try{const current=b.id?await c.db.prepare('SELECT profile FROM clients WHERE id=?').bind(str(b.id)).first<{profile:string}>():null;if(b.id&&!current)return fail('Cliente no encontrado.',404);profile=JSON.stringify(normalizeClientProfile(b.profile===undefined?current?.profile:b.profile));}catch(e){return fail(e instanceof Error?e.message:'Datos del cliente no válidos.');}
  if(b.id){await c.db.prepare('UPDATE clients SET name=?,color=?,notes=?,archived=?,profile=? WHERE id=?').bind(name,color,str(b.notes),b.archived?1:0,profile,str(b.id)).run();}
  else await c.db.prepare('INSERT INTO clients(id,name,color,notes,profile) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),name,color,str(b.notes),profile).run();
 }else if(b.action==='member'){
  if(c.role!=='owner')return fail('Solo el administrador puede gestionar accesos.',403);
  const email=str(b.email,254).toLowerCase(),role=b.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['team','client'].includes(role))return fail('Revisa el correo y el rol.');
  if(role==='client'&&!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(str(b.client_id)).first())return fail('Selecciona un cliente.');
  await c.db.prepare('INSERT INTO members(email,role,client_id) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,client_id=excluded.client_id').bind(email,role,role==='client'?b.client_id:null).run();
 }else if(b.action==='removeMember'){
  if(c.role!=='owner')return fail('Sin permiso.',403);
  await c.db.prepare('DELETE FROM members WHERE email=?').bind(str(b.email,254).toLowerCase()).run();
 }else if(['post','review','comment','delete'].includes(b.action)){
  const existing:any=b.id?await c.db.prepare('SELECT * FROM posts WHERE id=?').bind(str(b.id,100)).first():null;
  if(b.action!=='post'&&!existing)return fail('Publicación no encontrada.',404);
  if(b.id&&!existing)return fail('Publicación no encontrada.',404);
  if(existing&&['post','review'].includes(b.action)&&existing.updated_at!==b.updated_at)return fail('La publicación ha cambiado. Actualiza antes de continuar.',409);
  if(existing&&c.role==='client'&&(existing.client_id!==c.clientId||['Idea','Borrador'].includes(existing.status)))return fail('Sin permiso.',403);
  if(b.action==='comment'){
   const body=str(b.body);if(!body)return fail('Escribe un comentario.');
   await c.db.prepare('INSERT INTO comments(id,post_id,author,body,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,body,new Date().toISOString()).run();
  }else if(b.action==='review'){
   if(!['Aprobado','Cambios solicitados'].includes(b.status)||existing.status!=='En revisión')return fail('Solo se pueden revisar publicaciones pendientes.');
   if(b.status==='Cambios solicitados'&&!str(b.body))return fail('Indica los cambios que necesitas.');
   const now=new Date().toISOString();
   const version=now+':'+crypto.randomUUID();
   const operations=[c.db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=? AND updated_at=?').bind(b.status,version,existing.id,b.updated_at),c.db.prepare('INSERT INTO reviews(id,post_id,actor,email,role,decision,snapshot,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,c.user.email,preview?'team':c.role,b.status,JSON.stringify(existing),now,existing.id,version)];
   if(str(b.body))operations.push(c.db.prepare('INSERT INTO comments(id,post_id,author,body,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,str(b.body),now,existing.id,version));
   const results=await c.db.batch(operations);
   if(!results[0].meta.changes)return fail('La publicación ha cambiado. Actualiza antes de aprobar.',409);
  }else if(b.action==='delete'){
   if(!staff)return fail('Sin permiso.',403);
   if(existing.status==='Publicado')return fail('Conserva el registro publicado. Puedes crear una nueva versión.');
   await c.db.batch([c.db.prepare('DELETE FROM reviews WHERE post_id=?').bind(existing.id),c.db.prepare('DELETE FROM comments WHERE post_id=?').bind(existing.id),c.db.prepare('DELETE FROM posts WHERE id=?').bind(existing.id)]);
  }else{
   if(!staff)return fail('Solo el equipo puede editar contenidos.',403);
   const title=str(b.title,160),copy=str(b.copy,15000),asset=materialLinks(str(b.asset,42000)).join('\n'),date=str(b.date,16);
   if(!title||!channels.includes(b.channel)||!formats.includes(b.format)||!statuses.includes(b.status)||(date?(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))):!['Idea','Borrador'].includes(b.status)))return fail('Revisa título, fecha, canal y formato.');
   if(date&&new Date(date+'Z').toISOString().slice(0,16)!==date)return fail('La fecha no existe. Revisa el día y la hora.');
   if(!allowedFormats[b.channel]?.includes(b.format))return fail('El formato no corresponde a esta plataforma.');
   if(existing?.status==='Publicado')return fail('Las publicaciones publicadas se conservan. Crea una nueva versión para modificarlas.');
   if(typeof b.asset==='string'&&b.asset.length>42000)return fail('Los enlaces de material son demasiado largos.');const materialError=validateMaterial(asset,b.format);if(materialError)return fail(materialError);
   if(!await c.db.prepare('SELECT id FROM clients WHERE id=? AND archived=0').bind(str(b.client_id)).first())return fail('Selecciona un cliente activo.');
   if(existing&&existing.client_id!==b.client_id)return fail('El cliente de una publicación no se puede cambiar.');
   const changed=existing&&['title','copy','channel','format','date','asset'].some(k=>existing[k]!==({title,copy,date,asset,channel:b.channel,format:b.format} as any)[k]);
   const status=changed&&['Aprobado','Planificado','Publicado'].includes(existing.status)?'En revisión':b.status;
   if(!existing&&['Aprobado','Planificado','Publicado'].includes(status))return fail('Crea el borrador y envíalo a revisión antes de aprobarlo.');
   if(existing&&['Aprobado','Planificado','Publicado'].includes(status)&&!['Aprobado','Planificado','Publicado'].includes(existing.status))return fail('Aprueba el contenido desde la revisión.');
   const now=new Date().toISOString()+':'+crypto.randomUUID();
   if(existing){const r=await c.db.prepare('UPDATE posts SET title=?,copy=?,channel=?,format=?,date=?,status=?,asset=?,updated_at=? WHERE id=? AND updated_at=?').bind(title,copy,b.channel,b.format,date,status,asset,now,existing.id,b.updated_at).run();if(!r.meta.changes)return fail('Otra persona ha actualizado esta publicación. Recarga para ver los cambios.',409);}
   else await c.db.prepare('INSERT INTO posts(id,client_id,title,copy,channel,format,date,status,asset,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.client_id,title,copy,b.channel,b.format,date,status,asset,now).run();
  }
 }else return fail('Acción desconocida.');
 return Response.json({ok:true});
}

return {GET,POST};
}
