import {bufferQuery,remotePostFields} from './buffer-api';
import type {Env,User} from './types';
import {importBackup} from './import-backup';
import {validateMaterial,materialLinks} from '../shared/material-links';
import {normalizeClientProfile} from '../shared/client-profile';
import {lockedBufferStates,bufferState} from '../shared/buffer-scheduling';
import {sendWelcome} from './email-welcome';
export function createWorkspaceApi(env:Env,user:User){
const statuses=['Idea','Borrador','En revisión','Cambios solicitados','Aprobado','Planificado','Publicado'];
const channels=['Instagram','LinkedIn','Email','Blog / web','TikTok','Facebook'];
const formats=['Reel','Carrusel','Historia','Imagen','Newsletter','Campaña de email','Artículo','Vídeo'];
const allowedFormats:Record<string,string[]>={Instagram:['Reel','Carrusel','Historia','Imagen'],Facebook:['Reel','Carrusel','Historia','Imagen','Vídeo'],LinkedIn:['Carrusel','Imagen','Vídeo','Artículo'],TikTok:['Vídeo','Imagen'],Email:['Newsletter','Campaña de email'],'Blog / web':['Artículo']};
const fail=(error:string,status=400)=>Response.json({error},{status});
async function context(){

 const db=env.DB!; const w:any=await db.prepare('SELECT * FROM workspace WHERE id=1').first();
 const member:any=w?await db.prepare('SELECT * FROM members WHERE email=?').bind(user.email.toLowerCase()).first():null;
 return {db,user,w,role:(w?.owner===user.userId||w?.email===user.email.toLowerCase())?'owner':(['team','client','collaborator'].includes(member?.role)?member.role:'none'),clientId:member?.client_id};
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
 const client=c.role==='client',scoped=client||c.role==='collaborator';
 if(scoped&&(!c.clientId||!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(c.clientId).first()))return fail('Tu acceso no tiene una marca asignada válida.',403);
 if(req&&new URL(req.url).searchParams.get('export')==='1'){
  if(c.role!=='owner')return fail('Solo el administrador puede exportar.',403);
  const backup:any={exported_at:new Date().toISOString(),version:1};
  for(const table of ['clients','posts','comments','reviews','members'])backup[table]=(await c.db.prepare(`SELECT * FROM ${table}`).all()).results;
  backup.owner_name=c.w.owner_name??'';
  return Response.json(backup,{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename=blau-content-backup.json'}});
 }
 const cl=await c.db.prepare(scoped?'SELECT * FROM clients WHERE id=?':'SELECT * FROM clients ORDER BY name').bind(...(scoped?[c.clientId]:[])).all();
 const p=await c.db.prepare(client?"SELECT * FROM posts WHERE client_id=? AND status NOT IN ('Idea','Borrador') ORDER BY date":scoped?"SELECT * FROM posts WHERE client_id=? ORDER BY date":"SELECT * FROM posts ORDER BY date").bind(...(scoped?[c.clientId]:[])).all();
 const scope=client?" WHERE post_id IN (SELECT id FROM posts WHERE client_id=? AND status NOT IN ('Idea','Borrador'))":scoped?" WHERE post_id IN (SELECT id FROM posts WHERE client_id=?)":'';
 const commentScope=scope+(scoped?' AND created_at > (SELECT client_changed_at FROM posts WHERE posts.id=comments.post_id)':'');
 const reviewScope=scope+(scoped?' AND created_at > (SELECT client_changed_at FROM posts WHERE posts.id=reviews.post_id)':'');
 const co=await c.db.prepare('SELECT * FROM comments'+commentScope+' ORDER BY created_at, rowid').bind(...(scoped?[c.clientId]:[])).all();
 const history=await c.db.prepare('SELECT id,post_id,actor,role,decision,snapshot,created_at FROM reviews'+reviewScope+' ORDER BY created_at DESC').bind(...(scoped?[c.clientId]:[])).all();
 const m=c.role==='owner'?await c.db.prepare('SELECT * FROM members ORDER BY role,email').all():c.role==='team'?await c.db.prepare("SELECT email,role,client_id,name FROM members WHERE role IN ('client','collaborator') ORDER BY email").all():{results:[]};
 const jobs=await c.db.prepare('SELECT post_id,state,mode,error,updated_at FROM buffer_jobs'+(client?" WHERE client_id=? AND post_id IN (SELECT id FROM posts WHERE status NOT IN ('Idea','Borrador'))":scoped?" WHERE client_id=?":'')).bind(...(scoped?[c.clientId]:[])).all();
 const names=new Map<string,string>((await c.db.prepare("SELECT email,name FROM members WHERE name<>''").all<any>()).results.map((r:any)=>[r.email,r.name]));if(c.w.owner_name)names.set(c.w.email,c.w.owner_name);
 const named=(v:string)=>names.get(String(v??'').toLowerCase())||v;
 return Response.json({needsSetup:false,preview:!!preview,role:c.role,user:c.user.displayName,userName:named(c.user.email)===c.user.email?'':named(c.user.email),...(c.role==='owner'?{ownerName:c.w.owner_name??''}:{}),clients:cl.results.map((record:any)=>{if(c.role==='owner')return record;const profile=JSON.parse(record.profile||'{}');delete profile.drive_folder_url;if(scoped)delete profile.links;return {...record,profile:JSON.stringify(profile)};}),posts:p.results.map((post:any)=>({...post,buffer:jobs.results.find((job:any)=>job.post_id===post.id)??null})), comments:co.results.map((x:any)=>({...x,author:named(x.author)})),members:m.results,reviews:history.results.map((x:any)=>({...x,actor:named(x.actor)}))},{headers:{'Cache-Control':'no-store'}});
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
 const extra:any={};
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
 const staff=c.role==='owner'||c.role==='team',collaborator=c.role==='collaborator';
 if(collaborator&&(!c.clientId||!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(c.clientId).first()))return fail('Tu acceso no tiene una marca asignada válida.',403);
 if(b.action==='import'){
  if(c.role!=='owner')return fail('Solo el administrador puede importar.',403);
  try{await importBackup(c.db,b.backup,c.user);}catch(e){return fail(e instanceof Error?e.message:'No se pudo importar.');}
 }else if(b.action==='deleteClient'){
  if(c.role!=='owner')return fail('Solo el administrador puede eliminar clientes.',403);
  const id=str(b.id),current=await c.db.prepare('SELECT id,name FROM clients WHERE id=?').bind(id).first<{id:string;name:string}>();
  if(!current)return fail('Cliente no encontrado.',404);
  if(typeof b.confirmName!=='string'||b.confirmName!==current.name)return fail('Escribe el nombre exacto del cliente para autorizar la eliminación.');
  if(await c.db.prepare("SELECT post_id FROM buffer_jobs WHERE client_id=? AND state NOT IN ('sent','error','cancelled') LIMIT 1").bind(id).first())return fail('Hay envíos activos o sin confirmar en Buffer. Cancélalos o actualiza su estado antes de eliminar el cliente.',409);
  // Every deletion checks the current name inside the same atomic batch, protecting against a concurrent rename.
  const cleanupRows=await c.db.prepare('SELECT assets FROM buffer_jobs WHERE client_id=?').bind(id).all<{assets:string}>();
  const cleanupKeys=cleanupRows.results.flatMap(row=>JSON.parse(row.assets).map((asset:any)=>asset.key));const cleanupId=crypto.randomUUID();
  const guard="EXISTS (SELECT 1 FROM clients WHERE id=? AND name=? AND NOT EXISTS (SELECT 1 FROM buffer_jobs WHERE client_id=clients.id AND state NOT IN ('sent','error','cancelled')))";
  const results=await c.db.batch([
   c.db.prepare(`INSERT INTO media_cleanup(id,object_keys,created_at) SELECT ?,?,? WHERE ${guard}`).bind(cleanupId,JSON.stringify(cleanupKeys),new Date().toISOString(),id,current.name),
   c.db.prepare(`DELETE FROM reviews WHERE post_id IN (SELECT id FROM posts WHERE client_id=?) AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE client_id=?) AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM buffer_jobs WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM posts WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM members WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM buffer_bindings WHERE client_id=? AND ${guard}`).bind(id,id,current.name),
   c.db.prepare(`DELETE FROM clients WHERE id=? AND name=? AND ${guard}`).bind(id,current.name,id,current.name)
  ]);
  if(!results[7].meta.changes)return fail('El cliente ha cambiado o tiene un envío nuevo. Vuelve a abrir su ficha antes de eliminarlo.',409);
  try{if(cleanupKeys.length){if(!env.MEDIA)throw Error('R2 no disponible');await env.MEDIA.delete(cleanupKeys);}await c.db.prepare('DELETE FROM media_cleanup WHERE id=?').bind(cleanupId).run();}catch{/* Keep the cleanup queue for the administrator; the database deletion succeeded. */}
 }else if(b.action==='client'){
  if(!staff)return fail('Solo el equipo puede gestionar clientes.',403);
  const name=str(b.name,100),color=str(b.color,7);if(!name||!/^#[0-9a-f]{6}$/i.test(color))return fail('Introduce nombre y color válidos.');
  let profile:string;try{const current=b.id?await c.db.prepare('SELECT profile FROM clients WHERE id=?').bind(str(b.id)).first<{profile:string}>():null;if(b.id&&!current)return fail('Cliente no encontrado.',404);const nextProfile=normalizeClientProfile(b.profile===undefined?current?.profile:b.profile);if(c.role!=='owner')nextProfile.drive_folder_url=normalizeClientProfile(current?.profile).drive_folder_url;profile=JSON.stringify(nextProfile);if(c.role!=='owner'&&JSON.stringify(normalizeClientProfile(profile).monthly_goals)!==JSON.stringify(normalizeClientProfile(current?.profile).monthly_goals))return fail('Solo el administrador puede cambiar el compromiso mensual.',403);}catch(e){return fail(e instanceof Error?e.message:'Datos del cliente no válidos.');}
  if(b.id){await c.db.prepare('UPDATE clients SET name=?,color=?,notes=?,archived=?,profile=? WHERE id=?').bind(name,color,str(b.notes),b.archived?1:0,profile,str(b.id)).run();}
  else await c.db.prepare('INSERT INTO clients(id,name,color,notes,profile) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),name,color,str(b.notes),profile).run();
 }else if(b.action==='member'){
  if(c.role!=='owner')return fail('Solo el administrador puede gestionar accesos.',403);
  const email=str(b.email,254).toLowerCase(),role=b.role;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['team','client','collaborator'].includes(role))return fail('Revisa el correo y el rol.');
  if(['client','collaborator'].includes(role)&&!await c.db.prepare('SELECT id FROM clients WHERE id=?').bind(str(b.client_id)).first())return fail('Selecciona un cliente.');
  let drive:string|undefined;if(['client','collaborator'].includes(role)&&Object.hasOwn(b,'drive_folder_url')){try{drive=normalizeClientProfile({drive_folder_url:b.drive_folder_url}).drive_folder_url;}catch(e){return fail(e instanceof Error?e.message:'Enlace de Drive no válido.');}}
  const operations=[c.db.prepare('INSERT INTO members(email,role,client_id,name) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,client_id=excluded.client_id,name=excluded.name').bind(email,role,['client','collaborator'].includes(role)?str(b.client_id):null,str(b.name,80))];
  if(drive!==undefined)operations.push(c.db.prepare("UPDATE clients SET profile=json_set(COALESCE(profile,'{}'),'$.drive_folder_url',?) WHERE id=?").bind(drive,str(b.client_id)));
  const isNew=!await c.db.prepare('SELECT 1 FROM members WHERE email=?').bind(email).first();
  await c.db.batch(operations);
  if(isNew)extra.welcome=await sendWelcome(env,{name:str(b.name,80),email,role,brand:role==='team'?'':(await c.db.prepare('SELECT name FROM clients WHERE id=?').bind(str(b.client_id)).first<any>())?.name??''});
 }else if(b.action==='welcome'){
  if(c.role!=='owner')return fail('Sin permiso.',403);
  const m=await c.db.prepare('SELECT m.email,m.role,m.name,cl.name AS brand FROM members m LEFT JOIN clients cl ON cl.id=m.client_id WHERE m.email=?').bind(str(b.email,254).toLowerCase()).first<any>();if(!m)return fail('Acceso no encontrado.',404);
  extra.welcome=await sendWelcome(env,{name:m.name,email:m.email,role:m.role,brand:m.role==='team'?'':m.brand??''});
 }else if(b.action==='ownerName'){
  if(c.role!=='owner')return fail('Sin permiso.',403);
  await c.db.prepare('UPDATE workspace SET owner_name=? WHERE id=1').bind(str(b.name,80)).run();
 }else if(b.action==='removeMember'){
  if(c.role!=='owner')return fail('Sin permiso.',403);
  await c.db.prepare('DELETE FROM members WHERE email=?').bind(str(b.email,254).toLowerCase()).run();
 }else if(['post','review','comment','delete'].includes(b.action)){
  const existing:any=b.id?await c.db.prepare('SELECT * FROM posts WHERE id=?').bind(str(b.id,100)).first():null;
  if(b.action!=='post'&&!existing)return fail('Publicación no encontrada.',404);
  if(b.id&&!existing)return fail('Publicación no encontrada.',404);
  if(collaborator&&((existing&&existing.client_id!==c.clientId)||(b.action==='post'&&b.client_id!==c.clientId)))return fail('Sin permiso.',403);
  if(existing&&['post','review'].includes(b.action)&&existing.updated_at!==b.updated_at)return fail('La publicación ha cambiado. Actualiza antes de continuar.',409);
  if(existing&&c.role==='client'&&(existing.client_id!==c.clientId||['Idea','Borrador'].includes(existing.status)))return fail('Sin permiso.',403);
  if(b.action==='comment'){
   const body=str(b.body);if(!body)return fail('Escribe un comentario.');
   const result=await c.db.prepare('INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) SELECT ?,?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND client_id=? AND client_changed_at=?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,body,new Date().toISOString(),c.role==='client'&&!preview?'client':'team',existing.id,existing.client_id,existing.client_changed_at??'').run();if(!result.meta.changes)return fail('La publicación ha cambiado de cliente. Actualiza antes de comentar.',409);
  }else if(b.action==='review'){
   if(collaborator)return fail('La aprobación corresponde al cliente.',403);
   if(!['Aprobado','Cambios solicitados'].includes(b.status)||existing.status!=='En revisión')return fail('Solo se pueden revisar publicaciones pendientes.');
   if(b.status==='Cambios solicitados'&&!str(b.body))return fail('Indica los cambios que necesitas.');
   const now=new Date().toISOString();
   const version=now+':'+crypto.randomUUID();
   const operations=[c.db.prepare('UPDATE posts SET status=?,updated_at=? WHERE id=? AND updated_at=?').bind(b.status,version,existing.id,b.updated_at),c.db.prepare('INSERT INTO reviews(id,post_id,actor,email,role,decision,snapshot,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,c.user.email,preview?'team':c.role,b.status,JSON.stringify(existing),now,existing.id,version)];
   if(!preview&&c.role==='client'&&b.status==='Aprobado'&&existing.channel==='Instagram'&&existing.format==='Historia')operations.push(c.db.prepare("INSERT INTO buffer_jobs(post_id,client_id,state,mode,snapshot,created_at,updated_at) SELECT id,client_id,'queued','automatic',?,?,? FROM posts WHERE id=? AND updated_at=? ON CONFLICT(post_id) DO UPDATE SET state='queued',mode='automatic',snapshot=excluded.snapshot,error='',updated_at=excluded.updated_at WHERE buffer_jobs.state IN ('error','cancelled') AND buffer_jobs.assets='[]'").bind(JSON.stringify({approvedVersion:version}),now,now,existing.id,version));
   if(str(b.body))operations.push(c.db.prepare('INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),existing.id,c.user.displayName,str(b.body),now,c.role==='client'&&!preview?'client':'team',b.status==='Aprobado'?1:0,existing.id,version));
   if(b.status==='Aprobado')operations.push(c.db.prepare('UPDATE comments SET resolved=1 WHERE post_id=? AND EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(existing.id,existing.id,version));
   const results=await c.db.batch(operations);
   if(!results[0].meta.changes)return fail('La publicación ha cambiado. Actualiza antes de aprobar.',409);
  }else if(b.action==='delete'){
   if(!staff)return fail('Sin permiso.',403);
   let buffer=await c.db.prepare('SELECT state,remote_id,mode FROM buffer_jobs WHERE post_id=?').bind(existing.id).first<{state:string;remote_id:string|null;mode:string}>();
   if(buffer&&lockedBufferStates.includes(buffer.state)&&buffer.remote_id){
    try{
     const remote=await bufferQuery(env,'query($input:PostInput!){post(input:$input){'+remotePostFields+'}}',{input:{id:buffer.remote_id}});
     if(!remote.post)return fail('Buffer no encuentra este envío. Revisa su estado en Integraciones antes de eliminarlo.',409);
     const state=bufferState({...remote.post,schedulingType:remote.post.schedulingType??buffer.mode});
     if(state==='sent'){
      await c.db.prepare("UPDATE buffer_jobs SET state='sent',error='',updated_at=?,completed_at=? WHERE post_id=? AND remote_id=?").bind(new Date().toISOString(),new Date().toISOString(),existing.id,buffer.remote_id).run();
      buffer={...buffer,state};
     }
    }catch{return fail('No se pudo comprobar el envío en Buffer. Inténtalo de nuevo antes de eliminarlo.',409);}
   }
   if(buffer&&lockedBufferStates.includes(buffer.state))return fail('Buffer aún no confirma la publicación. Cancela o resuelve el envío antes de eliminarla.',409);
   const guard=`EXISTS (SELECT 1 FROM posts WHERE id=? AND updated_at=? AND NOT EXISTS (SELECT 1 FROM buffer_jobs WHERE post_id=posts.id AND state IN (${lockedBufferStates.map(s=>"'"+s+"'").join(',')})))`;
   const cleanupId=crypto.randomUUID();
   const deleted=await c.db.batch([c.db.prepare(`INSERT INTO media_cleanup(id,object_keys,created_at) SELECT ?,(SELECT json_group_array(json_extract(value,'$.key')) FROM json_each(buffer_jobs.assets)),? FROM buffer_jobs WHERE post_id=? AND assets<>'[]' AND ${guard}`).bind(cleanupId,new Date().toISOString(),existing.id,existing.id,existing.updated_at),...['reviews','comments','buffer_jobs','posts'].map(table=>c.db.prepare(`DELETE FROM ${table} WHERE ${table==='posts'?'id':'post_id'}=? AND ${guard}`).bind(existing.id,existing.id,existing.updated_at))]);
   if(!deleted[4].meta.changes)return fail('La publicación ha cambiado o tiene un envío activo. Actualiza antes de eliminarla.',409);
  }else{
   if(!staff&&!collaborator)return fail('Solo el equipo puede editar contenidos.',403);
   const title=str(b.title,160),copy=str(b.copy,15000),asset=materialLinks(str(b.asset,42000)).join('\n'),date=str(b.date,16);
   if(!title||!channels.includes(b.channel)||!formats.includes(b.format)||!statuses.includes(b.status)||(date?(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))):!['Idea','Borrador'].includes(b.status)))return fail('Revisa título, fecha, canal y formato.');
   if(date&&new Date(date+'Z').toISOString().slice(0,16)!==date)return fail('La fecha no existe. Revisa el día y la hora.');
   if(!allowedFormats[b.channel]?.includes(b.format))return fail('El formato no corresponde a esta plataforma.');
   if(existing?.status==='Publicado')return fail('Las publicaciones publicadas se conservan. Crea una nueva versión para modificarlas.');
   if(typeof b.asset==='string'&&b.asset.length>42000)return fail('Los enlaces de material son demasiado largos.');const materialError=validateMaterial(asset,b.format);if(materialError)return fail(materialError);
   if(!await c.db.prepare('SELECT id FROM clients WHERE id=? AND archived=0').bind(str(b.client_id)).first())return fail('Selecciona un cliente activo.');
   const reassign=!!existing&&existing.client_id!==b.client_id;
   if(reassign&&c.role!=='owner')return fail('Solo el administrador puede cambiar el cliente de una publicación.',403);
   if(reassign&&await c.db.prepare('SELECT post_id FROM buffer_jobs WHERE post_id=?').bind(existing.id).first())return fail('Esta publicación tiene un envío registrado en Buffer. Crea una nueva versión para asignarla a otro cliente.',409);
   if(existing){const buffer=await c.db.prepare('SELECT state FROM buffer_jobs WHERE post_id=?').bind(existing.id).first<{state:string}>();if(buffer&&lockedBufferStates.includes(buffer.state))return fail('Cancela o resuelve el envío en Buffer antes de editar esta publicación.',409);}
   const changed=existing&&['title','copy','channel','format','date','asset'].some(k=>existing[k]!==({title,copy,date,asset,channel:b.channel,format:b.format} as any)[k]);
   const status=reassign?(existing.status==='Idea'?'Idea':'Borrador'):changed&&['Aprobado','Planificado','Publicado'].includes(existing.status)?'En revisión':b.status;
   if(!existing&&['Aprobado','Planificado','Publicado'].includes(status))return fail('Crea el borrador y envíalo a revisión antes de aprobarlo.');
   if(existing&&['Aprobado','Planificado','Publicado'].includes(status)&&!['Aprobado','Planificado','Publicado'].includes(existing.status))return fail('Aprueba el contenido desde la revisión.');
   if(collaborator&&['Aprobado','Planificado','Publicado'].includes(status))return fail('El colaborador puede preparar y enviar contenido a revisión.',403);
   const changedAt=new Date().toISOString();
   const now=changedAt+':'+crypto.randomUUID();
   if(existing){const r=await c.db.prepare(`UPDATE posts SET title=?,copy=?,channel=?,format=?,date=?,status=?,asset=?,updated_at=?,client_id=?,client_changed_at=? WHERE id=? AND updated_at=? AND (?=0 OR NOT EXISTS (SELECT 1 FROM buffer_jobs WHERE post_id=posts.id)) AND NOT EXISTS (SELECT 1 FROM buffer_jobs WHERE post_id=posts.id AND state IN (${lockedBufferStates.map(s=>"'"+s+"'").join(',')}))`).bind(title,copy,b.channel,b.format,date,status,asset,now,b.client_id,reassign?changedAt:existing.client_changed_at??'',existing.id,b.updated_at,reassign?1:0).run();if(!r.meta.changes)return fail('Otra persona ha actualizado esta publicación. Recarga para ver los cambios.',409);}
   else await c.db.prepare('INSERT INTO posts(id,client_id,title,copy,channel,format,date,status,asset,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),b.client_id,title,copy,b.channel,b.format,date,status,asset,now).run();
  }
 }else return fail('Acción desconocida.');
 return Response.json({ok:true,...extra});
}

return {GET,POST};
}
