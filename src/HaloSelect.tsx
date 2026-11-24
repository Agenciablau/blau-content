import {Children,isValidElement,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode,type SelectHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
/**
 * Desplegable con borde degradado, relleno esmerilado, etiqueta escalonada y chevron/check.
 * Sustituye a <select> con la misma API: lee las <option> hijas y mantiene un <select> nativo oculto
 * que recibe value, required y onChange, así los formularios, la validación y `dirty` siguen igual.
 */
type Item={value:string;label:string;disabled:boolean};
const text=(n:ReactNode):string=>Children.toArray(n).map(c=>typeof c==='string'||typeof c==='number'?String(c):isValidElement(c)?text((c.props as any).children):'').join('');
function readItems(children:ReactNode):Item[]{const out:Item[]=[];const walk=(n:ReactNode)=>Children.forEach(n,c=>{if(!isValidElement(c))return;const p:any=c.props;if(c.type==='option')out.push({value:p.value!==undefined?String(p.value):text(p.children),label:text(p.children),disabled:!!p.disabled});else walk(p.children);});walk(children);return out;}
const FLASH_MS=560,setNative=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!;
export default function HaloSelect({children,className,disabled,value,defaultValue,id,style,...rest}:SelectHTMLAttributes<HTMLSelectElement>&{children?:ReactNode}){
 const items=readItems(children),native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null),uid=useId();
 const [cur,setCur]=useState(String(value??defaultValue??items[0]?.value??'')),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[burst,setBurst]=useState(0),[flash,setFlash]=useState(false),[stagger,setStagger]=useState(0),[pos,setPos]=useState<{l:number;t:number;w:number;up:boolean}|null>(null);
 useEffect(()=>{if(value!==undefined)setCur(String(value));},[value]);
 const idx=items.findIndex(i=>i.value===cur),sel=items[idx],label=sel?.label??'';
 const place=()=>{const r=trigger.current?.getBoundingClientRect();if(!r)return;const room=window.innerHeight-r.bottom,up=room<260&&r.top>room;setPos({l:r.left,t:up?r.top-6:r.bottom+6,w:r.width,up});};
 useLayoutEffect(()=>{if(!open)return;place();const h=()=>place();window.addEventListener('resize',h);window.addEventListener('scroll',h,true);const out=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!list.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',out);return()=>{window.removeEventListener('resize',h);window.removeEventListener('scroll',h,true);document.removeEventListener('pointerdown',out);};},[open]);
 useEffect(()=>{if(!flash)return;const t=setTimeout(()=>setFlash(false),FLASH_MS);return()=>clearTimeout(t);},[flash]);
 useEffect(()=>{if(open&&active>=0)list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({block:'nearest'});},[open,active]);
 const show=()=>{if(disabled)return;setActive(idx>=0?idx:items.findIndex(i=>!i.disabled));setBurst(b=>b+1);setOpen(true);};
 const pick=(i:number)=>{const it=items[i];if(!it||it.disabled)return;setOpen(false);trigger.current?.focus();if(it.value===cur)return;const el=native.current;if(el){setNative.call(el,it.value);el.dispatchEvent(new Event('change',{bubbles:true}));}if(value===undefined)setCur(it.value);setStagger(s=>s+1);setFlash(true);};
 const move=(d:number)=>{if(!items.length)return;let i=active;for(let k=0;k<items.length;k++){i=(i+d+items.length)%items.length;if(!items[i].disabled){setActive(i);return;}}};
 const key=(e:React.KeyboardEvent)=>{
  if(!open){if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();show();}return;}
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}else if(e.key==='ArrowDown'){e.preventDefault();move(1);}else if(e.key==='ArrowUp'){e.preventDefault();move(-1);}else if(e.key==='Home'){e.preventDefault();setActive(-1);move(1);}else if(e.key==='End'){e.preventDefault();setActive(items.length);move(-1);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(active);}else if(e.key==='Tab')setOpen(false);
  else if(e.key.length===1){const k=e.key.toLowerCase(),start=active+1;for(let n=0;n<items.length;n++){const i=(start+n)%items.length;if(!items[i].disabled&&items[i].label.toLowerCase().startsWith(k)){setActive(i);break;}}}
 };
 return <span className={'halo'+(open?' open':'')+(disabled?' disabled':'')+(className?' '+className:'')} style={style}>
  <span className="halo-rim" aria-hidden="true"><i/><i/><i/></span>
  <button ref={trigger} type="button" id={id} className="halo-trigger" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={uid} aria-activedescendant={open&&active>=0?`${uid}-${active}`:undefined} aria-label={rest['aria-label']} aria-required={rest.required||undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onKeyDown={key}>
   <span className={'halo-value'+(sel?'':' placeholder')} key={stagger}>{stagger&&label?Array.from(label).map((ch,i)=><span key={i} style={{animationDelay:`${i*18}ms`}}>{ch}</span>):label||'Selecciona una opción'}</span>
   <span className="halo-thumb"><span className={'halo-ico'+(flash?'':' on')}><ChevronDown size={14}/></span><span className={'halo-ico check'+(flash?' on':'')}><Check size={14} strokeWidth={2.5}/></span></span>
  </button>
  <select ref={native} {...rest} disabled={disabled} value={value} defaultValue={defaultValue} className="halo-native" tabIndex={-1} aria-hidden="true">{children}</select>
  {open&&pos&&createPortal(<div ref={list} id={uid} role="listbox" className={'halo-list'+(pos.up?' up':'')} style={{left:pos.l,top:pos.t,minWidth:pos.w}} onMouseDown={e=>e.preventDefault()}>
   {items.length?items.map((it,i)=><div key={burst+'-'+i} id={`${uid}-${i}`} data-i={i} role="option" aria-selected={i===idx} aria-disabled={it.disabled||undefined} className={'halo-item'+(i===active?' active':'')+(it.disabled?' off':'')} style={{animationDelay:`${Math.min(i,9)*55}ms`}} onMouseEnter={()=>!it.disabled&&setActive(i)} onClick={()=>pick(i)}><span>{it.label}</span>{i===idx&&<Check size={14} strokeWidth={2.5}/>}</div>):<p className="halo-empty">Sin opciones.</p>}
  </div>,document.body)}
 </span>;
}
