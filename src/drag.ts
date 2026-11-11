// Arrastrar tarjetas: la tarjeta sigue al cursor ligeramente inclinada, como en el vídeo de referencia.
const ghost=(el:HTMLElement,r:DOMRect,css:string)=>{const g=el.cloneNode(true) as HTMLElement;g.classList.remove('dragging');g.style.cssText=`position:fixed;margin:0;width:${r.width}px;box-shadow:0 8px 20px #0003;opacity:.95;pointer-events:none;z-index:1000;${css}`;document.body.appendChild(g);return g;};
let touching=false;
// Con ratón (arrastre nativo). Devuelve false si hay un arrastre táctil en curso, que se gestiona en touchDrag.
export function startDrag(e:React.DragEvent<HTMLElement>){if(touching){e.preventDefault();return false;}const el=e.currentTarget,r=el.getBoundingClientRect(),g=ghost(el,r,'top:-1000px;left:-1000px;transform:rotate(3deg)');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','blau-card');e.dataTransfer.setDragImage(g,e.clientX-r.left,e.clientY-r.top);setTimeout(()=>g.remove(),0);return true;}
// Con el dedo (iPhone, iPad, Android): mantener pulsada la tarjeta y moverla. Los destinos llevan data-drop.
export function touchDrag(e:React.TouchEvent<HTMLElement>,h:{start:()=>void;over:(k:string)=>void;drop:(k:string)=>void;end:()=>void}){
 if(e.touches.length!==1||touching)return;
 const el=e.currentTarget,t0=e.touches[0],x0=t0.clientX,y0=t0.clientY;let x=x0,y=y0,g:HTMLElement|null=null,key='',raf=0;touching=true;
 const sx=el.closest<HTMLElement>('.calendar-scroll,.pj-board-wrap');
 const tick=()=>{if(!g)return;const m=70,v=14,w=innerWidth,hh=innerHeight;if(y<m)scrollBy(0,-v);else if(y>hh-m)scrollBy(0,v);if(sx){const b=sx.getBoundingClientRect();if(x<Math.max(b.left,0)+m)sx.scrollLeft-=v;else if(x>Math.min(b.right,w)-m)sx.scrollLeft+=v;}
  const k=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-drop]')?.dataset.drop??'';if(k!==key){key=k;h.over(k);}raf=requestAnimationFrame(tick);};
 const timer=setTimeout(()=>{const r=el.getBoundingClientRect();g=ghost(el,r,`top:${r.top}px;left:${r.left}px;transform:translate(${x-x0}px,${y-y0}px) rotate(3deg)`);navigator.vibrate?.(10);h.start();raf=requestAnimationFrame(tick);},300);
 const move=(ev:TouchEvent)=>{const t=ev.touches[0];x=t.clientX;y=t.clientY;if(!g){if(Math.hypot(x-x0,y-y0)>10)done(ev,true);return;}ev.preventDefault();g.style.transform=`translate(${x-x0}px,${y-y0}px) rotate(3deg)`;};
 const menu=(ev:Event)=>ev.preventDefault();
 function done(ev:TouchEvent,cancel=false){clearTimeout(timer);cancelAnimationFrame(raf);touching=false;el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',abort);el.removeEventListener('contextmenu',menu);if(!g)return;g.remove();g=null;if(ev.cancelable)ev.preventDefault();if(!cancel&&key)h.drop(key);else h.end();}
 const end=(ev:TouchEvent)=>done(ev),abort=(ev:TouchEvent)=>done(ev,true);
 el.addEventListener('touchmove',move,{passive:false});el.addEventListener('touchend',end);el.addEventListener('touchcancel',abort);el.addEventListener('contextmenu',menu);
}
