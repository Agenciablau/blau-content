import {useState} from 'react';
import {Layers,Play} from 'lucide-react';
import {driveThumbnailUrl,ChannelIcon} from './ReviewThumb';
import {materialLinks} from '../shared/material-links';
// Tarjeta de la agenda del día (móvil): marca con red social, hora, tipo de contenido, estado y foto.
export default function AgendaCard({post,brand,color,statusClass,onOpen}:{post:any;brand:string;color:string;statusClass:string;onOpen:()=>void}){
 const links=materialLinks(post.asset??''),src=links.map(driveThumbnailUrl).find(Boolean),[failed,setFailed]=useState(false),video=['Reel','Vídeo'].includes(post.format),net=post.channel==='Instagram'?'ig':post.channel==='LinkedIn'?'li':'ot';
 return <button type="button" className={"agenda-card "+statusClass} onClick={onOpen} aria-label={`Abrir ${post.title}`}>
  <span className="agenda-avatar"><b style={{background:color}}>{(brand||'?').slice(0,1).toUpperCase()}</b><span className={'agenda-net '+net}><ChannelIcon channel={post.channel}/></span></span>
  <span className="agenda-info"><strong className="agenda-time">{post.date?post.date.slice(11):'Sin hora'}</strong><span>{brand}</span><span>{post.channel} · {post.format}</span><span className="agenda-title">{post.title}</span><span className={'calendar-state '+statusClass}>{post.status}</span></span>
  <span className={'agenda-thumb'+(src&&!failed?' has-image':'')}>{src&&!failed?<><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>{video&&<i><Play size={12}/></i>}{post.format==='Carrusel'&&links.length>1&&<i><Layers size={12}/>{links.length}</i>}</>:<em>{links.length?'Vista previa no disponible':'Sin material todavía'}</em>}</span>
 </button>;
}
