import {materialLinks} from '../shared/material-links';
import {ChannelIcon} from './ReviewThumb';
import PostThumb from './PostThumb';
// Tarjeta de la agenda del día (móvil): misma ficha que el calendario de escritorio (cabecera de estado, imagen a un tercio, red, formato y cliente).
export default function AgendaCard({post,brand,statusClass,onOpen}:{post:any;brand:string;color?:string;statusClass:string;onOpen:()=>void}){
 const noImg=post.status==='Idea'&&!materialLinks(post.asset??'').length;
 return <button type="button" className={'post-card agenda-post '+statusClass+(noImg?' no-img':'')} onClick={onOpen} aria-label={`Abrir ${post.title}`}>
  <div className="post-head"><span>{post.status==='Cambios solicitados'?'Cambios':post.status}</span><span>{post.date?post.date.slice(11):'Sin hora'}</span><b aria-hidden="true">⋮</b></div>
  <div className="post-body">{!noImg&&<PostThumb post={post}/>}<strong>{post.title}</strong><div className="post-bottom"><span className={'post-net net-'+String(post.channel).toLowerCase()}><ChannelIcon channel={post.channel}/></span><span>{post.format}</span></div><div className="post-foot"><span>{brand}</span></div></div>
 </button>;
}
