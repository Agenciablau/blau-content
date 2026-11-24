import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
/**
 * Selector de calendario con el aspecto Halo. Modo fecha única (value 'AAAA-MM-DD') o rango (from/to).
 * Mantiene <input type="date"> nativos ocultos para que `required`, min/max y el onChange del formulario sigan igual.
 * En rango, el color de la franja cambia con la duración: hasta 3 días naranja, hasta 7 verde y más, azul Blau.
 */
const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'],WD=['L','M','X','J','V','S','D'],WDL=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const pad=(n:number)=>String(n).padStart(2,'0'),iso=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=(s?:string)=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)?new Date(s+'T12:00'):null;
const add=(s:string,n:number)=>{const d=parse(s)!;d.setDate(d.getDate()+n);return iso(d);};
const addM=(s:string,n:number)=>{const d=parse(s)!;return iso(new Date(d.getFullYear(),d.getMonth()+n,1,12));};
const endM=(s:string)=>{const d=parse(s)!;return iso(new Date(d.getFullYear(),d.getMonth()+1,0,12));};
const span=(a:string,b:string)=>Math.round((parse(b)!.getTime()-parse(a)!.getTime())/864e5)+1;
const short=(s:string,y=false)=>{const d=parse(s);return d?`${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}${y?' '+d.getFullYear():''}`:'';};
const long=(s:string)=>{const d=parse(s);if(!d)return '';const t=`${WDL[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;return t[0].toUpperCase()+t.slice(1);};
const tone=(n:number)=>n<=3?'t-short':n<=7?'t-mid':'t-long';
const setIn=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
type P={range?:boolean;value?:string;onChange?:(v:string)=>void;from?:string;to?:string;onRange?:(from:string,to:string)=>void;min?:string;max?:string;required?:boolean;disabled?:boolean;placeholder?:string;className?:string;id?:string;'aria-label'?:string;presets?:boolean};
export default function DatePicker({range,value='',onChange,from='',to='',onRange,min,max,required,disabled,placeholder,className,id,presets=true,...rest}:P){
 const trigger=useRef<HTMLButtonElement>(null),pop=useRef<HTMLDivElement>(null),nA=useRef<HTMLInputElement>(null),nB=useRef<HTMLInputElement>(null),uid=useId();
 const today=iso(new Date()),a=range?from:value,b=range?to:'';
 const [open,setOpen]=useState(false),[phase,setPhase]=useState<'from'|'to'>('from'),[view,setView]=useState(''),[cur,setCur]=useState(''),[hover,setHover]=useState(''),[pos,setPos]=useState<{l:number;t:number;up:boolean}|null>(null),[pulse,setPulse]=useState(0);
 const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const w=Math.min(328,window.innerWidth-16),h=pop.current?.offsetHeight||(range?500:470),room=window.innerHeight-r.bottom,up=room<h+12&&r.top>room;setPos({l:Math.max(8,Math.min(r.left,window.innerWidth-w-8)),t:up?Math.max(r.top-6,h+8):r.bottom+6,up});};
 useLayoutEffect(()=>{if(!open)return;place();const raf=requestAnimationFrame(place);const h=()=>place();window.addEventListener('resize',h);window.addEventListener('scroll',h,true);const out=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!pop.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',out);return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',h);window.removeEventListener('scroll',h,true);document.removeEventListener('pointerdown',out);};},[open]);
 const ok=(d:string)=>(!min||d>=min)&&(!max||d<=max);
 const show=()=>{if(disabled)return;const start=(range&&from&&!to?from:a)||(min&&today<min?min:max&&today>max?max:today);setPhase(range&&from&&!to?'to':'from');setCur(start);setView(start.slice(0,8)+'01');setHover('');setOpen(true);};
 const emit=(x:string,y:string)=>{[[nA.current,x],[nB.current,y]].forEach(([el,v]:any)=>{if(el&&el.value!==v){setIn.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}});if(range)onRange?.(x,y);else onChange?.(x);setPulse(p=>p+1);};
 const pick=(d:string)=>{if(!ok(d))return;setCur(d);if(!range){emit(d,'');setOpen(false);trigger.current?.focus();return;}
  if(phase==='from'||!from){emit(d,to&&to>=d?to:'');setPhase('to');}else if(d<from)emit(d,'');else{emit(from,d);setPhase('from');}};
 const move=(n:number,months=false)=>{const d=months?(()=>{const t=parse(cur)!,m=new Date(t.getFullYear(),t.getMonth()+n,1,12),last=new Date(m.getFullYear(),m.getMonth()+1,0).getDate();m.setDate(Math.min(t.getDate(),last));return iso(m);})():add(cur,n);setCur(d);setView(d.slice(0,8)+'01');};
 const key=(e:React.KeyboardEvent)=>{
  if(!open){if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();show();}return;}
  const k:Record<string,()=>void>={ArrowLeft:()=>move(-1),ArrowRight:()=>move(1),ArrowUp:()=>move(-7),ArrowDown:()=>move(7),PageUp:()=>move(-1,true),PageDown:()=>move(1,true),Home:()=>move(-((parse(cur)!.getDay()+6)%7)),End:()=>move(6-(parse(cur)!.getDay()+6)%7),Enter:()=>pick(cur),' ':()=>pick(cur),Escape:()=>{e.stopPropagation();setOpen(false);}};
  if(k[e.key]){e.preventDefault();k[e.key]();}else if(e.key==='Tab')setOpen(false);
 };
 const mon=(s:string)=>{const d=parse(s)!;return iso(new Date(d.getFullYear(),d.getMonth(),d.getDate()-(d.getDay()+6)%7,12));};
 const chips:[string,string,string][]=range?[['Esta semana',mon(today),add(mon(today),6)],['Próximos 7 días',today,add(today,6)],['Este mes',today.slice(0,8)+'01',endM(today)],['Próximo mes',addM(today,1),endM(addM(today,1))]]
  :[['Hoy',today,''],['Mañana',add(today,1),''],['Próximo lunes',add(mon(today),7),''],['En 1 semana',add(today,7),'']];
 // Vista previa: mientras se elige el final, el ratón (o el cursor del teclado) dibuja la franja.
 const preview=range&&open&&phase==='to'&&from?(hover||cur):'',end=preview&&preview>=from?preview:b,n=a&&end?span(a,end):0;
 const first=view?mon(view):'',cells=first?Array.from({length:42},(_,i)=>add(first,i)):[];
 const label=range?(a?`${short(a,!b)}${b?' – '+short(b,true):' – …'}`:''):a?short(a,true)+' · '+WDL[parse(a)!.getDay()].slice(0,3):'';
 return <span className={'halo dp'+(open?' open':'')+(disabled?' disabled':'')+(className?' '+className:'')}>
  <span className="halo-rim" aria-hidden="true"><i/><i/><i/></span>
  <button ref={trigger} type="button" id={id} className="halo-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={uid} aria-label={rest['aria-label']} aria-required={required||undefined} aria-activedescendant={open&&cur?`${uid}-${cur}`:undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onKeyDown={key}>
   <span className={'halo-value'+(label?'':' placeholder')} key={pulse}>{label||placeholder||(range?'Cualquier fecha':'Elige una fecha')}</span>
   {range&&a&&b&&<span className={'dp-count '+tone(span(a,b))}>{span(a,b)}</span>}
   <span className="halo-thumb"><span className="halo-ico on"><CalendarDays size={14}/></span></span>
  </button>
  <input ref={nA} type="date" className="halo-native" tabIndex={-1} aria-hidden="true" required={required} min={min} max={range?(to||max):max} value={a} onChange={()=>{}} onInvalid={()=>trigger.current?.focus()}/>
  {range&&<input ref={nB} type="date" className="halo-native" tabIndex={-1} aria-hidden="true" required={required} min={from||min} max={max} value={b} onChange={()=>{}} onInvalid={()=>trigger.current?.focus()}/>}
  {open&&pos&&createPortal(<div ref={pop} id={uid} role="dialog" aria-label={range?'Elegir fechas':'Elegir fecha'} className={'dp-pop'+(pos.up?' up':'')+(range&&n?' '+tone(n):'')+(range?' range':'')} style={{left:pos.l,top:pos.t}} onMouseDown={e=>e.preventDefault()}>
   {range?<div className="dp-head">
    {(['from','to'] as const).map(p=><button key={p} type="button" className={'dp-tab'+(phase===p?' on':'')} onClick={()=>{setPhase(p);const d=p==='from'?from:to;if(d){setCur(d);setView(d.slice(0,8)+'01');}}}><small>{p==='from'?'Desde':'Hasta'}</small><b>{(p==='from'?a:end)?short(p==='from'?a:end,true):'—'}</b></button>)}
    <span className={'dp-badge'+(n?' on':'')} aria-live="polite">{n?<><b key={n}>{n}</b>{n===1?' día':' días'}</>:'Elige'}</span>
   </div>:<div className="dp-head single"><small>{a?'Fecha elegida':'Sin fecha'}</small><b>{a?long(a):'Elige un día'}</b></div>}
   <div className="dp-nav"><button type="button" className="dp-arrow" aria-label="Mes anterior" onClick={()=>setView(addM(view,-1))}><ChevronLeft size={16}/></button><b key={view} className="dp-month">{MONTHS[parse(view)!.getMonth()]} {parse(view)!.getFullYear()}</b><button type="button" className="dp-arrow" aria-label="Mes siguiente" onClick={()=>setView(addM(view,1))}><ChevronRight size={16}/></button></div>
   <div className="dp-grid dp-wd" aria-hidden="true">{WD.map(d=><span key={d}>{d}</span>)}</div>
   <div className="dp-grid dp-days" key={view} role="grid" onMouseLeave={()=>setHover('')}>{cells.map(d=>{const s=a&&d===a,e=!!end&&d===end&&end!==a,inn=!!a&&!!end&&d>a&&d<end,off=!ok(d);
    return <button type="button" key={d} id={`${uid}-${d}`} tabIndex={-1} disabled={off} aria-pressed={!!(s||e)} aria-label={long(d)} className={'dp-day'+(d.slice(0,7)!==view.slice(0,7)?' out':'')+(d===today?' today':'')+(s?' start':'')+(e?' end':'')+(s&&end&&end!==a?' has-end':'')+(inn?' in':'')+(d===cur?' cur':'')+(preview&&!b&&(e||inn)?' ghost':'')} onMouseEnter={()=>range&&phase==='to'&&setHover(d)} onClick={()=>pick(d)}><span>{parse(d)!.getDate()}</span></button>;})}</div>
   {presets&&<div className="dp-chips">{chips.map(([l,x,y])=>{const on=range?a===x&&b===y:a===x,dis=!ok(x)||(!!y&&!ok(y));return <button type="button" key={l} disabled={dis} className={'dp-chip'+(on?' on':'')} onClick={()=>{setCur(range?y:x);setView((range?x:x).slice(0,8)+'01');emit(x,y);if(range)setPhase('from');else{setOpen(false);trigger.current?.focus();}}}>{l}</button>;})}</div>}
   <div className="dp-foot">{!required&&(a||b)?<button type="button" className="dp-clear" onClick={()=>{emit('','');setPhase('from');}}>Borrar</button>:<span/>}<button type="button" className="dp-today" onClick={()=>{setCur(today);setView(today.slice(0,8)+'01');}}>Ir a hoy</button>{range&&<button type="button" className="dp-done" onClick={()=>{setOpen(false);trigger.current?.focus();}}>Listo</button>}</div>
  </div>,document.body)}
 </span>;
}
