import {isWeek,isDay,addWeeks,normalizeFocus} from '../shared/week';
type Ctx={db:D1Database;role:string;preview:boolean};
const fail=(error:string,status=400)=>Response.json({error},{status});
const str=(x:any,max=5000)=>typeof x==='string'?x.trim().slice(0,max):'';
export const weekActions=['weekHide','weekPlace','weekUnplace','weekFree','weekDone','weekFlag','weekNotes','weekCarry'];
/** Solo el administrador (nunca desde la vista previa de cliente) ve y cambia su plan semanal. */
export async function loadWeek(db:D1Database,since:string){
 const plan=(await db.prepare('SELECT * FROM week_plan WHERE week>=? ORDER BY week,day,position').bind(since).all()).results,notes=(await db.prepare('SELECT * FROM week_notes WHERE week>=? ORDER BY week').bind(since).all()).results;
 const hidden=(await db.prepare('SELECT kind,ref_id FROM week_hidden ORDER BY created_at').all()).results;
 return {weekPlan:plan,weekNotes:notes,weekHidden:hidden};
}
async function renumber(db:D1Database,week:string,day:number,order:string[]){await db.batch(order.map((id,i)=>db.prepare('UPDATE week_plan SET day=?,position=?,updated_at=? WHERE id=? AND week=?').bind(day,i,new Date().toISOString(),id,week)));}
export async function weekAction(c:Ctx,b:any):Promise<Response|null>{
 if(c.role!=='owner'||c.preview)return fail('Solo el administrador puede organizar su semana.',403);
 const {db}=c,now=new Date().toISOString();
 if(b.action==='weekHide'){
  const ref=str(b.ref_id,100);if(!['task','post'].includes(b.kind)||!ref)return fail('Tipo de tarjeta no válido.');
  if(b.hidden===false)await db.prepare('DELETE FROM week_hidden WHERE kind=? AND ref_id=?').bind(b.kind,ref).run();
  else{if(!await db.prepare(b.kind==='task'?'SELECT id FROM project_tasks WHERE id=?':'SELECT id FROM posts WHERE id=?').bind(ref).first())return fail('Tarjeta no encontrada.',404);await db.prepare('INSERT OR IGNORE INTO week_hidden(kind,ref_id,created_at) VALUES(?,?,?)').bind(b.kind,ref,now).run();}
  return null;
 }
 if(b.action==='weekNotes'){
  if(!isWeek(b.week))return fail('Semana no válida.');
  let focus:string[];try{focus=normalizeFocus(b.focus);}catch(e){return fail(e instanceof Error?e.message:'Revisa el foco.');}
  const note=str(b.note,2000);
  await db.prepare('INSERT INTO week_notes(week,focus,note,updated_at) VALUES(?,?,?,?) ON CONFLICT(week) DO UPDATE SET focus=excluded.focus,note=excluded.note,updated_at=excluded.updated_at').bind(b.week,JSON.stringify(focus),note,now).run();
  return null;
 }
 if(b.action==='weekCarry'){
  if(!isWeek(b.from)||!isWeek(b.to)||b.from===b.to)return fail('Semana no válida.');
  const rows=(await db.prepare("SELECT w.* FROM week_plan w WHERE w.week=? AND w.done=0 AND (w.kind='free' OR (w.kind='task' AND EXISTS(SELECT 1 FROM project_tasks t WHERE t.id=w.ref_id AND t.column_key<>'done'))) ORDER BY w.day,w.position").bind(b.from).all<any>()).results;
  const taken=(await db.prepare("SELECT kind,ref_id FROM week_plan WHERE week=? AND kind<>'free'").bind(b.to).all<any>()).results,seen=new Set(taken.map((r:any)=>r.kind+':'+r.ref_id));
  const next=await db.prepare('SELECT day,COALESCE(MAX(position),-1)+1 AS n FROM week_plan WHERE week=? GROUP BY day').bind(b.to).all<any>(),pos=new Map<number,number>(next.results.map((r:any)=>[r.day,r.n]));
  const add=rows.filter((r:any)=>r.kind==='free'||!seen.has(r.kind+':'+r.ref_id));
  if(add.length)await db.batch(add.map((r:any)=>{const n=pos.get(r.day)??0;pos.set(r.day,n+1);return db.prepare('INSERT INTO week_plan(id,week,day,position,kind,ref_id,title,priority,done,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,0,?,?)').bind(crypto.randomUUID(),b.to,r.day,n,r.kind,r.ref_id,r.title,r.priority,now,now);}));
  return Response.json({ok:true,carried:add.length});
 }
 if(b.action==='weekFree'){
  const title=str(b.title,160);if(!title)return fail('Escribe un título para la tarjeta.');
  if(b.id){const r=await db.prepare("UPDATE week_plan SET title=?,updated_at=? WHERE id=? AND kind='free'").bind(title,now,str(b.id,100)).run();if(!r.meta.changes)return fail('Tarjeta no encontrada.',404);return null;}
  if(!isWeek(b.week)||!isDay(b.day))return fail('Elige la semana y el día.');
  const n=(await db.prepare('SELECT COUNT(*) AS n FROM week_plan WHERE week=? AND day=?').bind(b.week,b.day).first<any>())?.n??0;if(n>=60)return fail('Ese día ya tiene demasiadas tarjetas.');
  await db.prepare("INSERT INTO week_plan(id,week,day,position,kind,ref_id,title,priority,done,created_at,updated_at) VALUES(?,?,?,?,'free','',?,0,0,?,?)").bind(crypto.randomUUID(),b.week,b.day,n,title,now,now).run();
  return null;
 }
 const card=b.id?await db.prepare('SELECT * FROM week_plan WHERE id=?').bind(str(b.id,100)).first<any>():null;
 if(b.action==='weekUnplace'){if(!card)return fail('Tarjeta no encontrada.',404);await db.prepare('DELETE FROM week_plan WHERE id=?').bind(card.id).run();return null;}
 if(b.action==='weekDone'){if(!card||card.kind!=='free')return fail('Solo las tarjetas libres se marcan aquí.',404);await db.prepare('UPDATE week_plan SET done=?,updated_at=? WHERE id=?').bind(b.done===true?1:0,now,card.id).run();return null;}
 if(b.action==='weekFlag'){if(!card)return fail('Tarjeta no encontrada.',404);await db.prepare('UPDATE week_plan SET priority=?,updated_at=? WHERE id=?').bind(b.priority===true?1:0,now,card.id).run();return null;}
 // weekPlace: coloca (o mueve) una tarea, una publicación o una tarjeta libre en un día de la semana.
 if(!isDay(b.day))return fail('Elige un día de lunes a viernes.');
 let week=b.week,id=card?.id;
 if(card){week=card.week;}
 else{
  if(!isWeek(week))return fail('Semana no válida.');
  if(b.kind==='task'){if(!await db.prepare('SELECT id FROM project_tasks WHERE id=?').bind(str(b.ref_id,100)).first())return fail('Tarea no encontrada.',404);}
  else if(b.kind==='post'){if(!await db.prepare('SELECT id FROM posts WHERE id=?').bind(str(b.ref_id,100)).first())return fail('Publicación no encontrada.',404);}
  else return fail('Tipo de tarjeta no válido.');
  const dup=await db.prepare('SELECT id FROM week_plan WHERE week=? AND kind=? AND ref_id=?').bind(week,b.kind,str(b.ref_id,100)).first<any>();
  if(dup)id=dup.id;
  else{id=crypto.randomUUID();await db.prepare("INSERT INTO week_plan(id,week,day,position,kind,ref_id,title,priority,done,created_at,updated_at) VALUES(?,?,?,?,?,?,'',0,0,?,?)").bind(id,week,b.day,9999,b.kind,str(b.ref_id,100),now,now).run();}
 }
 const others=(await db.prepare('SELECT id FROM week_plan WHERE week=? AND day=? AND id<>? ORDER BY position,created_at').bind(week,b.day,id).all<any>()).results.map((r:any)=>r.id),at=Number.isInteger(b.position)?Math.max(0,Math.min(b.position,others.length)):others.length;
 others.splice(at,0,id);await renumber(db,week,b.day,others);
 if(card&&card.day!==b.day){const rest=(await db.prepare('SELECT id FROM week_plan WHERE week=? AND day=? ORDER BY position,created_at').bind(week,card.day).all<any>()).results.map((r:any)=>r.id);await renumber(db,week,card.day,rest);}
 return null;
}
export const weekSince=(today:string)=>addWeeks(today.slice(0,10),-5);
