import {useState,useEffect} from 'react';
import {Plus,Pencil,Trash2,Eye,EyeOff,Copy,Lock,Check,X,UserRound} from 'lucide-react';
type Props={data:any;project:any;busy:boolean;error:string;mutate:(body:any,msg:string)=>Promise<any>};
type Row={k:string;v:string};
const at=(v:string)=>new Date(v).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
const when=(v:string)=>new Date(v).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Madrid'});
/** Los datos sensibles se guardan como líneas «Etiqueta: valor»; una línea sin etiqueta se muestra como «Dato». */
export const parseSecret=(s:string):Row[]=>s.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.match(/^([^:]{1,40}):\s*(.*)$/);return m&&!/^https?$/i.test(m[1].trim())?{k:m[1].trim(),v:m[2]}:{k:'Dato',v:l};});
export const joinSecret=(rows:Row[])=>rows.filter(r=>r.v.trim()).map(r=>`${(r.k.replace(/[:\n]/g,' ').trim()||'Dato').slice(0,40)}: ${r.v.replace(/\n/g,' ').trim()}`).join('\n');
const blank=():Row[]=>[{k:'Usuario',v:''},{k:'Contraseña',v:''}];
async function reveal(id:string){const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revealProjectNote',id})}),d:any=await r.json();if(!r.ok)throw Error(d.error||'No se pudieron mostrar los datos.');return String(d.secret??'');}
/** Texto con enlaces clicables. */
function Rich({text}:{text:string}){return <p className="pn-body">{text.split(/(https?:\/\/[^\s]+)/g).map((s,i)=>i%2?<a key={i} href={s} target="_blank" rel="noopener noreferrer">{s}</a>:s)}</p>;}
function Secret({id,off}:{id:string;off?:string}){
 const [rows,setRows]=useState<Row[]|null>(null),[err,setErr]=useState(''),[copied,setCopied]=useState(-1),[loading,setLoading]=useState(false);
 useEffect(()=>{if(rows===null)return;const t=setTimeout(()=>setRows(null),60000);return ()=>clearTimeout(t);},[rows]);
 async function show(){setLoading(true);setErr('');try{setRows(parseSecret(await reveal(id)));}catch(e:any){setErr(e.message);}finally{setLoading(false);}}
 async function copy(v:string,i:number){try{await navigator.clipboard.writeText(v);setCopied(i);setTimeout(()=>setCopied(c=>c===i?-1:c),1500);}catch{setErr('No se pudo copiar. Selecciona el texto y cópialo a mano.');}}
 return <div className="pn-secret"><div className="pn-shead"><span className="pn-slabel"><Lock size={13}/>Datos sensibles</span>{rows?<button type="button" className="text-btn" onClick={()=>setRows(null)}><EyeOff size={14}/>Ocultar</button>:<button type="button" className="text-btn" disabled={loading||!!off} title={off} onClick={show}><Eye size={14}/>{loading?'Descifrando…':'Mostrar'}</button>}</div>
  {rows?<dl className="pn-rows">{rows.map((r,i)=><div key={i}><dt>{r.k}</dt><dd><code>{r.v}</code><button type="button" className="icon-btn pn-copy" aria-label={`Copiar ${r.k}`} title={`Copiar ${r.k}`} onClick={()=>copy(r.v,i)}>{copied===i?<Check size={14}/>:<Copy size={14}/>}</button></dd></div>)}</dl>:<span className="pn-mask" aria-hidden="true">••••••••••••</span>}
  {err&&<p className="pe-error" role="alert">{err}</p>}</div>;
}
export default function ProjectNotes({data,project:p,busy,error,mutate}:Props){
 const notes=(data.projectNotes??[]).filter((n:any)=>n.project_id===p.id);
 const [form,setForm]=useState<any>(null),[rows,setRows]=useState<Row[]|null>(null),[loadErr,setLoadErr]=useState(''),[loading,setLoading]=useState(false);
 const open=(n:any)=>{setLoadErr('');setForm(n?{id:n.id,updated_at:n.updated_at,title:n.title,body:n.body,visible:!!n.visible,has_secret:!!n.has_secret}:{title:'',body:'',visible:false});setRows(n?.has_secret?null:blank());};
 async function edit(){setLoading(true);setLoadErr('');try{const r=parseSecret(await reveal(form.id));setRows(r.length?r:blank());}catch(e:any){setLoadErr(e.message);}finally{setLoading(false);}}
 const setRow=(i:number,k:keyof Row,v:string)=>setRows(rows!.map((r,j)=>j===i?{...r,[k]:v}:r));
 async function save(e:React.FormEvent){e.preventDefault();const body:any={action:'projectNote',project_id:p.id,id:form.id,updated_at:form.updated_at,title:form.title,body:form.body,visible:form.visible};if(rows)body.secret=joinSecret(rows);if(await mutate(body,form.id?'Nota guardada':'Nota añadida'))setForm(null);}
 async function remove(n:any){if(confirm(`¿Eliminar la nota «${n.title}»? No se puede deshacer.`))await mutate({action:'deleteProjectNote',id:n.id},'Nota eliminada');}
 return <div className="pn">
  <div className="pn-head"><div><h2>Notas del proyecto</h2><p className="pe-note">Hosting, dominio, accesos y datos importantes. Solo las ve el equipo, salvo las que marques como «Visible para el cliente», que aparecen en su vista del proyecto. Los colaboradores nunca las ven. Los datos sensibles se guardan cifrados y solo se muestran al pulsar «Mostrar».</p></div>{!form&&<button className="primary" onClick={()=>open(null)}><Plus size={16}/>Nueva nota</button>}</div>
  {form&&<form className="pj-box pn-form" onSubmit={save}>
   <label>Título<input value={form.title} maxLength={120} required placeholder="Hosting, Dominio, WordPress…" onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>Notas<textarea rows={3} value={form.body} maxLength={5000} placeholder={'Proveedor, URL del panel, contactos, instrucciones…\nhttps://panel.proveedor.com'} onChange={e=>setForm({...form,body:e.target.value})}/></label>
   <label className="pn-vis"><input type="checkbox" checked={form.visible} onChange={e=>setForm({...form,visible:e.target.checked})}/><span><b>Visible para el cliente</b><small>Verá el título, las notas y podrá mostrar y copiar los datos sensibles.</small></span></label>
   <fieldset className="pn-fs"><legend>Datos sensibles</legend>{rows?<><small className="pe-note">Se guardan cifrados. Cada dato tendrá su propio botón de copiar.{form.has_secret?' Deja los valores vacíos para borrarlos.':''}</small>
    {rows.map((r,i)=><div className="pn-frow" key={i}><input aria-label="Etiqueta" value={r.k} maxLength={40} placeholder="Etiqueta" onChange={e=>setRow(i,'k',e.target.value)}/><input aria-label={r.k||'Valor'} value={r.v} maxLength={1000} autoComplete="off" spellCheck={false} placeholder={/contrase|clave|pass/i.test(r.k)?'••••••••':'Valor'} onChange={e=>setRow(i,'v',e.target.value)}/><button type="button" className="icon-btn" aria-label={`Quitar ${r.k||'dato'}`} onClick={()=>setRows(rows.filter((_,j)=>j!==i))}><X size={15}/></button></div>)}
    <button type="button" className="text-btn pn-add" disabled={rows.length>=20} onClick={()=>setRows([...rows,{k:'',v:''}])}><Plus size={14}/>Añadir dato</button></>
   :<div className="pn-keep"><Lock size={14}/><span>Esta nota tiene datos sensibles guardados.</span><button type="button" className="text-btn" disabled={loading} onClick={edit}>{loading?'Descifrando…':'Editarlos'}</button></div>}
   {loadErr&&<p className="pe-error" role="alert">{loadErr}</p>}</fieldset>
   {error&&<p className="pe-error" role="alert">{error}</p>}
   <div className="pj-dactions"><button type="button" className="secondary-btn" onClick={()=>setForm(null)}>Cancelar</button><button className="primary" disabled={busy||!form.title.trim()}>Guardar nota</button></div>
  </form>}
  {notes.length?<div className="pn-grid">{notes.map((n:any)=><article key={n.id} className="pj-box pn-card"><div className="pn-top"><h3>{n.title}</h3><span><button type="button" className="icon-btn" aria-label={`Editar «${n.title}»`} onClick={()=>open(n)}><Pencil size={15}/></button><button type="button" className="icon-btn" aria-label={`Eliminar «${n.title}»`} disabled={busy} onClick={()=>remove(n)}><Trash2 size={15}/></button></span></div><span className={'pn-tag'+(n.visible?' on':'')}>{n.visible?<><UserRound size={12}/>Visible para el cliente</>:<><Lock size={12}/>Solo equipo</>}</span>{n.body&&<Rich text={n.body}/>}{!!n.has_secret&&<Secret key={n.updated_at} id={n.id}/>}{data.projectNoteViews&&!!n.has_secret&&(()=>{const vs=data.projectNoteViews.filter((v:any)=>v.note_id===n.id);return vs.length?<details className="pn-log"><summary>Datos vistos {vs.length===20?'20 o más':vs.length} {vs.length===1?'vez':'veces'} · última por {vs[0].name||vs[0].email}, {at(vs[0].created_at)}</summary><ul>{vs.map((v:any,i:number)=><li key={i}><span>{v.name||v.email}</span><small>{at(v.created_at)}</small></li>)}</ul></details>:<small className="pn-log none">Nadie ha mostrado aún estos datos.</small>;})()}<small className="pn-meta">{n.author} · {when(n.updated_at.slice(0,24))}</small></article>)}</div>:!form&&<div className="pj-box pn-empty"><Lock size={20}/><p>Aún no hay notas. Guarda aquí el hosting, el dominio, los accesos y cualquier dato importante del proyecto.</p></div>}
 </div>;
}
/** Vista del cliente: notas marcadas como visibles. En la vista previa no se descifran los datos. */
export function ClientNotes({data,project:p}:{data:any;project:any}){
 const notes=(data.projectNotes??[]).filter((n:any)=>n.project_id===p.id&&n.visible);
 if(!notes.length)return null;
 return <section className="pj-box pj-card2 pn-client"><h3>Notas del proyecto</h3>{notes.map((n:any)=><div key={n.id} className="pn-citem"><b>{n.title}</b>{n.body&&<Rich text={n.body}/>}{!!n.has_secret&&<Secret key={n.updated_at} id={n.id} off={data.preview?'En la vista previa no se muestran los datos sensibles.':undefined}/>}</div>)}</section>;
}
