import {useLayoutEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Clock} from 'lucide-react';
/** Selector de hora con el mismo estilo que DatePicker: columnas de horas y minutos (cada 5) y atajos. Valor 'HH:MM' y <input type="time"> nativo oculto. */
const pad=(n:number)=>String(n).padStart(2,'0'),HOURS=Array.from({length:24},(_,i)=>i),STEP=5;
const setIn=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
const CHIPS:[string,string][]=[['Mañana','09:00'],['Mediodía','13:00'],['Tarde','18:00'],['Noche','21:00']];
type P={value?:string;onChange?:(v:string)=>void;required?:boolean;disabled?:boolean;placeholder?:string;className?:string;id?:string;'aria-label'?:string};
export default function TimePicker({value='',onChange,required,disabled,placeholder,className,id,...rest}:P){
 const trigger=useRef<HTMLButtonElement>(null),pop=useRef<HTMLDivElement>(null),nat=useRef<HTMLInputElement>(null),uid=useId();
 const [open,setOpen]=useState(false),[pos,setPos]=useState<{l:number;t:number;up:boolean}|null>(null),[pulse,setPulse]=useState(0);
 const m=/^(\d{2}):(\d{2})/.exec(value),h=m?+m[1]:-1,mi=m?+m[2]:-1;
 const mins=Array.from({length:60/STEP},(_,i)=>i*STEP);if(mi>=0&&!mins.includes(mi)){mins.push(mi);mins.sort((a,b)=>a-b);}
 const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const w=Math.min(280,window.innerWidth-16),ph=pop.current?.offsetHeight||380,room=window.innerHeight-r.bottom,up=room<ph+12&&r.top>room;setPos({l:Math.max(8,Math.min(r.left,window.innerWidth-w-8)),t:up?Math.max(r.top-6,ph+8):r.bottom+6,up});};
 useLayoutEffect(()=>{if(!open)return;place();const raf=requestAnimationFrame(()=>{place();pop.current?.querySelectorAll('.tp-col .on').forEach(el=>el.scrollIntoView({block:'center'}));});const hh=()=>place();window.addEventListener('resize',hh);window.addEventListener('scroll',hh,true);const out=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!pop.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',out);return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',hh);window.removeEventListener('scroll',hh,true);document.removeEventListener('pointerdown',out);};},[open]);
 const emit=(v:string)=>{const el=nat.current;if(el&&el.value!==v){setIn.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}onChange?.(v);setPulse(p=>p+1);};
 const set=(H:number,M:number)=>emit(pad(H)+':'+pad(M));
 const shift=(d:number)=>{const t=((h<0?9*60:h*60+(mi<0?0:mi))+d+1440)%1440;set(Math.floor(t/60),t%60);};
 const key=(e:React.KeyboardEvent)=>{
  if(!open){if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();setOpen(true);}return;}
  const k:Record<string,()=>void>={ArrowUp:()=>shift(-STEP),ArrowDown:()=>shift(STEP),PageUp:()=>shift(-60),PageDown:()=>shift(60),Enter:()=>setOpen(false),' ':()=>setOpen(false),Escape:()=>{e.stopPropagation();setOpen(false);}};
  if(k[e.key]){e.preventDefault();k[e.key]();}else if(e.key==='Tab')setOpen(false);
 };
 useLayoutEffect(()=>{if(open)pop.current?.querySelectorAll('.tp-col .on').forEach(el=>el.scrollIntoView({block:'nearest'}));},[value,open]);
 const part=h<6?'de madrugada':h<13?'de la mañana':h<21?'de la tarde':'de la noche';
 return <span className={'halo dp tp'+(open?' open':'')+(disabled?' disabled':'')+(className?' '+className:'')}>
  <span className="halo-rim" aria-hidden="true"><i/><i/><i/></span>
  <button ref={trigger} type="button" id={id} className="halo-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={uid} aria-label={rest['aria-label']} aria-required={required||undefined} disabled={disabled} onClick={()=>{if(!disabled)setOpen(o=>!o);}} onKeyDown={key}>
   <span className={'halo-value'+(m?'':' placeholder')} key={pulse}>{m?`${pad(h)}:${pad(mi)} h`:placeholder||'Elige una hora'}</span>
   <span className="halo-thumb"><span className="halo-ico on"><Clock size={14}/></span></span>
  </button>
  <input ref={nat} type="time" className="halo-native" tabIndex={-1} aria-hidden="true" required={required} value={value} onChange={()=>{}} onInvalid={()=>trigger.current?.focus()}/>
  {open&&pos&&createPortal(<div ref={pop} id={uid} role="dialog" aria-label="Elegir hora" className={'dp-pop tp-pop'+(pos.up?' up':'')} style={{left:pos.l,top:pos.t}} onMouseDown={e=>e.preventDefault()}>
   <div className="dp-head single tp-head"><small>{m?`Hora elegida · ${part}`:'Sin hora'}</small><b className="tp-big">{m?<><span key={'h'+h}>{pad(h)}</span><i>:</i><span key={'m'+mi}>{pad(mi)}</span></>:'--:--'}</b><small className="tp-tz">Hora de Madrid</small></div>
   <div className="tp-cols">
    <div className="tp-col" role="listbox" aria-label="Hora">{HOURS.map(x=><button type="button" key={x} role="option" aria-selected={x===h} className={x===h?'on':''} onClick={()=>set(x,mi<0?0:mi)}>{pad(x)}</button>)}</div>
    <div className="tp-col" role="listbox" aria-label="Minutos">{mins.map(x=><button type="button" key={x} role="option" aria-selected={x===mi} className={x===mi?'on':''} onClick={()=>set(h<0?9:h,x)}>{pad(x)}</button>)}</div>
   </div>
   <div className="dp-chips">{CHIPS.map(([l,v])=><button type="button" key={l} className={'dp-chip'+(value===v?' on':'')} onClick={()=>emit(v)}>{l} · {v}</button>)}</div>
   <div className="dp-foot">{!required&&value?<button type="button" className="dp-clear" onClick={()=>emit('')}>Borrar</button>:<span/>}<button type="button" className="dp-done" onClick={()=>{setOpen(false);trigger.current?.focus();}}>Listo</button></div>
  </div>,document.body)}
 </span>;
}
