import {useEffect,useState} from 'react';
// Pantalla de carga: saludos en varios idiomas, logo Blau y cortina que sube cuando el espacio ya está cargado (Planner marca <html data-ready>).
const words=['Hello','Bonjour','Ciao','Hallo','Привет','こんにちは','Hola'];
export default function Splash(){
 const reduce=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const [i,setI]=useState(reduce?words.length:0),[ready,setReady]=useState(false),[leave,setLeave]=useState(false),[gone,setGone]=useState(false);
 useEffect(()=>{if(i>=words.length)return;const t=setTimeout(()=>setI(i+1),i===0?320:180);return()=>clearTimeout(t);},[i]);
 useEffect(()=>{const html=document.documentElement,check=()=>{if(html.dataset.ready)setReady(true);};check();const mo=new MutationObserver(check);mo.observe(html,{attributes:true,attributeFilter:['data-ready']});return()=>mo.disconnect();},[]);
 const logo=i>=words.length;
 useEffect(()=>{if(!logo||!ready)return;const t=setTimeout(()=>setLeave(true),reduce?150:650);return()=>clearTimeout(t);},[logo,ready]);
 useEffect(()=>{if(!leave)return;const t=setTimeout(()=>setGone(true),reduce?250:900);return()=>clearTimeout(t);},[leave]);
 if(gone)return null;
 return <div className={'splash'+(leave?' leave':'')} aria-hidden="true">
  {!logo&&<p key={i} className="splash-word"><i/>{words[i]}</p>}
  {logo&&<img className="splash-logo" src="/blau-logo.png" alt="" width="360" height="160"/>}
 </div>;
}
