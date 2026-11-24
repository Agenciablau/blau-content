import {useState,type ReactNode} from 'react';
import {FlaskConical,Plus} from 'lucide-react';
/** Bloque desplegable de la ficha de creación: se separa del resto al abrirse, crece en altura y lanza un destello de color que se apaga. */
export default function LabsCollapse({title,summary,defaultOpen,children}:{title:string;summary?:string;defaultOpen?:boolean;children:ReactNode}){
 const [open,setOpen]=useState(!!defaultOpen),[flash,setFlash]=useState(0);
 return <section className={'lb-collapse'+(open?' open':'')}><button type="button" className="lb-collapse-head" aria-expanded={open} onClick={()=>{if(!open)setFlash(f=>f+1);setOpen(!open);}}><FlaskConical size={14}/><span>{title}</span>{!open&&summary&&<em>{summary}</em>}<Plus size={16} className="lb-collapse-icon" aria-hidden="true"/></button>{flash>0&&open&&<i key={flash} className="lb-collapse-glow" aria-hidden="true"/>}<div className="lb-collapse-body" inert={!open}><div><div className="lb-collapse-inner">{children}</div></div></div></section>;
}
