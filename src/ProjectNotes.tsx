import {useState,useEffect} from 'react';
import {Plus,Pencil,Trash2,Eye,EyeOff,Copy,Lock,Check} from 'lucide-react';
type Props={data:any;project:any;busy:boolean;error:string;mutate:(body:any,msg:string)=>Promise<any>};
const when=(v:string)=>new Date(v).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Madrid'});
/** Texto con enlaces clicables. */
function Rich({text}:{text:string}){return <p className="pn-body">{text.split(/(https?:\/\/[^\s]+)/g).map((s,i)=>i%2?<a key={i} href={s} target="_blank" rel="noopener noreferrer">{s}</a>:s)}</p>;}
function Secret({id}:{id:string}){
 const [value,setValue]=useState<string|null>(null),[err,setErr]=useState(''),[copied,setCopied]=useState(false),[loading,setLoading]=useState(false);
 useEffect(()=>{if(value===null)return;const t=setTimeout(()=>setValue(null),60000);return ()=>clearTimeout(t);},[value]);
 async function show(){setLoading(true);setErr('');try{const r=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revealProjectNote',id})}),d:any=await r.json();if(!r.ok)throw Error(d.error);setValue(d.secret);}catch(e:any){setErr(e.message||'No se pudieron mostrar los datos.');}finally{setLoading(false);}}
 async function copy(){try{await navigator.clipboard.writeText(value??'');setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setErr('No se pudo copiar. Selecciona el texto y cópialo a mano.');}}
 return <div className="pn-secret"><span className="pn-slabel"><Lock size={13}/>Datos sensibles</span>{value===null?<div className="pn-mask"><span aria-hidden="true">••••••••••••</span><button type="button" className="text-btn" disabled={loading} onClick={show}><Eye size={14}/>{loading?'Descifrando…':'Mostrar'}</button></div>:<><pre>{value}</pre><div className="pn-sactions"><button type="button" className="text-btn" onClick={copy}>{copied?<><Check size={14}/>Copiado</>:<><Copy size={14}/>Copiar</>}</button><button type="button" className="text-btn" onClick={()=>setValue(null)}><EyeOff size={14}/>Ocultar</button></div></>}{err&&<p className="pe-error" role="alert">{err}</p>}</div>;
}
export default function ProjectNotes({data,project:p,busy,error,mutate}:Props){
 const notes=(data.projectNotes??[]).filter((n:any)=>n.project_id===p.id);
 const [form,setForm]=useState<any>(null),[change,setChange]=useState(false);
 const open=(n:any)=>{setForm(n?{id:n.id,updated_at:n.updated_at,title:n.title,body:n.body,secret:'',has_secret:!!n.has_secret}:{title:'',body:'',secret:''});setChange(!n?.has_secret);};
 async function save(e:React.FormEvent){e.preventDefault();const body:any={action:'projectNote',project_id:p.id,id:form.id,updated_at:form.updated_at,title:form.title,body:form.body};if(change)body.secret=form.secret;if(await mutate(body,form.id?'Nota guardada':'Nota añadida'))setForm(null);}
 async function remove(n:any){if(confirm(`¿Eliminar la nota «${n.title}»? No se puede deshacer.`))await mutate({action:'deleteProjectNote',id:n.id},'Nota eliminada');}
 return <div className="pn">
  <div className="pn-head"><div><h2>Notas del proyecto</h2><p className="pe-note">Hosting, dominio, accesos y datos importantes. Solo las ven el administrador y el equipo; nunca el cliente ni los colaboradores. Los datos sensibles se guardan cifrados y solo se muestran al pulsar «Mostrar».</p></div>{!form&&<button className="primary" onClick={()=>open(null)}><Plus size={16}/>Nueva nota</button>}</div>
  {form&&<form className="pj-box pn-form" onSubmit={save}>
   <label>Título<input value={form.title} maxLength={120} required placeholder="Hosting, Dominio, WordPress…" onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>Notas<textarea rows={4} value={form.body} maxLength={5000} placeholder={'Proveedor, URL del panel, contactos, instrucciones…\nhttps://panel.proveedor.com'} onChange={e=>setForm({...form,body:e.target.value})}/></label>
   {change?<label>Datos sensibles<small className="pe-note">Usuarios, contraseñas, claves de API… Se guardan cifrados.{form.has_secret?' Déjalo vacío para borrar los que hay guardados.':''}</small><textarea rows={4} value={form.secret} maxLength={5000} autoComplete="off" spellCheck={false} placeholder={'Usuario: …\nContraseña: …'} onChange={e=>setForm({...form,secret:e.target.value})}/></label>:<div className="pn-keep"><Lock size={14}/><span>Esta nota tiene datos sensibles guardados.</span><button type="button" className="text-btn" onClick={()=>setChange(true)}>Cambiarlos</button></div>}
   {error&&<p className="pe-error" role="alert">{error}</p>}
   <div className="pj-dactions"><button type="button" className="secondary-btn" onClick={()=>setForm(null)}>Cancelar</button><button className="primary" disabled={busy||!form.title.trim()}>Guardar nota</button></div>
  </form>}
  {notes.length?<div className="pn-grid">{notes.map((n:any)=><article key={n.id} className="pj-box pn-card"><div className="pn-top"><h3>{n.title}</h3><span><button type="button" className="icon-btn" aria-label={`Editar «${n.title}»`} onClick={()=>open(n)}><Pencil size={15}/></button><button type="button" className="icon-btn" aria-label={`Eliminar «${n.title}»`} disabled={busy} onClick={()=>remove(n)}><Trash2 size={15}/></button></span></div>{n.body&&<Rich text={n.body}/>}{!!n.has_secret&&<Secret key={n.updated_at} id={n.id}/>}<small className="pn-meta">{n.author} · {when(n.updated_at.slice(0,24))}</small></article>)}</div>:!form&&<div className="pj-box pn-empty"><Lock size={20}/><p>Aún no hay notas. Guarda aquí el hosting, el dominio, los accesos y cualquier dato importante del proyecto.</p></div>}
 </div>;
}
