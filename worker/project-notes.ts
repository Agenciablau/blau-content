import type {Env} from './types';
/** Notas del proyecto (hosting, accesos, claves…): owner y team las gestionan; el cliente solo ve las marcadas como visibles (visible=1) de sus proyectos. Los datos sensibles se guardan cifrados (AES-GCM con INTEGRATION_ENCRYPTION_KEY) y solo se descifran al pulsar «Mostrar». */
type Ctx={db:D1Database;role:string;preview:boolean;clientIds:string[];user:{email:string;displayName:string}};
export const noteActions=['projectNote','deleteProjectNote','revealProjectNote'];
const fail=(error:string,status=400)=>Response.json({error},{status});
const str=(x:any,max=5000)=>typeof x==='string'?x.trim().slice(0,max):'';
const b64=(u:Uint8Array)=>btoa(String.fromCharCode(...u)),unb64=(s:string)=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0));
async function key(env:Env){if(!/^[a-f\d]{64}$/i.test(env.INTEGRATION_ENCRYPTION_KEY??''))throw Error('Configura la clave de cifrado (INTEGRATION_ENCRYPTION_KEY) para guardar datos sensibles.');return crypto.subtle.importKey('raw',Uint8Array.from(env.INTEGRATION_ENCRYPTION_KEY!.match(/../g)!,v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(env:Env,v:string){const iv=crypto.getRandomValues(new Uint8Array(12));return 'v1.'+b64(iv)+'.'+b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(v))));}
async function unseal(env:Env,v:string){const [,iv,body]=v.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await key(env),unb64(body)));}
const marks=(ids:string[])=>'IN ('+ids.map(()=>'?').join(',')+')';
/** Sin clientIds: todas (equipo). Con clientIds: solo las visibles de los proyectos de esas marcas (cliente). */
export async function loadNotes(db:D1Database,clientIds:string[]|null=null){if(clientIds&&!clientIds.length)return [];return (await db.prepare("SELECT id,project_id,title,body,secret<>'' AS has_secret,visible,author,created_at,updated_at FROM project_notes"+(clientIds?' WHERE visible=1 AND project_id IN (SELECT id FROM projects WHERE client_id '+marks(clientIds)+')':'')+" ORDER BY created_at").bind(...(clientIds??[])).all()).results;}
/** Registro de quién ha mostrado los datos sensibles (solo para el administrador): las 20 últimas veces por nota. */
export async function loadNoteViews(db:D1Database){return (await db.prepare('SELECT note_id,email,name,created_at FROM (SELECT v.*,ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY created_at DESC) AS n FROM project_note_views v) WHERE n<=20 ORDER BY created_at DESC').all()).results;}
export async function noteAction(env:Env,c:Ctx,b:any):Promise<Response>{
 const {db}=c,staff=c.role==='owner'||c.role==='team';
 if(c.preview)return fail(b.action==='revealProjectNote'?'En la vista previa no se muestran los datos sensibles.':'Solo el equipo puede editar las notas del proyecto.',403);
 if(!staff&&!(c.role==='client'&&b.action==='revealProjectNote'))return fail('Solo el equipo puede ver y editar las notas del proyecto.',403);
 const note=b.id?await db.prepare('SELECT * FROM project_notes WHERE id=?').bind(str(b.id,100)).first<any>():null;
 if(b.id&&!note)return fail('Nota no encontrada.',404);
 if(!staff&&!(note?.visible&&c.clientIds.length&&await db.prepare('SELECT id FROM projects WHERE id=? AND client_id '+marks(c.clientIds)).bind(note.project_id,...c.clientIds).first()))return fail('Nota no encontrada.',404);
 if(b.action==='revealProjectNote'){if(!note?.secret)return Response.json({secret:''});try{const secret=await unseal(env,note.secret);await db.prepare('INSERT INTO project_note_views(id,note_id,email,name,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),note.id,c.user.email,c.user.displayName,new Date().toISOString()).run();return Response.json({secret},{headers:{'Cache-Control':'no-store'}});}catch(e){return fail(e instanceof Error&&/clave de cifrado/.test(e.message)?e.message:'No se pudieron descifrar los datos sensibles.',500);}}
 if(b.action==='deleteProjectNote'){await db.batch([db.prepare('DELETE FROM project_note_views WHERE note_id=?').bind(note.id),db.prepare('DELETE FROM project_notes WHERE id=?').bind(note.id)]);return Response.json({ok:true});}
 const title=str(b.title,120),body=str(b.body,5000),now=new Date().toISOString(),v=now+':'+crypto.randomUUID();if(!title)return fail('Pon un título a la nota.');
 const visible=b.visible===undefined?undefined:b.visible?1:0;
 if(typeof b.secret==='string'&&b.secret.length>5000)return fail('Los datos sensibles no pueden superar 5.000 caracteres.');
 let secret:string|undefined;if(typeof b.secret==='string'){try{secret=b.secret.trim()?await seal(env,b.secret.trim()):'';}catch(e){return fail(e instanceof Error?e.message:'No se pudieron cifrar los datos.',500);}}
 if(note){
  if(note.updated_at!==b.updated_at)return fail('Otra persona ha cambiado la nota. Recarga para ver los cambios.',409);
  const r=await db.prepare('UPDATE project_notes SET title=?,body=?,secret=?,visible=?,updated_at=? WHERE id=? AND updated_at=?').bind(title,body,secret??note.secret,visible??note.visible,v,note.id,b.updated_at).run();
  if(!r.meta.changes)return fail('Otra persona ha cambiado la nota. Recarga para ver los cambios.',409);
  return Response.json({ok:true});
 }
 if(!await db.prepare('SELECT id FROM projects WHERE id=?').bind(str(b.project_id,100)).first())return fail('Proyecto no encontrado.',404);
 if((await db.prepare('SELECT COUNT(*) AS n FROM project_notes WHERE project_id=?').bind(str(b.project_id,100)).first<any>())?.n>=50)return fail('Un proyecto admite hasta 50 notas.');
 await db.prepare('INSERT INTO project_notes(id,project_id,title,body,secret,visible,author,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),str(b.project_id,100),title,body,secret??'',visible??0,c.user.displayName,now,v).run();
 return Response.json({ok:true});
}
