import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Plus,Star,X,Check} from 'lucide-react';
import {startDrag,touchDrag} from './drag';
import {addWeeks,dayOf,mondayOf} from '../shared/week';
import {keyDatesFor,customDatesFor} from '../shared/key-dates';
import {projectPhases,taskColumns} from '../shared/projects';
// «Mi semana»: solo para el administrador. Las tarjetas son punteros a tareas y publicaciones; el Worker guarda día y orden, y el título y el estado se leen siempre del original.
type Props={data:any;busy:boolean;mutate:(body:any,msg:string|((d:any)=>string))=>Promise<any>;onOpenProject:(id:string)=>void;onOpenPost:(p:any)=>void};
const dayNames=['Lun','Mar','Mié','Jue','Vie'],today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const colLabel=(k:string)=>taskColumns.find(c=>c[0]===k)?.[1]??k;
const range=(w:string)=>{const a=new Date(dayOf(w,0)+'T12:00'),b=new Date(dayOf(w,4)+'T12:00'),m=(d:Date)=>d.toLocaleDateString('es-ES',{month:'long'});return a.getMonth()===b.getMonth()?`Del ${a.getDate()} al ${b.getDate()} de ${m(b)}`:`Del ${a.getDate()} de ${m(a)} al ${b.getDate()} de ${m(b)}`;};
type Item={key:string;kind:'task'|'post'|'free';ref:string;title:string;color:string;brand:string;sub:string;tag:string;tone:string;late:boolean;done:boolean;project?:any;post?:any;task?:any};
export default function MyWeek({data,busy,mutate,onOpenProject,onOpenPost}:Props){
 const now=today(),[week,setWeek]=useState(()=>mondayOf(now)),[brand,setBrand]=useState('all'),[over,setOver]=useState(''),[adding,setAdding]=useState<number|null>(null),[freeTitle,setFreeTitle]=useState('');
 const drag=useRef<any>(null),[dragKey,setDragKey]=useState('');
 const clients:any[]=data.clients,projects:any[]=data.projects??[],tasks:any[]=data.projectTasks??[],posts:any[]=data.posts??[];
 const plan:any[]=(data.weekPlan??[]).filter((c:any)=>c.week===week),notes=(data.weekNotes??[]).find((n:any)=>n.week===week);
 const col=(id:string)=>clients.find(c=>c.id===id),prj=(id:string)=>projects.find(p=>p.id===id);
 const taskItem=(t:any):Item|null=>{const p=prj(t.project_id);if(!p)return null;const c=col(p.client_id),ph=projectPhases(p).find(x=>x.id===t.phase_id);return {key:'t'+t.id,kind:'task',ref:t.id,title:t.title,color:c?.color??'#9aa5ab',brand:c?.name??'',sub:`${p.name}${ph?' · '+ph.name:''}`,tag:colLabel(t.column_key),tone:t.column_key==='wait'?'wait':t.column_key==='review'?'rev':'',late:!!t.due&&t.due<now&&t.column_key!=='done',done:t.column_key==='done',project:p,task:t};};
 const postItem=(p:any):Item=>{const c=col(p.client_id);return {key:'p'+p.id,kind:'post',ref:p.id,title:p.title,color:c?.color??'#9aa5ab',brand:c?.name??'',sub:`${p.format} · ${p.channel}`,tag:p.status,tone:p.status==='En revisión'?'rev':'',late:false,done:p.status==='Publicado',post:p};};
 const placed=useMemo(()=>new Set(plan.filter(c=>c.kind!=='free').map(c=>c.kind+':'+c.ref_id)),[plan]);
 const inBrand=(clientId:string)=>brand==='all'||clientId===brand;
 const open=tasks.filter(t=>t.column_key!=='done'&&prj(t.project_id)&&prj(t.project_id).status!=='paused'&&prj(t.project_id).status!=='done'&&inBrand(prj(t.project_id).client_id)&&!placed.has('task:'+t.id));
 const weekEnd=dayOf(week,6),seen=new Set<string>();
 const take=(list:any[],mk:(x:any)=>Item|null)=>list.map(mk).filter((i):i is Item=>!!i&&!seen.has(i.key)&&!!seen.add(i.key));
 const groups:[string,Item[]][]=[
  ['Vencido o esperando al cliente',take(open.filter(t=>(t.due&&t.due<now)||t.column_key==='wait'),taskItem)],
  ['Publicaciones de la semana',take(posts.filter(p=>p.date&&p.date.slice(0,10)>=week&&p.date.slice(0,10)<=weekEnd&&p.status!=='Publicado'&&inBrand(p.client_id)&&!placed.has('post:'+p.id)),postItem)],
  ['Tareas con fecha esta semana',take(open.filter(t=>t.due&&t.due>=week&&t.due<=weekEnd),taskItem)],
  ['Mes en curso de proyectos mensuales',take(open.filter(t=>{const p=prj(t.project_id);return p.cadence==='monthly'&&t.phase_id==='m-'+now.slice(0,7);}),taskItem)],
  ['En curso',take(open.filter(t=>t.column_key==='doing'||t.column_key==='review'),taskItem)]
 ].filter(g=>g[1].length) as [string,Item[]][];
 const itemOf=(c:any):Item|null=>{if(c.kind==='free')return {key:'f'+c.id,kind:'free',ref:c.id,title:c.title,color:'#9aa5ab',brand:'',sub:'Tarjeta libre',tag:'',tone:'',late:false,done:!!c.done};if(c.kind==='task'){const t=tasks.find(x=>x.id===c.ref_id);return t?taskItem(t):null;}const p=posts.find(x=>x.id===c.ref_id);return p?postItem(p):null;};
 const cards=plan.map(c=>({c,item:itemOf(c)})).filter(x=>x.item&&(x.c.kind==='free'||brand==='all'||(x.item.task?inBrand(x.item.project.client_id):x.item.post?inBrand(x.item.post.client_id):true))) as {c:any;item:Item}[];
 const byDay=(d:number)=>cards.filter(x=>x.c.day===d).sort((a,b)=>a.c.position-b.c.position);
 const late=open.filter(t=>t.due&&t.due<now).length,waiting=open.filter(t=>t.column_key==='wait').length,toReview=posts.filter(p=>p.status==='En revisión'&&inBrand(p.client_id)).length;
 const keys=useMemo(()=>{const ys=[...new Set([week.slice(0,4),weekEnd.slice(0,4)].map(Number))];return [...ys.flatMap(keyDatesFor),...customDatesFor(data.keyDates??[],ys).filter((k:any)=>!k.client_id||inBrand(k.client_id))].filter((k:any)=>k.date>=week&&k.date<=weekEnd&&k.kind!=='festivo').sort((a:any,b:any)=>a.date.localeCompare(b.date));},[week,data.keyDates,brand]);
 const doneN=cards.filter(x=>x.item.done).length;
 // Foco y nota de la semana.
 const [focus,setFocus]=useState<string[]>(['','','']),[note,setNote]=useState('');
 useEffect(()=>{let f:string[]=[];try{f=JSON.parse(notes?.focus||'[]');}catch{}setFocus([f[0]??'',f[1]??'',f[2]??'']);setNote(notes?.note??'');},[week,notes?.focus,notes?.note]);
 const saveNotes=(f=focus,n=note)=>{if(JSON.stringify(f.filter(x=>x.trim()))===JSON.stringify((()=>{try{return JSON.parse(notes?.focus||'[]');}catch{return[];}})())&&n===(notes?.note??''))return;mutate({action:'weekNotes',week,focus:f.map(x=>x.trim()).filter(Boolean),note:n},'Semana guardada');};
 // Arrastrar y colocar.
 const place=async(day:number,pos?:number)=>{const d=drag.current;drag.current=null;setOver('');setDragKey('');if(!d)return;if(d.id)await mutate({action:'weekPlace',id:d.id,day,position:pos},'Tarjeta movida');else await mutate({action:'weekPlace',week,kind:d.kind,ref_id:d.ref,day,position:pos},'Añadida a tu semana');};
 const unplace=async()=>{const d=drag.current;drag.current=null;setOver('');setDragKey('');if(d?.id)await mutate({action:'weekUnplace',id:d.id},'Quitada de tu semana');};
 const dragProps=(src:any,key:string)=>({draggable:!busy,onDragStart:(e:any)=>{if(!startDrag(e))return;drag.current=src;setTimeout(()=>setDragKey(key),0);},onDragEnd:()=>{setOver('');setDragKey('');},onTouchStart:(e:any)=>{if(!busy)touchDrag(e,{start:()=>{drag.current=src;setDragKey(key);},over:setOver,drop:(k:string)=>{if(k==='tray')void unplace();else void place(+k.slice(1));},end:()=>{drag.current=null;setOver('');setDragKey('');}});}});
 const cardView=(it:Item,extra:any,key:string,inWeek?:any)=><div key={key} className={'wk-card'+(it.kind==='post'?' post':'')+(it.done?' done':'')+(dragKey===key?' dragging':'')} style={{'--k':it.color} as any} {...dragProps(extra,key)} onDragOver={inWeek?(e:any)=>{if(drag.current){e.preventDefault();e.stopPropagation();setOver('c'+inWeek.id);}}:undefined} onDrop={inWeek?(e:any)=>{e.preventDefault();e.stopPropagation();void place(inWeek.day,inWeek.position);}:undefined}>
  <button type="button" className="wk-title" onClick={()=>it.kind==='task'?onOpenProject(it.project.id):it.kind==='post'?onOpenPost(it.post):undefined} disabled={it.kind==='free'}>{it.title}</button>
  <span className="wk-meta">{it.brand&&<b>{it.brand}</b>}<span>{it.sub}</span></span>
  <span className="wk-tags">{it.late&&<span className="wk-tag late">Vencida</span>}{it.tone==='wait'?<span className="wk-tag wait">Espera al cliente</span>:it.tag&&<span className="wk-tag">{it.tag}</span>}{inWeek?.priority?<span className="wk-tag urg">Prioridad</span>:null}</span>
  {inWeek&&<span className="wk-actions">{it.kind!=='post'&&<label className="wk-done"><input type="checkbox" checked={it.done} disabled={busy} onChange={e=>it.kind==='free'?mutate({action:'weekDone',id:inWeek.id,done:e.target.checked},e.target.checked?'Hecho':'Pendiente'):mutate({action:'moveTask',id:it.task.id,column_key:e.target.checked?'done':'todo',updated_at:it.task.updated_at},e.target.checked?'Tarea terminada':'Tarea reabierta')}/> Hecho</label>}<button type="button" className={'wk-icon'+(inWeek.priority?' on':'')} title={inWeek.priority?'Quitar prioridad':'Marcar como prioridad'} aria-label="Prioridad" disabled={busy} onClick={()=>mutate({action:'weekFlag',id:inWeek.id,priority:!inWeek.priority},'Prioridad actualizada')}><Star size={14}/></button><button type="button" className="wk-icon" title="Quitar de la semana" aria-label="Quitar de la semana" disabled={busy} onClick={()=>mutate({action:'weekUnplace',id:inWeek.id},'Quitada de tu semana')}><X size={14}/></button></span>}
 </div>;
 async function addFree(day:number){const title=freeTitle.trim();if(!title)return;if(await mutate({action:'weekFree',week,day,title},'Tarjeta añadida')){setAdding(null);setFreeTitle('');}}
 const next=addWeeks(week,1),isNow=week===mondayOf(now);
 return <div className="wk">
  <div className="page-heading"><div><span className="page-eyebrow">Solo para el administrador</span><h1>Mi semana</h1><p>{range(week)}{isNow?' · esta semana':''}</p></div><div className="wk-nav"><button className="icon-btn" aria-label="Semana anterior" onClick={()=>setWeek(addWeeks(week,-1))}><ChevronLeft size={18}/></button><button className="secondary-btn" disabled={isNow} onClick={()=>setWeek(mondayOf(now))}>Esta semana</button><button className="icon-btn" aria-label="Semana siguiente" onClick={()=>setWeek(next)}><ChevronRight size={18}/></button><button className="primary" onClick={()=>{setAdding(0);setFreeTitle('');}}><Plus size={16}/>Tarjeta libre</button></div></div>
  <section className="wk-focus" aria-label="Foco de la semana"><h2>Foco de la semana</h2>{[0,1,2].map(i=><label key={i}><i>{i+1}</i><input value={focus[i]} title={focus[i]} maxLength={160} placeholder={['Lo más importante','Lo segundo','Lo tercero'][i]} aria-label={`Prioridad ${i+1}`} onChange={e=>setFocus(focus.map((x,j)=>j===i?e.target.value:x))} onBlur={()=>saveNotes()}/></label>)}</section>
  <div className="wk-chips" aria-label="Alertas"><span className="wk-chip"><u style={{background:'#e5484d'}}/><b>{late}</b> {late===1?'tarea vencida':'tareas vencidas'}</span><span className="wk-chip"><u style={{background:'#d98a1f'}}/><b>{waiting}</b> esperando al cliente</span><span className="wk-chip"><u style={{background:'#13dbfb'}}/><b>{toReview}</b> {toReview===1?'publicación por aprobar':'publicaciones por aprobar'}</span>{keys.slice(0,3).map((k:any)=><span className="wk-chip" key={k.date+k.title}>{new Date(k.date+'T12:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric'})} · <b>{k.title}</b></span>)}
   <label className="wk-brand">Marca<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="all">Todas las marcas</option>{clients.filter(c=>!c.archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
  <div className="wk-layout">
   <aside className={'wk-tray'+(over==='tray'?' over':'')} aria-label="Por colocar" data-drop="tray" onDragOver={e=>{if(drag.current?.id){e.preventDefault();setOver('tray');}}} onDragLeave={()=>setOver('')} onDrop={e=>{e.preventDefault();void unplace();}}>
    <h2>Por colocar</h2>
    {groups.map(([name,items])=><div className="wk-group" key={name}><h3>{name} <small>{items.length}</small></h3>{items.slice(0,40).map(it=>cardView(it,{kind:it.kind,ref:it.ref},'tray'+it.key))}</div>)}
    {!groups.length&&<p className="wk-empty">No queda nada por colocar{brand!=='all'?' de esta marca':''}. Lo que venza o esté en curso aparecerá aquí.</p>}
   </aside>
   <section className="wk-board" aria-label="Días de la semana"><div className="wk-days">{dayNames.map((n,d)=>{const date=dayOf(week,d),list=byDay(d),isToday=date===now;return <div className={'wk-col'+(isToday?' today':'')} key={n}>
     <h3><b>{n} {+date.slice(8)}</b><span>{list.length}</span></h3>
     <div className={'wk-lane'+(over==='d'+d?' over':'')} data-drop={'d'+d} onDragOver={e=>{if(drag.current){e.preventDefault();setOver('d'+d);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver('');}} onDrop={e=>{e.preventDefault();void place(d);}}>
      {list.map(({c,item})=>cardView(item,{id:c.id},'w'+c.id,c))}
      {adding===d?<form className="wk-add" onSubmit={e=>{e.preventDefault();void addFree(d);}}><input autoFocus value={freeTitle} maxLength={160} placeholder="Ej. Llamar a imprenta" aria-label="Título de la tarjeta" onChange={e=>setFreeTitle(e.target.value)}/><button className="primary" disabled={busy||!freeTitle.trim()}><Check size={14}/></button><button type="button" className="icon-btn" aria-label="Cancelar" onClick={()=>setAdding(null)}><X size={14}/></button></form>:!list.length&&<button type="button" className="wk-ghost" onClick={()=>{setAdding(d);setFreeTitle('');}}>+ Añadir</button>}
     </div></div>;})}</div></section>
  </div>
  <section className="wk-close" aria-label="Cierre de semana"><h2>Cierre de semana</h2><p><b>{doneN}</b> de {cards.length} {cards.length===1?'tarjeta hecha':'tarjetas hechas'}. Al cerrar, lo que no esté terminado se copia a la semana siguiente, en el mismo día.</p><label>Nota libre<textarea value={note} maxLength={2000} rows={3} placeholder="Qué salió bien, qué queda abierto…" onChange={e=>setNote(e.target.value)} onBlur={()=>saveNotes()}/></label><button className="primary" disabled={busy||!cards.some(x=>!x.item.done&&x.item.kind!=='post')} onClick={()=>mutate({action:'weekCarry',from:week,to:next},d=>d.carried?`${d.carried} ${d.carried===1?'tarjeta pasada':'tarjetas pasadas'} a la semana siguiente`:'No había nada que pasar')}>Pasar pendientes a la semana siguiente</button></section>
 </div>;
}
