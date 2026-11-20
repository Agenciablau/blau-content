import {normalizeCampaign,normalizeSelection,applyAnswer,readSelection} from '../shared/labs';
type Ctx={db:D1Database;role:string;staff:boolean;preview:boolean;social:string[];user:{email:string;displayName:string}};
const fail=(error:string,status=400)=>Response.json({error},{status});
const str=(x:any,max=5000)=>typeof x==='string'?x.trim().slice(0,max):'';
const marks=(ids:string[])=>`IN (${ids.map(()=>'?').join(',')||'NULL'})`;
export const labsActions=['campaign','deleteCampaign','selectionSave','selectionAnswer','selectionApprove','ideaApprove'];
/** Equipo: todas las campañas. Cliente y colaborador: las de su marca que no están en borrador, con presupuesto y resultados solo si el equipo los muestra. */
export async function loadLabs(db:D1Database,staff:boolean,social:string[]){
 const rows=(await db.prepare(staff?'SELECT * FROM campaigns ORDER BY created_at':`SELECT * FROM campaigns WHERE status<>'draft' AND client_id ${marks(social)} ORDER BY created_at`).bind(...(staff?[]:social)).all<any>()).results;
 const ids=rows.map((r:any)=>r.id),moments=ids.length?(await db.prepare(`SELECT * FROM campaign_moments WHERE campaign_id ${marks(ids)} ORDER BY start_date,position`).bind(...ids).all<any>()).results:[];
 return {campaigns:rows.map((r:any)=>staff||r.show_numbers?r:{...r,budget:0,spent:0}),campaignMoments:moments.map((m:any)=>{const c=rows.find((r:any)=>r.id===m.campaign_id);return staff||c?.show_numbers?m:{...m,budget:0};})};
}
export async function labsAction(c:Ctx,b:any):Promise<Response|null>{
 const {db}=c,now=new Date().toISOString(),version=()=>now+':'+crypto.randomUUID();
 if(b.action==='campaign'||b.action==='deleteCampaign'){
  if(!c.staff||c.preview)return fail('Solo el equipo puede gestionar campañas.',403);
  if(b.action==='deleteCampaign'){
   if(c.role!=='owner')return fail('Solo el administrador puede eliminar campañas.',403);
   const camp=await db.prepare('SELECT id,name FROM campaigns WHERE id=?').bind(str(b.id,100)).first<any>();
   if(!camp)return fail('Campaña no encontrada.',404);
   if(typeof b.confirmName!=='string'||b.confirmName!==camp.name)return fail('Escribe el nombre exacto de la campaña para eliminarla.');
   await db.batch([db.prepare("UPDATE posts SET campaign_id='',moment_id='',shared=0 WHERE campaign_id=?").bind(camp.id),db.prepare('DELETE FROM campaign_moments WHERE campaign_id=?').bind(camp.id),db.prepare('DELETE FROM campaigns WHERE id=?').bind(camp.id)]);
   return null;
  }
  let n;try{n=normalizeCampaign(b,()=>crypto.randomUUID());}catch(e){return fail(e instanceof Error?e.message:'Revisa la campaña.');}
  const existing=b.id?await db.prepare('SELECT * FROM campaigns WHERE id=?').bind(str(b.id,100)).first<any>():null;
  if(b.id&&!existing)return fail('Campaña no encontrada.',404);
  if(existing&&existing.updated_at!==b.updated_at)return fail('La campaña ha cambiado. Actualiza antes de guardar.',409);
  const clientId=existing?existing.client_id:str(b.client_id,100);
  if(!await db.prepare('SELECT id FROM clients WHERE id=? AND archived=0').bind(clientId).first())return fail('Selecciona un cliente activo.');
  const cid=existing?.id??crypto.randomUUID(),v=version(),ids=n.moments.map(m=>m.id);
  const statements:D1PreparedStatement[]=[];
  if(existing)statements.push(db.prepare('UPDATE campaigns SET name=?,concept=?,objectives=?,budget=?,spent=?,show_numbers=?,status=?,updated_at=? WHERE id=? AND updated_at=?').bind(n.name,n.concept,JSON.stringify(n.objectives),n.budget,n.spent,n.show_numbers,n.status,v,cid,existing.updated_at));
  else statements.push(db.prepare('INSERT INTO campaigns(id,client_id,name,concept,objectives,budget,spent,show_numbers,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(cid,clientId,n.name,n.concept,JSON.stringify(n.objectives),n.budget,n.spent,n.show_numbers,n.status,now,v));
  if(existing){
   statements.push(db.prepare(`UPDATE posts SET moment_id='' WHERE campaign_id=? AND moment_id<>'' AND moment_id NOT ${marks(ids)}`).bind(cid,...ids));
   statements.push(db.prepare(`DELETE FROM campaign_moments WHERE campaign_id=? AND id NOT ${marks(ids)}`).bind(cid,...ids));
  }
  n.moments.forEach((m,i)=>statements.push(db.prepare('INSERT INTO campaign_moments(id,campaign_id,name,description,start_date,end_date,position,budget) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,start_date=excluded.start_date,end_date=excluded.end_date,position=excluded.position,budget=excluded.budget WHERE campaign_moments.campaign_id=excluded.campaign_id').bind(m.id,cid,m.name,m.description,m.start,m.end,i,m.budget)));
  const res=await db.batch(statements);
  if(existing&&!res[0].meta.changes)return fail('La campaña ha cambiado. Actualiza antes de guardar.',409);
  return Response.json({ok:true,id:cid});
 }
 // Acciones sobre una idea (publicación en Idea o Idea aprobada).
 const post=await db.prepare('SELECT * FROM posts WHERE id=?').bind(str(b.id,100)).first<any>();
 if(!post||(!c.staff&&!c.social.includes(post.client_id)))return fail('Publicación no encontrada.',404);
 if(!c.social.length&&!c.staff)return fail('Tu acceso no incluye redes sociales.',403);
 if(post.updated_at!==b.updated_at)return fail('La publicación ha cambiado. Actualiza antes de continuar.',409);
 const v=version(),sel=readSelection(post.selection);
 const comment=(body:string,role:string)=>body?db.prepare('INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) SELECT ?,?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),post.id,c.user.displayName,body,now,role,post.id,v):null;
 const run=async(ops:(D1PreparedStatement|null)[])=>{const r=await db.batch(ops.filter(Boolean) as D1PreparedStatement[]);return r[0].meta.changes?null:fail('La publicación ha cambiado. Actualiza antes de continuar.',409);};
 if(['selectionSave','selectionApprove'].includes(b.action)){
  if(!c.staff||c.preview)return fail('Solo el equipo puede hacerlo.',403);
  if(b.action==='selectionSave'){
   if(post.status!=='Idea')return fail('La idea solo se edita mientras la pieza es una idea.');
   let n;try{n=normalizeSelection(b.selection,sel,()=>crypto.randomUUID());}catch(e){return fail(e instanceof Error?e.message:'Revisa la idea.');}
   return run([db.prepare('UPDATE posts SET selection=?,updated_at=? WHERE id=? AND updated_at=?').bind(n?JSON.stringify(n):'',v,post.id,post.updated_at)]);
  }
  if(!sel||!sel.options.length||post.status!=='Idea')return fail('No hay una selección pendiente de aprobar.');
  const fin:string[]=Array.isArray(b.final)?b.final.filter((x:unknown)=>typeof x==='string'):[];
  if(!fin.length||fin.length>sel.pick||fin.some(f=>!sel.options.some(o=>o.id===f)))return fail(`Elige entre 1 y ${sel.pick} opciones para la selección final.`);
  return run([db.prepare("UPDATE posts SET selection=?,status='Idea aprobada',updated_at=? WHERE id=? AND updated_at=? AND status='Idea'").bind(JSON.stringify({...sel,final:fin}),v,post.id,post.updated_at),comment(str(b.body),'team')]);
 }
 // Acciones del cliente: ven las ideas de las campañas en marcha sin que haya que enviárselas (también desde la vista previa del administrador).
 if(c.role!=='client')return fail('Esta acción corresponde al cliente.',403);
 if(post.status!=='Idea'||!post.campaign_id||!await db.prepare("SELECT id FROM campaigns WHERE id=? AND status<>'draft'").bind(post.campaign_id).first())return fail('Esta idea no está pendiente de tu respuesta.',403);
 if(b.action==='selectionAnswer'){
  if(!sel)return fail('Esta idea no tiene opciones para elegir.');
  let n;try{n=applyAnswer(sel,b,()=>crypto.randomUUID());}catch(e){return fail(e instanceof Error?e.message:'Revisa tu respuesta.');}
  return run([db.prepare("UPDATE posts SET selection=?,updated_at=? WHERE id=? AND updated_at=? AND status='Idea'").bind(JSON.stringify(n),v,post.id,post.updated_at),comment(str(b.body),'client')]);
 }
 if(sel&&sel.options.length)return fail('Esta idea tiene opciones: responde eligiendo tus favoritas.');
 return run([db.prepare("UPDATE posts SET status='Idea aprobada',updated_at=? WHERE id=? AND updated_at=? AND status='Idea'").bind(v,post.id,post.updated_at),comment(str(b.body),'client')]);
}
