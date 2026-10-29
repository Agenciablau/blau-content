import {useState} from 'react';
import {Layers,Play,ImageOff,Mail,Globe,Music2} from 'lucide-react';
import {drivePreviewUrl} from './drive-preview';
import {materialLinks} from '../shared/material-links';
export function driveThumbnailUrl(value:string){const preview=drivePreviewUrl(value);if(!preview)return null;const u=new URL(preview),id=u.pathname.split('/')[3],t=new URL('https://drive.google.com/thumbnail');t.searchParams.set('id',id);t.searchParams.set('sz','w800');const key=u.searchParams.get('resourcekey');if(key)t.searchParams.set('resourcekey',key);return t.toString();}
export default function ReviewThumb({post,onOpen}:{post:any;onOpen:()=>void}){
 const links=materialLinks(post.asset??''),src=links.map(driveThumbnailUrl).find(Boolean),[failed,setFailed]=useState(false),video=['Reel','Vídeo','Historia'].includes(post.format);
 return <button type="button" className={'review-thumb'+(src&&!failed?' has-image':'')} onClick={onOpen} aria-label={`Ver ${post.title}`}>{src&&!failed?<><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>{post.format==='Carrusel'&&links.length>1&&<span className="thumb-badge"><Layers size={13}/>{links.length}</span>}{video&&<span className="thumb-play"><Play size={18}/></span>}</>:<span className="thumb-empty"><ImageOff size={20}/>{links.length?'Vista previa no disponible':'Sin material todavía'}</span>}</button>;
}
const glyph=(children:any)=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
export function ChannelIcon({channel}:{channel:string}){
 if(channel==='Instagram')return glyph(<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></>);
 if(channel==='LinkedIn')return glyph(<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v6M8 7.5v.01M12 16v-6M12 13a2.5 2.5 0 0 1 5 0v3"/></>);
 if(channel==='Facebook')return glyph(<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 8h-1.5A2.5 2.5 0 0 0 11 10.5V21M8.5 13h6"/></>);
 if(channel==='TikTok')return <Music2 size={13} aria-hidden="true"/>;
 return channel==='Email'?<Mail size={13} aria-hidden="true"/>:<Globe size={13} aria-hidden="true"/>;
}
