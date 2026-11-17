import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,CalendarDays,CheckCheck,CalendarRange,Ellipsis,LayoutGrid,NotebookPen,UserRound,Layers} from 'lucide-react';
export type Tab={name:string;label:string;icon:any;count?:number};
export function tabsFor(social:boolean,week:boolean,pending:number):Tab[]{
 if(!social)return [];
 return [{name:'Resumen',label:'Resumen',icon:LayoutDashboard},{name:'Calendario',label:'Calendario',icon:CalendarDays},{name:'Aprobaciones',label:'Aprobar',icon:CheckCheck,count:pending},...(week?[{name:'Mi semana',label:'Mi semana',icon:CalendarRange}]:[])];
}
// Nivel «Proyectos»: Inicio, las vistas del proyecto abierto y Más.
export function projectTabs(opts:{social:boolean;board:boolean;notes:boolean}):Tab[]{
 return [...(opts.social?[{name:'home',label:'Inicio',icon:LayoutDashboard}]:[]),...(opts.board?[{name:'p:board',label:'Tablero',icon:LayoutGrid},...(opts.notes?[{name:'p:notes',label:'Notas',icon:NotebookPen}]:[]),{name:'p:client',label:'Cliente',icon:UserRound}]:[{name:'p:client',label:'Proyecto',icon:Layers}])];
}
// Barra inferior flotante solo en móvil (CSS). La última pestaña, «Más», abre el menú lateral.
export default function MobileTabBar({tabs,view,more,onSelect,onMore}:{tabs:Tab[];view:string|null;more:boolean;onSelect:(name:string)=>void;onMore:()=>void}){
 const all=[...tabs,{name:'__more',label:'Más',icon:Ellipsis} as Tab],ref=useRef<HTMLElement>(null),ind=useRef<HTMLDivElement>(null);
 const found=tabs.findIndex(t=>t.name===view),current=more||found<0?all.length-1:found;
 const [drag,setDrag]=useState<number|null>(null);
 const shown=drag??current;
 useEffect(()=>{const el=ind.current;if(!el)return;el.classList.remove('go');void el.offsetWidth;el.classList.add('go');},[shown]);
 const indexAt=(x:number)=>{const r=ref.current!.getBoundingClientRect();return Math.max(0,Math.min(all.length-1,Math.floor((x-r.left)/r.width*all.length)));};
 const choose=(i:number)=>{if(i===all.length-1)onMore();else onSelect(all[i].name);};
 return <nav ref={ref} className={'tab-bar'+(drag!==null?' dragging':'')} aria-label="Navegación principal" style={{['--n' as any]:all.length}}
  onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);setDrag(indexAt(e.clientX));}}
  onPointerMove={e=>{if(drag!==null)setDrag(indexAt(e.clientX));}}
  onPointerUp={e=>{if(drag===null)return;const i=indexAt(e.clientX);setDrag(null);choose(i);}}
  onPointerCancel={()=>setDrag(null)}>
  <div ref={ind} className="tab-ind" aria-hidden="true" style={{transform:`translateX(${shown*100}%)`}}/>
  {all.map((t,i)=>{const on=i===shown;return <button key={t.name} type="button" className={'tab-item'+(on?' on':'')} aria-current={i===current&&i!==all.length-1?'page':undefined} onClick={e=>{if(e.detail===0)choose(i);}}><span className="tab-icon"><t.icon size={21}/>{!!t.count&&<span className="tab-badge">{t.count>9?'9+':t.count}</span>}</span><span>{t.label}</span></button>;})}
 </nav>;
}
