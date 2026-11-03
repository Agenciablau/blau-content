import {normalizeProject,normalizeTask,projectPhases,columnKeys} from '../shared/projects';
type Ctx={db:D1Database;role:string;clientIds:string[];perms:string[];user:{email:string;displayName:string};preview:boolean};
const fail=(error:string,status=400)=>Response.json({error},{status});
const str=(x:any,max=5000)=>typeof x==='string'?x.trim().slice(0,max):'';
const version=()=>new Date().toISOString()+':'+crypto.randomUUID();
export const projectActions=['project','deleteProject','task','moveTask','deleteTask','taskComment','taskReview','taskSent','taskCommentEdit'];
const marks=(ids:string[])=>`IN (${ids.map(()=>'?').join(',')||'NULL'})`;
/** clientIds: marcas con proyectos visibles para cliente o colaborador (null para el equipo). */
export async function loadProjects(db:D1Database,role:string,clientIds:string[]|null,perms:string[]=[]){
 const scoped=role==='client'||role==='collaborator',ids=clientIds??[],has=(k:string)=>role==='collaborator'&&perms.includes(k);
 if(scoped&&!ids.length)return {projects:[],projectTasks:[],projectComments:[],projectReviews:[]};
 const projects=(await db.prepare('SELECT * FROM projects'+(scoped?' WHERE client_id '+marks(ids):'')+' ORDER BY created_at').bind(...(scoped?ids:[])).all<any>()).results.map(p=>scoped&&!has('projects_edit')?{...p,fields:JSON.stringify(JSON.parse(p.fields||'[]').filter((f:any)=>f.visible))}:p);
 const taskScope=scoped?' WHERE '+(has('tasks_board')?'':'visible=1 AND ')+'project_id IN (SELECT id FROM projects WHERE client_id '+marks(ids)+')':'';
 const tasks=(await db.prepare('SELECT * FROM project_tasks'+taskScope+' ORDER BY position,created_at').bind(...(scoped?ids:[])).all()).results;
 const sub=scoped?' WHERE task_id IN (SELECT id FROM project_tasks'+taskScope+')':'';
 const comments=(await db.prepare('SELECT * FROM project_comments'+sub+(scoped&&!has('internal_notes')?' AND internal=0':'')+' ORDER BY created_at').bind(...(scoped?ids:[])).all()).results;
 const reviews=(await db.prepare('SELECT id,task_id,actor,role,decision,created_at FROM project_reviews'+sub+' ORDER BY created_at DESC').bind(...(scoped?ids:[])).all()).results;
 return {projects,projectTasks:tasks,projectComments:comments,projectReviews:reviews};
}
export async function projectAction(c:Ctx,b:any):Promise<Response|null>{
 const {db}=c,staff=c.role==='owner'||c.role==='team',scoped=!staff,has=(k:string)=>staff||c.role==='collaborator'&&!c.preview&&c.perms.includes(k);
 if(scoped&&!c.clientIds.length)return fail('Tu acceso no incluye proyectos.',403);
 if(b.action==='taskCommentEdit'){
  const body=str(b.body);if(!body)return fail('Escribe un comentario.');
  const cm=await db.prepare('SELECT pc.id,pc.author,pc.internal,t.visible,p.client_id FROM project_comments pc JOIN project_tasks t ON t.id=pc.task_id JOIN projects p ON p.id=t.project_id WHERE pc.id=?').bind(str(b.id,100)).first<any>();
  if(!cm||scoped&&(!c.clientIds.includes(cm.client_id)||!cm.visible&&!has('tasks_board')||cm.internal&&!has('internal_notes')))return fail('Comentario no encontrado.',404);
  if(c.preview||String(cm.author).toLowerCase()!==c.user.email.toLowerCase())return fail('Solo puedes editar tus propios comentarios.',403);
  await db.prepare('UPDATE project_comments SET body=?,edited_at=? WHERE id=?').bind(body,new Date().toISOString(),cm.id).run();
  return null;
 }
 if(b.action==='project'){
  if(!has('projects_edit'))return fail('Solo el equipo puede gestionar proyectos.',403);
  let p;try{p=normalizeProject(b);}catch(e){return fail(e instanceof Error?e.message:'Datos del proyecto no válidos.');}
  const now=new Date().toISOString(),v=version(),cols=[p.name,p.summary,p.template,p.viewer,p.status,JSON.stringify(p.phases),JSON.stringify(p.fields),JSON.stringify(p.options),JSON.stringify(p.team)];
  if(b.id){
   const existing=await db.prepare('SELECT * FROM projects WHERE id=?').bind(str(b.id,100)).first<any>();if(!existing||scoped&&!c.clientIds.includes(existing.client_id))return fail('Proyecto no encontrado.',404);
   if(existing.updated_at!==b.updated_at)return fail('Otra persona ha cambiado el proyecto. Recarga para ver los cambios.',409);
   const ids=p.phases.map(x=>x.id),orphan=await db.prepare(`SELECT title FROM project_tasks WHERE project_id=? AND phase_id NOT IN (${ids.map(()=>'?').join(',')}) LIMIT 1`).bind(existing.id,...ids).first<any>();
   if(orphan)return fail(`La tarea «${orphan.title}» está en una fase que quieres quitar. Muévela antes.`,409);
   const r=await db.prepare('UPDATE projects SET name=?,summary=?,template=?,viewer=?,status=?,phases=?,fields=?,options=?,team=?,updated_at=? WHERE id=? AND updated_at=?').bind(...cols,v,existing.id,b.updated_at).run();
   if(!r.meta.changes)return fail('Otra persona ha cambiado el proyecto. Recarga para ver los cambios.',409);
   return null;
  }
  if(scoped&&!c.clientIds.includes(str(b.client_id,100)))return fail('Sin permiso.',403);
  if(!await db.prepare('SELECT id FROM clients WHERE id=? AND archived=0').bind(str(b.client_id,100)).first())return fail('Selecciona un cliente activo.');
  if(b.tasks!=null&&(!Array.isArray(b.tasks)||b.tasks.length>100))return fail('Puedes crear hasta 100 tareas iniciales.');
  let tasks:ReturnType<typeof normalizeTask>[];try{tasks=(b.tasks??[]).map((t:any)=>normalizeTask(t,p.phases.map(x=>x.id)));}catch(e){return fail(e instanceof Error?e.message:'Revisa las tareas.');}
  const id=crypto.randomUUID();
  await db.batch([db.prepare('INSERT INTO projects(id,client_id,name,summary,template,viewer,status,phases,fields,options,team,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,str(b.client_id,100),...cols,now,v),...tasks.map((t,i)=>db.prepare('INSERT INTO project_tasks(id,project_id,phase_id,column_key,position,title,description,assignee,due,visible,client_task,deliverable,views,checklist,links,done_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,t.phase_id,t.column_key,i,t.title,t.description,t.assignee,t.due,t.visible,t.client_task,t.deliverable,t.views,t.checklist,t.links,t.column_key==='done'?now:'',now,version()))]);
  return Response.json({ok:true,id});
 }
 if(b.action==='deleteProject'){
  if(c.role!=='owner')return fail('Solo el administrador puede eliminar proyectos.',403);
  const p=await db.prepare('SELECT id,name FROM projects WHERE id=?').bind(str(b.id,100)).first<any>();if(!p)return fail('Proyecto no encontrado.',404);
  if(b.confirmName!==p.name)return fail('Escribe el nombre exacto del proyecto para eliminarlo.');
  const inTasks='task_id IN (SELECT id FROM project_tasks WHERE project_id=?)';
  await db.batch([db.prepare(`DELETE FROM project_reviews WHERE ${inTasks}`).bind(p.id),db.prepare(`DELETE FROM project_comments WHERE ${inTasks}`).bind(p.id),db.prepare('DELETE FROM project_notes WHERE project_id=?').bind(p.id),db.prepare('DELETE FROM project_tasks WHERE project_id=?').bind(p.id),db.prepare('DELETE FROM projects WHERE id=?').bind(p.id)]);
  return null;
 }
 const task=b.id?await db.prepare('SELECT t.*,p.client_id,p.phases,p.options FROM project_tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?').bind(str(b.id,100)).first<any>():null;
 if(b.id&&!task)return fail('Tarea no encontrada.',404);
 if(scoped&&task&&(!c.clientIds.includes(task.client_id)||!task.visible&&!has('tasks_board')))return fail('Tarea no encontrada.',404);
 const now=new Date().toISOString();
 if(b.action==='task'){
  if(!has('tasks_edit'))return fail('Solo el equipo puede editar tareas.',403);
  const project=task?{id:task.project_id,phases:task.phases,client_id:task.client_id}:await db.prepare('SELECT id,phases,client_id FROM projects WHERE id=?').bind(str(b.project_id,100)).first<any>();
  if(!project||scoped&&!c.clientIds.includes(project.client_id))return fail('Proyecto no encontrado.',404);
  let t;try{t=normalizeTask(b,projectPhases(project).map(x=>x.id));}catch(e){return fail(e instanceof Error?e.message:'Revisa la tarea.');}
  if(t.column_key==='review'&&task?.column_key!=='review'&&!has('tasks_review'))return fail('Tu acceso no permite pasar tareas a «En revisión».',403);
  const doneAt=t.column_key==='done'?(task?.column_key==='done'?task.done_at:now):'';
  if(task){
   if(task.updated_at!==b.updated_at)return fail('Otra persona ha cambiado la tarea. Recarga para ver los cambios.',409);
   const r=await db.prepare('UPDATE project_tasks SET phase_id=?,column_key=?,title=?,description=?,assignee=?,due=?,visible=?,client_task=?,deliverable=?,views=?,checklist=?,links=?,done_at=?,updated_at=? WHERE id=? AND updated_at=?').bind(t.phase_id,t.column_key,t.title,t.description,t.assignee,t.due,t.visible,t.client_task,t.deliverable,t.views,t.checklist,t.links,doneAt,version(),task.id,b.updated_at).run();
   if(!r.meta.changes)return fail('Otra persona ha cambiado la tarea. Recarga para ver los cambios.',409);
  }else{
   const pos=await db.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM project_tasks WHERE project_id=?').bind(project.id).first<any>();
   await db.prepare('INSERT INTO project_tasks(id,project_id,phase_id,column_key,position,title,description,assignee,due,visible,client_task,deliverable,views,checklist,links,done_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),project.id,t.phase_id,t.column_key,pos?.n??0,t.title,t.description,t.assignee,t.due,t.visible,t.client_task,t.deliverable,t.views,t.checklist,t.links,doneAt,now,version()).run();
  }
  return null;
 }
 if(!task)return fail('Tarea no encontrada.',404);
 if(b.action==='moveTask'){
  if(!has('tasks_edit'))return fail('Solo el equipo puede mover tareas.',403);
  if(!columnKeys.includes(b.column_key))return fail('Columna no válida.');
  if(b.column_key==='review'&&task.column_key!=='review'&&!has('tasks_review'))return fail('Tu acceso no permite pasar tareas a «En revisión».',403);
  const r=await db.prepare('UPDATE project_tasks SET column_key=?,done_at=?,updated_at=? WHERE id=? AND updated_at=?').bind(b.column_key,b.column_key==='done'?(task.done_at||now):'',version(),task.id,b.updated_at).run();
  if(!r.meta.changes)return fail('Otra persona ha cambiado la tarea. Recarga para ver los cambios.',409);
  return null;
 }
 if(b.action==='deleteTask'){
  if(!staff)return fail('Solo el equipo puede eliminar tareas.',403);
  await db.batch([db.prepare('DELETE FROM project_reviews WHERE task_id=?').bind(task.id),db.prepare('DELETE FROM project_comments WHERE task_id=?').bind(task.id),db.prepare('DELETE FROM project_tasks WHERE id=?').bind(task.id)]);
  return null;
 }
 const role=staff||c.preview?'team':c.role;
 if(b.action==='taskComment'){
  const body=str(b.body),internal=b.internal===true;if(!body)return fail('Escribe un comentario.');if(internal&&!has('internal_notes'))return fail('Solo el equipo puede dejar notas internas.',403);
  await db.prepare('INSERT INTO project_comments(id,task_id,author,role,body,internal,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),task.id,c.user.displayName,role,body,internal?1:0,now).run();
  return null;
 }
 if(b.action==='taskReview'){
  if(c.role==='collaborator')return fail('La aprobación corresponde al cliente.',403);
  if(!['Aprobado','Cambios solicitados'].includes(b.decision)||!task.deliverable||task.column_key!=='review')return fail('Solo se pueden revisar entregables en revisión.');
  if(b.decision==='Cambios solicitados'&&!str(b.body))return fail('Indica los cambios que necesitas.');
  const v=version(),ops=[db.prepare('UPDATE project_tasks SET column_key=?,done_at=?,updated_at=? WHERE id=? AND updated_at=?').bind(b.decision==='Aprobado'?'done':'doing',b.decision==='Aprobado'?now:'',v,task.id,b.updated_at),db.prepare('INSERT INTO project_reviews(id,task_id,actor,email,role,decision,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM project_tasks WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),task.id,c.user.displayName,c.user.email,role,b.decision,now,task.id,v)];
  if(str(b.body))ops.push(db.prepare('INSERT INTO project_comments(id,task_id,author,role,body,internal,created_at) SELECT ?,?,?,?,?,0,? WHERE EXISTS(SELECT 1 FROM project_tasks WHERE id=? AND updated_at=?)').bind(crypto.randomUUID(),task.id,c.user.displayName,role,str(b.body),now,task.id,v));
  const r=await db.batch(ops);if(!r[0].meta.changes)return fail('El entregable ha cambiado. Recarga antes de revisarlo.',409);
  return null;
 }
 if(b.action==='taskSent'){
  if(staff&&!c.preview)return fail('Esta acción es para el cliente.',403);
  if(c.role==='collaborator')return fail('Esta tarea corresponde al cliente.',403);
  if(!task.client_task||!['todo','doing','wait'].includes(task.column_key))return fail('Esta tarea no está pendiente del cliente.');
  const r=await db.prepare("UPDATE project_tasks SET column_key='review',updated_at=? WHERE id=? AND updated_at=?").bind(version(),task.id,b.updated_at).run();
  if(!r.meta.changes)return fail('La tarea ha cambiado. Recarga antes de continuar.',409);
  await db.prepare('INSERT INTO project_comments(id,task_id,author,role,body,internal,created_at) VALUES(?,?,?,?,?,0,?)').bind(crypto.randomUUID(),task.id,c.user.displayName,role,str(b.body)||'Marcado como enviado.',now).run();
  return null;
 }
 return fail('Acción desconocida.');
}
