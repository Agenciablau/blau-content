import type {Env,User} from './types';
import {bufferQuery,instagramChannels,BufferRequestError,remotePostFields} from './buffer-api';
import {beginDrive,finishDrive,driveConfigured,driveAccessToken,copyDriveFile,mediaOrigin} from './drive-api';
import {materialLinks,MAX_CAROUSEL_IMAGES} from '../shared/material-links';
import {madridToUtc,bufferState,lockedBufferStates,bufferFormats} from '../shared/buffer-scheduling';
import {sendDigestTest} from './email-digest';
const fail=(error:string,status=400)=>Response.json({error},{status});
const stamp=()=>new Date().toISOString();
async function updateJob(env:Env,id:string,state:string,error='',remoteId?:string){await env.DB!.prepare('UPDATE buffer_jobs SET state=?,error=?,remote_id=COALESCE(?,remote_id),updated_at=?,completed_at=CASE WHEN ?=\'sent\' THEN ? ELSE completed_at END WHERE post_id=?').bind(state,error,remoteId??null,stamp(),state,stamp(),id).run();}
export async function integrationApi(request:Request,env:Env,user:User):Promise<Response>{
 const url=new URL(request.url),db=env.DB!;
 const workspace=await db.prepare('SELECT * FROM workspace WHERE id=1').first<any>();
 const member=await db.prepare('SELECT role FROM members WHERE email=?').bind(user.email.toLowerCase()).first<any>();
 const owner=!!workspace&&(workspace.owner===user.userId||workspace.email===user.email.toLowerCase()),staff=owner||member?.role==='team';
 if(!staff)return fail('Solo el equipo puede utilizar esta integración.',403);
 if(url.searchParams.has('preview'))return fail('La vista de cliente no permite utilizar Buffer.',403);
 if(request.method==='GET'&&url.pathname==='/api/integrations/drive/callback'){
  if(!owner)return fail('Solo el administrador puede conectar Drive.',403);
  try{await finishDrive(env,user.userId,url);return Response.redirect(url.origin+'/?integrations=drive-connected',303);}catch(e){return fail(e instanceof Error?e.message:'No se pudo conectar Drive.');}
 }
 if(request.method==='GET'&&url.searchParams.has('post_id')){
  const post=await db.prepare('SELECT client_id FROM posts WHERE id=?').bind(url.searchParams.get('post_id')).first<any>();if(!post)return fail('Publicación no encontrada.',404);
  const binding=await db.prepare('SELECT channel_name FROM buffer_bindings WHERE client_id=?').bind(post.client_id).first<any>();const drive=await db.prepare('SELECT id FROM drive_connection WHERE id=1').first();
  return Response.json({channelName:binding?.channel_name??'',ready:!!(binding&&drive&&env.BUFFER_API_KEY&&env.MEDIA&&env.R2_PUBLIC_ORIGIN&&driveConfigured(env))});
 }
 if(request.method==='GET'){
  if(!owner)return fail('Solo el administrador puede configurar conexiones.',403);
  const drive=await db.prepare('SELECT connected_at FROM drive_connection WHERE id=1').first();const bindings=await db.prepare('SELECT * FROM buffer_bindings').all();
  return Response.json({bufferConfigured:!!env.BUFFER_API_KEY,driveConfigured:driveConfigured(env),driveConnected:!!drive,r2Configured:!!env.MEDIA&&!!env.R2_PUBLIC_ORIGIN,emailConfigured:!!env.BREVO_API_KEY&&!!env.EMAIL_FROM,cleanupPending:(await db.prepare('SELECT COUNT(*) AS count FROM media_cleanup').first<any>())?.count??0,bindings:bindings.results});
 }
 if(request.method!=='POST')return fail('Método no permitido.',405);
 if(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json'))return fail('Origen o formato no permitido.',403);
 let body:any;try{body=await request.json();}catch{return fail('Datos no válidos.');}
 if(!body||typeof body!=='object')return fail('Datos no válidos.');
 try{
  if(['driveConnect','driveDisconnect','channels','bind','cleanup','digestTest'].includes(body.action)&&!owner)return fail('Solo el administrador puede configurar conexiones.',403);
  if(body.action==='digestTest'){await sendDigestTest(env,user.email);return Response.json({sent:user.email});}
  if(body.action==='driveConnect')return Response.json({url:await beginDrive(env,user.userId,url.origin)});
  if(body.action==='driveDisconnect'){await db.prepare('DELETE FROM drive_connection WHERE id=1').run();return Response.json({ok:true});}
  if(body.action==='channels')return Response.json({channels:await instagramChannels(env)});
  if(body.action==='bind'){
   const client=await db.prepare('SELECT id,archived FROM clients WHERE id=?').bind(body.client_id??'').first<any>();if(!client||client.archived)return fail('Selecciona un cliente activo.');
   if(!body.channel_id){const active=await db.prepare("SELECT post_id FROM buffer_jobs WHERE client_id=? AND state NOT IN ('sent','error','cancelled') LIMIT 1").bind(client.id).first();if(active)return fail('Hay envíos activos. No puedes desvincular la cuenta todavía.',409);await db.prepare('DELETE FROM buffer_bindings WHERE client_id=?').bind(client.id).run();return Response.json({ok:true});}
   const channel=(await instagramChannels(env)).find(c=>c.id===body.channel_id);if(!channel||channel.isDisconnected)return fail('La cuenta de Instagram no está disponible en Buffer.');
   const old=await db.prepare('SELECT channel_id FROM buffer_bindings WHERE client_id=?').bind(client.id).first<any>();if(old&&old.channel_id!==channel.id&&await db.prepare("SELECT post_id FROM buffer_jobs WHERE client_id=? AND state NOT IN ('sent','error','cancelled') LIMIT 1").bind(client.id).first())return fail('Hay envíos activos en la cuenta anterior.',409);
   if(await db.prepare('SELECT client_id FROM buffer_bindings WHERE channel_id=? AND client_id<>?').bind(channel.id,client.id).first())return fail('Esta cuenta ya pertenece a otro cliente.');
   const saved=await db.prepare("INSERT INTO buffer_bindings(client_id,channel_id,organization_id,channel_name) VALUES(?,?,?,?) ON CONFLICT(client_id) DO UPDATE SET channel_id=excluded.channel_id,organization_id=excluded.organization_id,channel_name=excluded.channel_name WHERE buffer_bindings.channel_id=excluded.channel_id OR NOT EXISTS (SELECT 1 FROM buffer_jobs WHERE client_id=buffer_bindings.client_id AND state NOT IN ('sent','error','cancelled'))").bind(client.id,channel.id,channel.organizationId,channel.displayName||channel.name).run();if(!saved.meta.changes)return fail('Hay un envío nuevo en curso. Actualiza antes de cambiar de cuenta.',409);return Response.json({ok:true});
  }
  if(body.action==='cleanup'){
   if(!env.MEDIA)return fail('Conecta R2 antes de limpiar copias.');
   const queued=await db.prepare('SELECT * FROM media_cleanup LIMIT 50').all<any>();for(const row of queued.results){const keys=JSON.parse(row.object_keys);if(keys.length)await env.MEDIA.delete(keys);await db.prepare('DELETE FROM media_cleanup WHERE id=?').bind(row.id).run();}
   const cutoff=new Date(Date.now()-30*86400000).toISOString();const jobs=await db.prepare("SELECT post_id,assets FROM buffer_jobs WHERE state='sent' AND completed_at<? AND assets<>'[]' LIMIT 50").bind(cutoff).all<any>();
   for(const job of jobs.results){const keys=JSON.parse(job.assets).map((a:any)=>a.key);if(keys.length)await env.MEDIA.delete(keys);await db.prepare("UPDATE buffer_jobs SET assets='[]' WHERE post_id=? AND state='sent'").bind(job.post_id).run();}return Response.json({ok:true});
  }
  const post=await db.prepare('SELECT * FROM posts WHERE id=?').bind(body.post_id??'').first<any>();if(!post)return fail('Publicación no encontrada.',404);
  const client=await db.prepare('SELECT id,archived FROM clients WHERE id=?').bind(post.client_id).first<any>();if(!client)return fail('Cliente no encontrado.',404);
  const job=await db.prepare('SELECT * FROM buffer_jobs WHERE post_id=?').bind(post.id).first<any>();
  if(['sync','reconcile','cancel','confirmPublished','reset','recover'].includes(body.action)){
   if(!job)return fail('Esta publicación todavía no se ha enviado a Buffer.');
   if(body.action==='cancel'&&job.state==='queued'){
    const cancelled=await db.prepare("UPDATE buffer_jobs SET state='cancelled',updated_at=? WHERE post_id=? AND state='queued'").bind(stamp(),post.id).run();if(!cancelled.meta.changes)return fail('El envío ya comenzó. Actualiza su estado.',409);return Response.json({ok:true});
   }
   if(body.action==='recover'){
    if(!owner)return fail('Solo el administrador puede revisar intentos bloqueados.',403);
    const age=Date.now()-Date.parse(job.updated_at);
    if(job.state==='preparing'&&age>2*60*60*1000){await updateJob(env,post.id,'error','La preparación caducó sin enviar a Buffer. Puedes preparar un nuevo intento.');return Response.json({ok:true});}
    if(job.state==='sending'&&age>5*60*1000){await updateJob(env,post.id,'unknown','No hay confirmación del envío. Revisa Buffer antes de repetir.');return Response.json({ok:true});}
    return fail('El intento aún está en curso. Espera antes de revisarlo.');
   }
   if(body.action==='reset'){
    if(!['error','cancelled'].includes(job.state))return fail('No repitas un envío activo o sin confirmar.',409);
    const assets=JSON.parse(job.assets);if(assets.length){if(!env.MEDIA)return fail('Conecta R2 para limpiar el intento anterior.');await env.MEDIA.delete(assets.map((a:any)=>a.key));}
    if(post.channel!=='Instagram'||!bufferFormats.includes(post.format)||post.status!=='Aprobado')return fail('Solo se pueden reintentar publicaciones de Instagram aprobadas.');await db.prepare("UPDATE buffer_jobs SET state='queued',assets='[]',remote_id=NULL,error='',snapshot=?,updated_at=? WHERE post_id=? AND state IN ('error','cancelled')").bind(JSON.stringify({approvedVersion:post.updated_at}),stamp(),post.id).run();return Response.json({ok:true});
   }
   if(body.action==='confirmPublished'){
    if(job.state!=='notification_sent')return fail('Solo confirma historias publicadas después del aviso al móvil.');
    await db.batch([db.prepare("UPDATE buffer_jobs SET state='sent',completed_at=?,updated_at=? WHERE post_id=? AND state='notification_sent'").bind(stamp(),stamp(),post.id),db.prepare("UPDATE posts SET status='Publicado',updated_at=? WHERE id=?").bind(stamp(),post.id)]);return Response.json({ok:true});
   }
   let remoteId=job.remote_id;
   if(body.action==='reconcile'){
    if(!owner||job.state!=='unknown'||typeof body.remote_id!=='string')return fail('Solo el administrador puede vincular un envío sin confirmar.',403);
    const data=await bufferQuery(env,'query($input:PostInput!){post(input:$input){'+remotePostFields+' channelId assets{source}}}',{input:{id:body.remote_id}});
    const snap=JSON.parse(job.snapshot),assets=JSON.parse(job.assets);if(data.post.channelId!==snap.channelId||data.post.assets.length!==assets.length||data.post.assets.some((a:any,i:number)=>a.source!==assets[i].url))return fail('Ese envío de Buffer no coincide con esta publicación.');remoteId=data.post.id;await updateJob(env,post.id,bufferState({...data.post,schedulingType:data.post.schedulingType??job.mode}),'',remoteId);
   }
   if(!remoteId)return fail('No hay confirmación del envío. Revisa Buffer y vincula el ID del envío existente; no vuelvas a programarlo.',409);
   if(body.action==='cancel'){
    const data=await bufferQuery(env,'query($input:PostInput!){post(input:$input){'+remotePostFields+'}}',{input:{id:remoteId}});
    if(['sent','sending'].includes(data.post.status))return fail('El envío ya salió o se está publicando. Actualiza su estado antes de continuar.',409);
    const result=await bufferQuery(env,'mutation($input:DeletePostInput!){deletePost(input:$input){__typename ... on MutationError{message}}}',{input:{id:remoteId}});
    if(result.deletePost.__typename!=='DeletePostSuccess')return fail('Buffer no pudo cancelar el envío.');
    await updateJob(env,post.id,'cancelled');await db.prepare("UPDATE posts SET status='Aprobado',updated_at=? WHERE id=? AND status<>'Publicado'").bind(stamp(),post.id).run();return Response.json({ok:true});
   }
   const data=await bufferQuery(env,'query($input:PostInput!){post(input:$input){'+remotePostFields+'}}',{input:{id:remoteId}});const state=bufferState({...data.post,schedulingType:data.post.schedulingType??job.mode});await updateJob(env,post.id,state,'',remoteId);
   if(state==='sent')await db.prepare("UPDATE posts SET status='Publicado',updated_at=? WHERE id=?").bind(stamp(),post.id).run();
   return Response.json({ok:true,state});
  }
  if(body.action!=='schedule')return fail('Acción no válida.');
  return fail('La programación se activa automáticamente con la aprobación del cliente.');
 }catch(e){return fail(e instanceof Error?e.message:'No se pudo completar la integración.');}
}

async function scheduleStory(env:Env,post:any,client:any,job:any,body:any):Promise<Response>{
 const db=env.DB!;
  if(client.archived||post.status!=='Aprobado'||post.channel!=='Instagram'||!bufferFormats.includes(post.format))return fail('Solo las publicaciones de Instagram aprobadas se envían a Buffer.');
  if(body.updated_at!==post.updated_at)return fail('La publicación cambió. Actualiza antes de enviarla.',409);
  if(job&&job.state!=='queued')return fail('Esta publicación ya tiene un envío registrado. Revisa su estado para evitar duplicados.',409);
  if(body.mode!=='automatic')return fail('Las publicaciones de Instagram se programan con publicación automática.');
  if(!env.BUFFER_API_KEY||!env.MEDIA||!driveConfigured(env))return fail('Configura Buffer, Drive y R2 antes de programar.');mediaOrigin(env);
  const binding=await db.prepare('SELECT * FROM buffer_bindings WHERE client_id=?').bind(client.id).first<any>();if(!binding)return fail('Vincula la cuenta de Instagram de este cliente.');
  const channelData=await bufferQuery(env,'query($input:ChannelInput!){channel(input:$input){id service isDisconnected isQueuePaused hasActiveMemberDevice}}',{input:{id:binding.channel_id}}),channel=channelData.channel;if(!channel||channel.service!=='instagram'||channel.isDisconnected||channel.isQueuePaused)return fail('La cuenta está desconectada o su cola está pausada en Buffer.');if(body.mode==='notification'&&!channel.hasActiveMemberDevice)return fail('Configura los avisos en la app móvil de Buffer para esta cuenta.');
  const dueAt=madridToUtc(post.date);if(Date.parse(dueAt)<=Date.now()+120000)return fail('Elige una fecha al menos dos minutos posterior a la hora actual.');
  const links=materialLinks(post.asset);if(post.format==='Carrusel'?links.length<2||links.length>MAX_CAROUSEL_IMAGES:links.length!==1)return fail(post.format==='Carrusel'?`El carrusel necesita entre 2 y ${MAX_CAROUSEL_IMAGES} imágenes de Drive.`:post.format==='Reel'?'Añade un único archivo de vídeo MP4 para el reel.':post.format==='Imagen'?'Añade un único archivo de imagen de Drive.':'Añade un único archivo de imagen o vídeo para la historia.');
  const input:any={channelId:binding.channel_id,dueAt,mode:'customScheduled',schedulingType:body.mode,needsApproval:false,...(post.format==='Reel'&&post.buffer_music?{saveToDraft:true}:{}),text:post.format==='Historia'&&body.mode==='automatic'?'':post.copy,assets:[],metadata:{instagram:{type:post.format==='Historia'?'story':post.format==='Reel'?'reel':'post',shouldShareToFeed:post.format==='Reel',...(post.format==='Historia'&&body.mode==='notification'?{stickerFields:{text:post.copy}}:{})}}};
  const now=stamp();const claim=await db.prepare("UPDATE buffer_jobs SET state='preparing',snapshot=?,updated_at=? WHERE post_id=? AND state='queued' AND EXISTS(SELECT 1 FROM posts WHERE id=buffer_jobs.post_id AND updated_at=? AND status='Aprobado') AND EXISTS(SELECT 1 FROM clients WHERE id=buffer_jobs.client_id AND archived=0) AND EXISTS(SELECT 1 FROM buffer_bindings WHERE client_id=buffer_jobs.client_id AND channel_id=?)").bind(JSON.stringify(input),now,post.id,post.updated_at,binding.channel_id).run();if(!claim.meta.changes)return fail('Esta publicación ya está siendo enviada o ha cambiado.',409);
  const assets:any[]=[];let sending=false;
  try{
   const token=await driveAccessToken(env);
   for(const link of links){const asset=await copyDriveFile(env,link,token);assets.push(asset);await db.prepare('UPDATE buffer_jobs SET assets=?,updated_at=? WHERE post_id=?').bind(JSON.stringify(assets),stamp(),post.id).run();if(post.format==='Carrusel'&&!asset.mimeType.startsWith('image/'))throw Error('El carrusel solo admite imágenes.');if(post.format==='Reel'&&!asset.mimeType.startsWith('video/'))throw Error('Un reel debe tener un archivo MP4.');if(post.format==='Imagen'&&!asset.mimeType.startsWith('image/'))throw Error('Este formato requiere una imagen.');}
   input.assets=assets.map(a=>a.mimeType.startsWith('video/')?{video:{url:a.url}}:{image:{url:a.url}});
   if(Date.parse(dueAt)<=Date.now())throw Error('La hora prevista pasó durante la copia. Cambia la fecha antes de enviar.');
   await db.prepare("UPDATE buffer_jobs SET state='sending',snapshot=?,updated_at=? WHERE post_id=?").bind(JSON.stringify(input),stamp(),post.id).run();sending=true;
   const data=await bufferQuery(env,'mutation($input:CreatePostInput!){createPost(input:$input){__typename ... on PostActionSuccess{post{'+remotePostFields+'}} ... on MutationError{message}}}',{input});
   if(data.createPost.message)throw new BufferRequestError('Buffer rechazó el contenido. Revisa el formato, las dimensiones y los permisos de la cuenta.',true);
   if(!data.createPost.post?.id)throw new BufferRequestError('Buffer no devolvió el identificador del envío.');
   const state=bufferState({...data.createPost.post,schedulingType:data.createPost.post.schedulingType??body.mode});await updateJob(env,post.id,state,'',data.createPost.post.id);
   if(state==='scheduled')await db.prepare("UPDATE posts SET status='Planificado',updated_at=? WHERE id=? AND updated_at=?").bind(stamp(),post.id,post.updated_at).run();
   return Response.json({ok:true,state});
  }catch(e){const uncertain=sending&&!(e instanceof BufferRequestError&&e.definitive);const message=e instanceof Error?e.message:'No se pudo enviar.';await updateJob(env,post.id,uncertain?'unknown':'error',message);
   if(!uncertain&&assets.length)await env.MEDIA.delete(assets.map(a=>a.key));return fail(message,uncertain?409:400);}
}

export async function processStoryQueue(env:Env):Promise<void>{
 const db=env.DB;if(!db)return;
 const job=await db.prepare("SELECT * FROM buffer_jobs WHERE state='queued' ORDER BY created_at LIMIT 1").first<any>();if(!job)return;
 const post=await db.prepare('SELECT * FROM posts WHERE id=?').bind(job.post_id).first<any>();
 const snapshot=JSON.parse(job.snapshot);
 if(!post||post.updated_at!==snapshot.approvedVersion||post.status!=='Aprobado'||post.channel!=='Instagram'||!bufferFormats.includes(post.format)){
  await db.prepare("UPDATE buffer_jobs SET state='error',error=?,updated_at=? WHERE post_id=? AND state='queued'").bind('La publicación cambió después de aprobarse. Solicita una nueva revisión.',stamp(),job.post_id).run();return;
 }
 const client=await db.prepare('SELECT id,archived FROM clients WHERE id=?').bind(post.client_id).first<any>();
 let response:Response;
 try{response=await scheduleStory(env,post,client,job,{mode:'automatic',updated_at:post.updated_at});}catch(e){response=fail(e instanceof Error?e.message:'No se pudo programar la publicación.');}
 if(!response.ok){const data:any=await response.json();await db.prepare("UPDATE buffer_jobs SET state='error',error=?,updated_at=? WHERE post_id=? AND state='queued'").bind(data.error,stamp(),post.id).run();}
}
