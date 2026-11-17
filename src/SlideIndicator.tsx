import {useEffect,useLayoutEffect,useRef} from 'react';
// Indicador deslizante para pestañas con botones de ancho distinto: misma animación que la barra inferior del móvil (.tab-ind).
export default function SlideIndicator({active}:{active:string|number}){
 const ref=useRef<HTMLSpanElement>(null),first=useRef(true);
 const place=()=>{const el=ref.current,box=el?.parentElement;if(!el||!box)return;const b=box.querySelector<HTMLElement>('button[aria-selected="true"],button.active');if(!b){el.style.opacity='0';return;}el.style.opacity='1';el.style.width=b.offsetWidth+'px';el.style.height=b.offsetHeight+'px';el.style.transform=`translate(${b.offsetLeft}px,${b.offsetTop}px)`;};
 const snap=()=>{const el=ref.current;if(!el)return;el.style.transition='none';place();void el.offsetWidth;el.style.transition='';};
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;if(first.current){first.current=false;snap();return;}place();el.classList.remove('go');void el.offsetWidth;el.classList.add('go');},[active]);
 useEffect(()=>{const box=ref.current?.parentElement;if(!box||typeof ResizeObserver==='undefined')return;let init=true;const ro=new ResizeObserver(()=>{if(init){init=false;return;}place();});ro.observe(box);return()=>ro.disconnect();},[]);
 return <span ref={ref} className="seg-ind" aria-hidden="true"/>;
}
