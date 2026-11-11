import {startDrag} from './drag';
import {useState,useEffect,useRef} from 'react';
import {Pencil,Plus,Eye,EyeOff,CheckSquare,MessageCircle,X,ExternalLink,Check,Send,Trash2,Lock,Clock3,ImageOff,LayoutGrid,UserRound,Monitor,ChevronDown,Link2,NotebookPen} from 'lucide-react';
import {taskColumns,projectStatuses,deliverableViews,parseJson,projectPhases,currentPhaseIndex,progress,defaultOptions,type Phase,type Field,type ChecklistItem} from '../shared/projects';
import {materialLinks} from '../shared/material-links';
import {drivePreviewUrl} from './drive-preview';
import {driveThumbnailUrl} from './ReviewThumb';
import CommentBody from './CommentBody';
import ProjectNotes,{ClientNotes} from './ProjectNotes';
const day=()=>new Date().toISOString().slice(0,10);
/** Retraso: tareas con fecha límite pasada sin terminar y fases cuya fecha de fin ya pasó con trabajo pendiente. */
export function projectDelay(p:any,tasks:any[],today=day()){
 if(p.status==='done')return null;
 const late=tasks.filter((t:any)=>t.due&&t.due<today&&t.column_key!=='done'),phases=projectPhases(p).filter(ph=>ph.end&&ph.end<today&&tasks.some((t:any)=>t.phase_id===ph.id&&t.column_key!=='done'));
 if(!late.length&&!phases.length)return null;
 const ago=(d:string)=>Math.round((Date.parse(today)-Date.parse(d))/864e5);
 return {late,phases,days:Math.max(...late.map((t:any)=>ago(t.due)),...phases.map(ph=>ago(ph.end)))};
}
const fd=(v:string,year=false)=>v?new Date(v.slice(0,10)+'T12:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',...(year?{year:'numeric'}:{})}):'Sin fecha';
const ago=(v:string)=>new Date(v).toLocaleDateString('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
const colLabel=(k:string)=>taskColumns.find(c=>c[0]===k)?.[1]??k;
const host=(u:string)=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return u;}};
const services:[RegExp,string][]=[[/(^|\.)figma\.com$/,'Figma'],[/^(drive|docs)\.google\.com$/,'Google Drive'],[/(^|\.)miro\.com$/,'Miro'],[/(^|\.)canva\.com$/,'Canva'],[/(^|\.)dropbox\.com$/,'Dropbox'],[/(^|\.)notion\.(so|site)$/,'Notion']];
const service=(u:string)=>{const h=host(u);return services.find(([re])=>re.test(h))?.[1]??h;};
export const projectTasksOf=(data:any,id:string)=>(data.projectTasks??[]).filter((t:any)=>t.project_id===id);
/** Lo que está en manos del cliente: sus tareas abiertas de fases ya empezadas y los entregables en revisión. */
export function clientPending(p:any,tasks:any[]){
 const phases=projectPhases(p),cur=currentPhaseIndex(phases,tasks),idx=(t:any)=>phases.findIndex(x=>x.id===t.phase_id);
 return tasks.filter(t=>t.visible&&(t.deliverable&&t.column_key==='review'||t.client_task&&(t.column_key==='wait'||['todo','doing'].includes(t.column_key)&&idx(t)<=cur)));
}
/** Equipo: todo. Colaborador: según sus permisos. */
const canDo=(data:any,k:string)=>data.role==='owner'||data.role==='team'||data.role==='collaborator'&&!data.preview&&(data.permissions??[]).includes(k);
type Props={data:any;project:any;busy:boolean;error:string;mutate:(body:any,msg:string)=>Promise<any>;onEdit:()=>void};
export default function ProjectPage(props:Props){
 const {data,project:p}=props,staff=data.role==='owner'||data.role==='team',board=canDo(data,'tasks_board');
 const [tab,setTab]=useState<'board'|'notes'|'client'>('board'),notesOk=staff&&!data.preview,nNotes=(data.projectNotes??[]).filter((n:any)=>n.project_id===p.id).length;
 const client=data.clients.find((c:any)=>c.id===p.client_id),status=projectStatuses.find(s=>s[0]===p.status)?.[1];
 return <div className="pj">
  <div className="pj-head"><div><span className="pj-eyebrow">{client?.name}{board&&status?' · '+status:''}</span><h1>{p.name}</h1>{board&&p.summary&&<p>{p.summary}</p>}</div>{board&&<div className="pj-head-actions"><div className="pj-tabs" role="tablist" aria-label="Vista del proyecto"><button role="tab" aria-selected={tab==='board'} onClick={()=>setTab('board')}><LayoutGrid size={15}/>Tablero</button>{notesOk&&<button role="tab" aria-selected={tab==='notes'} onClick={()=>setTab('notes')}><NotebookPen size={15}/>Notas{nNotes>0&&<b className="pj-tabn">{nNotes}</b>}</button>}<button role="tab" aria-selected={tab==='client'} onClick={()=>setTab('client')}><UserRound size={15}/>Vista del cliente</button></div>{canDo(data,'projects_edit')&&<button className="secondary-btn" onClick={props.onEdit}><Pencil size={15}/>Editar proyecto</button>}</div>}</div>
  {board&&tab==='board'?<Board {...props}/>:notesOk&&tab==='notes'?<ProjectNotes {...props}/>:<Status {...props} staffView={board}/>}
 </div>;
}
function Board({data,project:p,busy,error,mutate}:Props){
 const tasks=projectTasksOf(data,p.id),phases=projectPhases(p),cur=currentPhaseIndex(phases,tasks),pct=progress(tasks),pending=clientPending(p,tasks),delay=projectDelay(p,tasks),[lateOnly,setLateOnly]=useState(false);
 const edit=canDo(data,'tasks_edit'),[phase,setPhase]=useState('all'),[open,setOpen]=useState<any>(null),[over,setOver]=useState(''),drag=useRef<any>(null),[dragId,setDragId]=useState('');
 const shown=tasks.filter((t:any)=>(phase==='all'||t.phase_id===phase)&&(!lateOnly||delay?.late.includes(t)));
 const comments=(id:string)=>(data.projectComments??[]).filter((c:any)=>c.task_id===id).length;
 async function drop(col:string){if(!edit)return;const t=drag.current;drag.current=null;setOver('');setDragId('');if(!t||t.column_key===col)return;await mutate({action:'moveTask',id:t.id,column_key:col,updated_at:t.updated_at},`Tarea movida a «${colLabel(col)}»`);}
 const live=open?.id?tasks.find((t:any)=>t.id===open.id):null;
 return <>
  <div className="pj-summary"><div className="pj-tile"><small>Fases</small><div className="pj-phases">{phases.map((ph,i)=><div key={ph.id} className={'pj-phase '+(i<cur?'done':i===cur?'now':'')} title={`${ph.name} · ${fd(ph.start)} – ${fd(ph.end)}`}><i/><span>{ph.name}</span></div>)}</div></div><div className="pj-tile"><small>Avance</small><strong>{pct}%</strong><div className="pj-bar"><i style={{width:pct+'%'}}/></div></div><div className="pj-tile"><small>En manos del cliente</small><strong>{pending.length} {pending.length===1?'tarea':'tareas'}</strong></div><div className={'pj-tile pj-delay'+(delay?' late':' ok')}><small>Plazos</small>{delay?<><strong>Con retraso · {delay.days} {delay.days===1?'día':'días'}</strong>{delay.phases.map(ph=><span key={ph.id}>{ph.name} terminaba el {fd(ph.end)}</span>)}{delay.late.length>0&&<button type="button" className="text-btn" onClick={()=>setLateOnly(!lateOnly)}>{lateOnly?'Ver todas las tareas':`${delay.late.length} ${delay.late.length===1?'tarea vencida':'tareas vencidas'}`}</button>}</>:<strong>Al día</strong>}</div></div>
  <div className="pj-toolbar"><div className="pj-chips" role="group" aria-label="Filtrar por fase"><button className="pj-chip" aria-pressed={phase==='all'} onClick={()=>setPhase('all')}>Todas las fases</button>{phases.map(ph=><button key={ph.id} className="pj-chip" aria-pressed={phase===ph.id} onClick={()=>setPhase(ph.id)}>{ph.name}</button>)}</div>{edit&&<button className="primary" onClick={()=>setOpen({phase_id:phase!=='all'?phase:phases[cur]?.id,column_key:'todo',visible:true})}><Plus size={16}/>Nueva tarea</button>}</div>
  <div className="pj-board-wrap"><div className="pj-board">{taskColumns.map(([key,label])=>{const list=shown.filter((t:any)=>t.column_key===key);return <section key={key} className={'pj-col '+key+(over===key?' drop':'')} aria-label={label} onDragOver={e=>{e.preventDefault();setOver(key);}} onDragLeave={()=>setOver(o=>o===key?'':o)} onDrop={e=>{e.preventDefault();drop(key);}}>
   <h3>{label}<b>{list.length}</b></h3>
   {list.map((t:any)=>{const ck=parseJson<ChecklistItem[]>(t.checklist,[]),n=comments(t.id),ph=phases.find(x=>x.id===t.phase_id);return <button key={t.id} className={'pj-card'+(dragId===t.id?' dragging':'')} draggable={edit&&!busy} onDragStart={e=>{drag.current=t;startDrag(e);setTimeout(()=>setDragId(t.id),0);}} onDragEnd={()=>{setOver('');setDragId('');}} onClick={()=>setOpen(t)}>
    <span className="pj-t">{t.title}</span>
    <span className="pj-tags">{ph&&<span className="pj-tag">{ph.name}</span>}{!!t.deliverable&&<span className="pj-tag deliv">Entregable</span>}{!!t.client_task&&<span className="pj-tag client">Cliente</span>}</span>
    <span className="pj-meta"><span className="l">{t.due&&<span className={t.due<day()&&key!=='done'?'late':''}><Clock3 size={13}/>{fd(t.due)}</span>}{ck.length>0&&<span><CheckSquare size={13}/>{ck.filter(c=>c.done).length}/{ck.length}</span>}{n>0&&<span><MessageCircle size={13}/>{n}</span>}<span className={'vis'+(t.visible?'':' off')} title={t.visible?'Lo ve el cliente':'Solo el equipo'}>{t.visible?<Eye size={13}/>:<EyeOff size={13}/>}</span></span>{t.assignee&&<span className="pj-av" title={t.assignee}>{t.assignee.slice(0,1).toUpperCase()}</span>}</span>
   </button>;})}
   {over===key&&dragId&&drag.current?.column_key!==key&&<div className="pj-ph" aria-hidden="true"/>}
  </section>;})}</div></div>
  <p className="pj-hint">{edit?'Arrastra las tarjetas entre columnas o abre una tarea para cambiar su estado.':'Abre una tarea para ver el detalle y comentar.'}</p>
  {open&&<TaskDrawer key={open.id??'new'} data={data} project={p} task={live??open} busy={busy} error={error} mutate={mutate} onClose={()=>setOpen(null)}/>}
 </>;
}
function TaskDrawer({data,project:p,task,busy,error,mutate,onClose}:{data:any;project:any;task:any;busy:boolean;error:string;mutate:Props['mutate'];onClose:()=>void}){
 const isNew=!task.id,phases=projectPhases(p),team=parseJson<string[]>(p.team,[]),ro=!canDo(data,'tasks_edit'),notes=canDo(data,'internal_notes'),toReview=canDo(data,'tasks_review')||task.column_key==='review';
 const [d,setD]=useState<any>(()=>({title:task.title??'',description:task.description??'',phase_id:task.phase_id??phases[0]?.id,column_key:task.column_key??'todo',assignee:task.assignee??'',due:task.due??'',visible:!!task.visible,client_task:!!task.client_task,deliverable:!!task.deliverable,views:parseJson<string[]>(task.views,[]),checklist:parseJson<ChecklistItem[]>(task.checklist,[]),links:task.links??''}));
 const [item,setItem]=useState(''),[note,setNote]=useState(''),[internal,setInternal]=useState(false),dirty=useRef(false),ref=useRef<HTMLElement>(null);
 const set=(k:string,v:any)=>{dirty.current=true;setD((x:any)=>({...x,[k]:v}));};
 const close=()=>{if(busy)return;if((dirty.current||note.trim())&&!confirm('Hay cambios sin guardar. ¿Quieres descartarlos?'))return;onClose();};
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{const prev=document.activeElement as HTMLElement,ov=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector<HTMLElement>('input,textarea')?.focus();const k=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeRef.current();}};window.addEventListener('keydown',k);return()=>{window.removeEventListener('keydown',k);document.body.style.overflow=ov;prev?.focus?.();};},[]);
 const comments=(data.projectComments??[]).filter((c:any)=>c.task_id===task.id);
 async function save(e:React.FormEvent){e.preventDefault();const r=await mutate({action:'task',...(isNew?{project_id:p.id}:{id:task.id,updated_at:task.updated_at}),...d},isNew?'Tarea creada':'Tarea guardada');if(r){dirty.current=false;onClose();}}
 async function remove(){if(!confirm(`¿Eliminar la tarea «${task.title}», sus comentarios y aprobaciones?`))return;if(await mutate({action:'deleteTask',id:task.id},'Tarea eliminada'))onClose();}
 async function comment(e:React.FormEvent){e.preventDefault();if(await mutate({action:'taskComment',id:task.id,body:note,internal},internal?'Nota interna guardada':'Comentario añadido')){setNote('');setInternal(false);}}
 const ck:ChecklistItem[]=d.checklist;
 return <div className="drawer-overlay" onClick={e=>{if(e.target===e.currentTarget)close();}}><section ref={ref} className="drawer pj-drawer" role="dialog" aria-modal="true" aria-labelledby="task-title">
  <div className="pj-dhead"><span className="pj-eyebrow">{isNew?'NUEVA TAREA':colLabel(task.column_key).toUpperCase()}</span><button type="button" className="icon-btn" aria-label="Cerrar tarea" onClick={close}><X size={20}/></button></div>
  <form className="pj-dbody" onSubmit={save}><fieldset className="pj-fs" disabled={ro}>
   <h2 id="task-title" className="sr-only">{isNew?'Nueva tarea':task.title}</h2>
   <label>Título<input value={d.title} maxLength={160} required onChange={e=>set('title',e.target.value)}/></label>
   <div className="pe-g2"><label>Fase<select value={d.phase_id} onChange={e=>set('phase_id',e.target.value)}>{phases.map((ph,i)=><option key={ph.id} value={ph.id}>{ph.name||'Fase '+(i+1)}</option>)}</select></label><label>Estado<select value={d.column_key} onChange={e=>set('column_key',e.target.value)}>{taskColumns.filter(([k])=>toReview||k!=='review').map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
    <label>Responsable<input list="pj-team" value={d.assignee} maxLength={80} placeholder="Sin asignar" onChange={e=>set('assignee',e.target.value)}/><datalist id="pj-team">{team.map(n=><option key={n} value={n}/>)}</datalist></label><label>Fecha límite<input type="date" value={d.due} onChange={e=>set('due',e.target.value)}/></label></div>
   <label>Descripción<textarea rows={3} value={d.description} maxLength={5000} placeholder="Qué hay que hacer y qué se espera" onChange={e=>set('description',e.target.value)}/></label>
   <div className="pj-toggles">
    <label className="pe-opt"><span><b>Visible para el cliente</b><small>Si está apagado, solo la ve el equipo.</small></span><input type="checkbox" role="switch" className="pe-switch" checked={d.visible} onChange={e=>set('visible',e.target.checked)}/></label>
    <label className="pe-opt"><span><b>La hace el cliente</b><small>Le aparece en «Qué necesitamos de ti» y puede marcarla como enviada.</small></span><input type="checkbox" role="switch" className="pe-switch" checked={d.client_task} onChange={e=>{set('client_task',e.target.checked);if(e.target.checked)set('visible',true);}}/></label>
    <label className="pe-opt"><span><b>Entregable para aprobar</b><small>En «En revisión» el cliente lo ve en el visor y puede aprobarlo o pedir cambios.</small></span><input type="checkbox" role="switch" className="pe-switch" checked={d.deliverable} onChange={e=>{set('deliverable',e.target.checked);if(e.target.checked)set('visible',true);}}/></label>
   </div>
   {d.deliverable&&<div className="pj-sec"><h4>Vistas del entregable</h4><p className="pe-note">Cada vista corresponde a un enlace, en el mismo orden.</p><div className="pe-views">{deliverableViews.map(v=><button type="button" key={v} className="pe-vchip" aria-pressed={d.views.includes(v)} onClick={()=>set('views',d.views.includes(v)?d.views.filter((x:string)=>x!==v):[...d.views,v])}>{v}</button>)}</div></div>}
   <label>Enlaces{d.deliverable?' del entregable':''}<small className="pe-note">{d.visible?'El cliente los verá al desplegar la fase en «Fases del proyecto» de su panel.':'Solo los ve el equipo mientras la tarea no sea visible para el cliente.'}</small><textarea rows={3} value={d.links} placeholder={'Un enlace por línea: Figma, Drive, un boceto…\nhttps://www.figma.com/design/…'} onChange={e=>set('links',e.target.value)}/></label>
   <div className="pj-sec"><h4>Checklist {ck.length>0&&<small>{ck.filter(c=>c.done).length}/{ck.length}</small>}</h4><div className="pj-check">{ck.map((c,i)=><div key={i}><label><input type="checkbox" checked={c.done} onChange={e=>set('checklist',ck.map((x,j)=>j===i?{...x,done:e.target.checked}:x))}/><span>{c.text}</span></label><button type="button" className="icon-btn" aria-label={'Quitar '+c.text} onClick={()=>set('checklist',ck.filter((_,j)=>j!==i))}><X size={14}/></button></div>)}</div>{ck.length<50&&<div className="pe-addp"><input aria-label="Nuevo punto del checklist" value={item} maxLength={200} placeholder="Añadir un punto" onChange={e=>setItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(item.trim()){set('checklist',[...ck,{text:item.trim(),done:false}]);setItem('');}}}}/><button type="button" className="secondary-btn" disabled={!item.trim()} onClick={()=>{set('checklist',[...ck,{text:item.trim(),done:false}]);setItem('');}}><Plus size={15}/>Añadir</button></div>}</div>
   </fieldset>{error&&<p className="pe-error" role="alert">{error}</p>}
   {!ro&&<div className="pj-dactions">{!isNew&&(data.role==='owner'||data.role==='team')&&<button type="button" className="danger-text-btn" disabled={busy} onClick={remove}><Trash2 size={15}/>Eliminar</button>}<button className="primary" disabled={busy||!d.title.trim()}><Check size={16}/>{busy?'Guardando…':isNew?'Crear tarea':'Guardar tarea'}</button></div>}
  </form>
  {!isNew&&<form className="pj-dbody pj-thread" onSubmit={comment}><h4>Conversación · {comments.length}</h4>{comments.length?comments.map((c:any)=><article key={c.id} className={'pj-msg'+(c.internal?' int':c.role==='client'?' cli':'')}><small>{c.author} · {ago(c.created_at)}{c.internal?' · Nota interna':''}</small><CommentBody c={c} busy={busy} onSave={body=>mutate({action:'taskCommentEdit',id:c.id,body},'Comentario editado')}/></article>):<p className="pe-note">Todavía no hay comentarios en esta tarea.</p>}<textarea aria-label="Escribe un comentario" rows={2} value={note} maxLength={5000} placeholder={internal?'Nota solo para el equipo':'Escribe un comentario para el cliente'} onChange={e=>setNote(e.target.value)}/><div className="pj-dactions">{notes&&<label className="pe-mini"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/>Nota interna</label>}<button className="secondary-btn" disabled={busy||!note.trim()}><Send size={15}/>Enviar comentario</button></div></form>}
 </section></div>;
}
function Viewer({task,viewer,domain}:{task:any;viewer:string;domain:string}){
 const links=materialLinks(task?.links??''),views=parseJson<string[]>(task?.views,[]),[i,setI]=useState(0),cur=links[Math.min(i,links.length-1)]??'',preview=cur?drivePreviewUrl(cur):null;
 const label=(j:number)=>views[j]??(links.length>1?'Archivo '+(j+1):'Archivo');
 const body=!cur?<div className="pj-wip"><ImageOff size={22}/><span>Estamos preparando este entregable</span></div>:preview?<iframe key={preview} className={'pj-frame'+(views[i]==='Móvil'?' mobile':'')} src={preview} title={`${label(i)} de ${task.title}`} allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"/>:<div className="pj-wip"><Monitor size={22}/><span>Este entregable se abre fuera de la app.</span><a className="secondary-btn" href={cur} target="_blank" rel="noopener noreferrer">Abrir {host(cur)}<ExternalLink size={14}/></a></div>;
 return <>{links.length>1&&<div className="pj-seg" role="group" aria-label="Vistas del entregable">{links.map((_,j)=><button key={j} aria-pressed={j===i} onClick={()=>setI(j)}>{label(j)}</button>)}</div>}
  <div className={'pj-device '+viewer}>{viewer==='web'&&<div className="pj-bar2" aria-hidden="true"><i/><i/><i/><span>{domain?host(domain):cur?host(cur):'vista previa'}</span></div>}{body}</div>
  {cur&&<a className="text-btn pj-open" href={cur} target="_blank" rel="noopener noreferrer">{preview?'Abrir en Drive':'Abrir enlace'}<ExternalLink size={14}/></a>}</>;
}
function Status({data,project:p,busy,error,mutate,staffView}:Props&{staffView:boolean}){
 const tasks=projectTasksOf(data,p.id).filter((t:any)=>!staffView||t.visible),phases=projectPhases(p),cur=currentPhaseIndex(phases,tasks),now=phases[cur],opts:Record<string,boolean>={...defaultOptions,...parseJson(p.options,{})},fields=parseJson<Field[]>(p.fields,[]).filter(f=>f.visible&&f.value),team=parseJson<string[]>(p.team,[]);
 const isClient=data.role==='client',canAct=isClient&&!staffView,pct=progress(tasks),pending=clientPending(p,tasks),domain=fields.find(f=>f.type==='Enlace'&&/dominio|web/i.test(f.name))?.value??'';
 const deliverables=tasks.filter((t:any)=>t.deliverable),pick=deliverables.find((t:any)=>t.column_key==='review')??[...deliverables].reverse().find((t:any)=>t.phase_id===now?.id&&t.links)??[...deliverables].reverse().find((t:any)=>t.links)??deliverables[0];
 const [sel,setSel]=useState<string|undefined>(),d=deliverables.find((t:any)=>t.id===sel)??pick;
 const [openPh,setOpenPh]=useState<string|null>(null),inPh=(x:Phase)=>tasks.filter((t:any)=>t.phase_id===x.id);
 const [changes,setChanges]=useState(''),[note,setNote]=useState(''),[asking,setAsking]=useState(false);
 const ph=(t:any)=>phases.find(x=>x.id===t.phase_id),stLabel=(t:any)=>t.column_key==='done'?['ok','Aprobado']:t.column_key==='review'?['rev','Para revisar']:t.column_key==='doing'?['wip','En curso']:['next','Próximamente'];
 const comments=(data.projectComments??[]).filter((c:any)=>c.task_id===d?.id&&!c.internal);
 const end=phases[phases.length-1]?.end,phaseFill=(x:Phase)=>{const ts=tasks.filter((t:any)=>t.phase_id===x.id);return ts.length?Math.round(ts.filter((t:any)=>t.column_key==='done').length/ts.length*100):0;};
 async function review(decision:string){if(decision==='Aprobado'&&opts.lock&&!confirm(`Vas a aprobar «${d.title}». Después de aprobarlo pasará a producción y no se podrá cambiar. ¿Confirmas la aprobación?`))return;const r=await mutate({action:'taskReview',id:d.id,updated_at:d.updated_at,decision,body:decision==='Cambios solicitados'?changes:''},decision==='Aprobado'?'Entregable aprobado':'Cambios enviados al equipo');if(r){setChanges('');setAsking(false);}}
 async function sent(t:any){await mutate({action:'taskSent',id:t.id,updated_at:t.updated_at},'Avisamos al equipo de que ya lo has enviado');}
 async function comment(e:React.FormEvent){e.preventDefault();if(await mutate({action:'taskComment',id:d.id,body:note},'Comentario enviado'))setNote('');}
 const week=tasks.filter((t:any)=>t.column_key==='doing'||t.due&&t.due>=day()&&t.due<=new Date(Date.now()+7*864e5).toISOString().slice(0,10)&&t.column_key!=='done').slice(0,6);
 const reviews=(data.projectReviews??[]).filter((r:any)=>tasks.some((t:any)=>t.id===r.task_id));
 const hist=[...reviews.map((r:any)=>({at:r.created_at,text:`${r.actor} ${r.decision==='Aprobado'?'aprobó':'pidió cambios en'} «${tasks.find((t:any)=>t.id===r.task_id)?.title}»`})),...tasks.filter((t:any)=>t.done_at&&!reviews.some((r:any)=>r.task_id===t.id&&r.decision==='Aprobado')).map((t:any)=>({at:t.done_at,text:`Terminado: ${t.title}`}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,8);
 if(!phases.length)return null;
 return <div className="pj-cv">
  {staffView&&<p className="pj-note">Así ve el cliente este proyecto: solo las tareas visibles y los campos marcados como visibles.</p>}
  <section className="pj-box pj-status"><div className="pj-status-top"><div><span className="pj-eyebrow">ESTADO DEL PROYECTO</span><h2>{p.status==='done'?<>Proyecto <em>terminado</em></>:p.status==='paused'?<>Proyecto <em>en pausa</em></>:<>Estamos en la fase de <em>{now?.name}</em></>}</h2><p>{p.summary||(now?.milestone?`Próximo hito: ${now.milestone}.`:'')}</p></div>
   <div className="pj-facts">{opts.pct&&<div className="pj-ring" style={{'--p':pct} as any} role="img" aria-label={`Avance del ${pct}%`}><div><b>{pct}%</b><small>completado</small></div></div>}<dl className="pj-flist">{now?.milestone&&<div><dt>PRÓXIMO HITO</dt><dd>{now.milestone}</dd></div>}{now?.end&&<div><dt>FIN DE ESTA FASE</dt><dd>{fd(now.end,true)}</dd></div>}{end&&<div><dt>ENTREGA FINAL</dt><dd>{fd(end,true)}</dd></div>}</dl></div></div>
   <ol className="pj-stepper" style={{gridTemplateColumns:`repeat(${phases.length},minmax(0,1fr))`}}>{phases.map((x,i)=><li key={x.id} className={i<cur||p.status==='done'?'done':i===cur?'now':''} style={i===cur?{'--f':phaseFill(x)+'%'} as any:undefined}><span className="n">{i<cur||p.status==='done'?<Check size={14}/>:i+1}</span><b>{x.name}</b><span>{x.start||x.end?`${fd(x.start)} – ${fd(x.end)}`:'Sin fechas'}</span>{i===cur&&p.status==='active'&&<span className="pj-tag2">Ahora</span>}</li>)}</ol>
  </section>
  <div className="pj-work">
   <section className="pj-box pj-viewer"><p className="pj-slabel">{d?.column_key==='review'?'PARA TU REVISIÓN':'EL DISEÑO, AHORA MISMO'}</p>{d?<>
    <div className="pj-vhead"><div><h3>{d.title}</h3><small>{ph(d)?.name}</small></div><span className={'pj-st '+stLabel(d)[0]}>{stLabel(d)[1]}</span></div>
    <Viewer key={d.id} task={d} viewer={p.viewer} domain={domain}/>
    {d.column_key==='review'&&(canAct||data.preview)&&<div className="pj-approve">{asking?<><label>¿Qué hay que cambiar?<textarea rows={3} value={changes} maxLength={5000} placeholder="Describe los cambios que necesitas" onChange={e=>setChanges(e.target.value)}/></label><div className="pj-dactions"><button className="secondary-btn" onClick={()=>setAsking(false)}>Cancelar</button><button className="primary" disabled={busy||!changes.trim()} onClick={()=>review('Cambios solicitados')}>Enviar cambios</button></div></>:<div className="pj-dactions"><span className="pe-note">{opts.lock?<><Lock size={13}/> Al aprobarlo pasa a producción.</>:'¿Te encaja? Apruébalo o pídenos cambios.'}</span><button className="secondary-btn" onClick={()=>setAsking(true)}>Pedir cambios</button><button className="primary" disabled={busy} onClick={()=>review('Aprobado')}><Check size={16}/>Aprobar</button></div>}</div>}
    {error&&<p className="pe-error" role="alert">{error}</p>}
    {deliverables.length>1&&<div className="pj-film">{deliverables.map((t:any)=>{const src=materialLinks(t.links).map(driveThumbnailUrl).find(Boolean),[k,l]=stLabel(t);return <button key={t.id} className="pj-scr" aria-pressed={t.id===d.id} onClick={()=>setSel(t.id)}><span className="th">{src?<img src={src} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<ImageOff size={18}/>}</span><b>{t.title}</b><span><small>{ph(t)?.name}</small><span className={'pj-st '+k}>{l}</span></span></button>;})}</div>}
    {(canAct||data.role==='collaborator'||data.preview)&&<form className="pj-thread" onSubmit={comment}><h4>Comentarios · {comments.length}</h4>{comments.map((c:any)=><article key={c.id} className={'pj-msg'+(c.role==='client'?' cli':'')}><small>{c.author} · {ago(c.created_at)}</small><CommentBody c={c} busy={busy} onSave={body=>mutate({action:'taskCommentEdit',id:c.id,body},'Comentario editado')}/></article>)}<textarea aria-label="Escribe un comentario" rows={2} value={note} maxLength={5000} placeholder="Escribe un comentario sobre este entregable" onChange={e=>setNote(e.target.value)}/><div className="pj-dactions"><button className="secondary-btn" disabled={busy||!note.trim()}><Send size={15}/>Enviar comentario</button></div></form>}
   </>:<div className="pj-wip"><ImageOff size={22}/><span>Aquí verás los diseños cuando estén listos.</span></div>}</section>
   <div className="pj-side">
    <section className={'pj-box pj-card2'+(pending.length?' todo':'')}><h3>Qué necesitamos de ti{pending.length>0&&<span className="pj-count">{pending.length}</span>}</h3>{pending.length?pending.map((t:any)=><div className="pj-item" key={t.id}><b>{t.deliverable&&t.column_key==='review'?`Revisar «${t.title}»`:t.title}</b>{t.description&&<p>{t.description}</p>}{t.due&&<p>Antes del {fd(t.due)}</p>}{t.deliverable&&t.column_key==='review'?<button className="secondary-btn" onClick={()=>setSel(t.id)}>Ver el diseño</button>:t.column_key==='review'?<span className="pj-st ok">Enviado, lo estamos revisando</span>:canAct||data.preview?<button className="secondary-btn" disabled={busy} onClick={()=>sent(t)}><Send size={14}/>Marcar como enviado</button>:<span className="pe-note">Pendiente del cliente</span>}</div>):<p className="pe-note">Ahora mismo no tienes nada pendiente. Te avisaremos cuando haya algo que revisar.</p>}</section>
    <section className="pj-box pj-card2"><h3>Fases del proyecto</h3><ul className="pj-plist">{phases.map((x,i)=>{const ts=inPh(x),open=openPh===x.id,nl=ts.reduce((n:number,t:any)=>n+materialLinks(t.links??'').length,0);return <li key={x.id} className={open?'open':''}><button type="button" className="pj-prow" aria-expanded={open} disabled={!ts.length} onClick={()=>setOpenPh(open?null:x.id)}><span className={'ck'+(i<cur||p.status==='done'?' y':i===cur?' h':'')}>{(i<cur||p.status==='done')&&<Check size={11}/>}</span><span>{x.name}{x.milestone&&<small>{x.milestone}</small>}</span><small>{nl>0&&<span className="pj-pl" title={`${nl} ${nl===1?'enlace':'enlaces'}`}><Link2 size={12}/>{nl}</span>}{fd(x.end)}{ts.length>0&&<ChevronDown size={14} className="pj-chev"/>}</small></button>{open&&<ul className="pj-ptasks">{ts.map((t:any)=>{const [k,l]=stLabel(t),ls=materialLinks(t.links??'');return <li key={t.id}><div className="pj-lt"><b>{t.title}</b><span className={'pj-st '+k}>{l}</span></div>{t.description&&<p>{t.description}</p>}{t.due&&t.column_key!=='done'&&<small>Fecha límite: {fd(t.due,true)}</small>}{ls.length>0&&<span className="pj-lchips">{ls.map((u,j)=><a key={j} className="pj-lchip" href={u} target="_blank" rel="noopener noreferrer">{service(u)}<ExternalLink size={12}/></a>)}</span>}{!!t.deliverable&&<button type="button" className="text-btn" onClick={()=>{setSel(t.id);document.querySelector('.pj-viewer')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Ver en el visor</button>}</li>;})}</ul>}</li>;})}</ul></section>
    {opts.prod&&fields.length>0&&<section className="pj-box pj-card2"><h3>Datos del proyecto</h3><dl className="pj-fields">{fields.map((f,i)=><div key={i}><dt>{f.name}</dt><dd>{f.type==='Enlace'?<a href={f.value} target="_blank" rel="noopener noreferrer">{host(f.value)}<ExternalLink size={12}/></a>:f.type==='Fecha'?fd(f.value,true):f.value}</dd></div>)}</dl></section>}
    <ClientNotes data={data} project={p}/>
   </div>
  </div>
  <div className="pj-lower">
   <section className="pj-box pj-card2"><h3>Esta semana</h3>{week.length?<ul className="pj-week">{week.map((t:any)=><li key={t.id}><span className="pj-av">{(t.assignee||'B').slice(0,1).toUpperCase()}</span><span>{t.title}<small>{t.assignee||'Equipo Blau'} · {colLabel(t.column_key)}</small></span><span className="d">{t.due?fd(t.due):''}</span></li>)}</ul>:<p className="pe-note">No hay tareas previstas para esta semana.</p>}{team.length>0&&<div className="pj-team">{team.map(n=><div key={n}><span className="pj-av">{n.slice(0,1).toUpperCase()}</span>{n}</div>)}</div>}</section>
   {opts.hist&&<section className="pj-box pj-card2"><h3>Historial</h3>{hist.length?<ul className="pj-hist">{hist.map((h,i)=><li key={i}>{h.text}<time>{ago(h.at)}</time></li>)}</ul>:<p className="pe-note">Aquí aparecerán los avances y las aprobaciones.</p>}</section>}
  </div>
 </div>;
}
