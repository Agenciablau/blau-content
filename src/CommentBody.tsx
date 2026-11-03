import {useState} from 'react';
/** Texto de un comentario; quien lo escribió puede editarlo. */
export default function CommentBody({c,busy,onSave}:{c:any;busy:boolean;onSave:(body:string)=>Promise<unknown>}){
 const [text,setText]=useState<string|null>(null);
 if(text!==null)return <form className="comment-edit" onSubmit={async e=>{e.preventDefault();if(await onSave(text))setText(null);}}><textarea aria-label="Editar comentario" rows={3} value={text} maxLength={5000} onChange={e=>setText(e.target.value)} autoFocus/><div><button type="button" className="text-btn" onClick={()=>setText(null)}>Cancelar</button><button className="text-btn" disabled={busy||!text.trim()||text.trim()===c.body}>Guardar</button></div></form>;
 return <><p>{c.body}</p>{(c.edited_at||c.mine)&&<div className="comment-meta">{c.edited_at&&<small>Editado</small>}{c.mine&&<button type="button" className="text-btn" onClick={()=>setText(c.body)}>Editar</button>}</div>}</>;
}
