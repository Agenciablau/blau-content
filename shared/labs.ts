import {parseJson} from './projects';
export const campaignStatuses=[['draft','Borrador'],['active','En marcha'],['done','Terminada']] as const;
export type Objective={label:string;target:string};
export type Metric={name:string;value:string};
export type Moment={id:string;name:string;start:string;end:string;budget:number;metrics:Metric[]};
export type Option={id:string;text:string;note:string;by:'team'|'client';chosen:boolean};
export type Selection={question:string;pick:number;allow_add:boolean;deadline:string;options:Option[];final:string[];answered_at:string};
const isDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00Z').toISOString().slice(0,10)===v;
const text=(v:unknown,max:number,msg:string,required=false)=>{if(v==null)v='';if(typeof v!=='string'||v.length>max)throw Error(msg);const t=v.trim();if(required&&!t)throw Error(msg);return t;};
const money=(v:unknown,msg:string)=>{const n=v===''||v==null?0:Number(v);if(!Number.isInteger(n)||n<0||n>10000000)throw Error(msg);return n;};
const id=(v:unknown)=>typeof v==='string'&&/^[\w-]{1,100}$/.test(v)?v:'';
export function normalizeCampaign(raw:any,newId:()=>string){
 if(!raw||typeof raw!=='object')throw Error('Datos de la campaña no válidos.');
 const name=text(raw.name,120,'Escribe el nombre de la campaña (máximo 120 caracteres).',true),concept=text(raw.concept,2000,'La descripción admite hasta 2.000 caracteres.');
 const status=campaignStatuses.some(s=>s[0]===raw.status)?raw.status as string:'draft';
 if(!Array.isArray(raw.objectives)||raw.objectives.length>8)throw Error('La campaña admite hasta 8 objetivos.');
 const objectives:Objective[]=raw.objectives.map((o:any)=>({label:text(o?.label,120,'Cada objetivo admite hasta 120 caracteres.'),target:text(o?.target,60,'La meta del objetivo admite hasta 60 caracteres.')})).filter((o:Objective)=>o.label);
 if(!Array.isArray(raw.moments)||raw.moments.length>12)throw Error('La campaña admite hasta 12 momentos.');
 const seen=new Set<string>(),moments:Moment[]=raw.moments.map((m:any)=>{
  const mn=text(m?.name,60,'Cada momento necesita un nombre (máximo 60 caracteres).',true);
  if(!isDate(m?.start)||!isDate(m?.end)||m.end<m.start)throw Error('Revisa las fechas de los momentos: el final no puede ser anterior al inicio.');
  let mid=id(m?.id);if(!mid||seen.has(mid))mid=newId();seen.add(mid);
  if(!Array.isArray(m.metrics??[])||(m.metrics??[]).length>12)throw Error('Cada momento admite hasta 12 métricas.');
  const metrics:Metric[]=(m.metrics??[]).map((x:any)=>({name:text(x?.name,60,'El nombre de la métrica admite hasta 60 caracteres.'),value:text(x?.value,60,'El valor de la métrica admite hasta 60 caracteres.')})).filter((x:Metric)=>x.name);
  return {id:mid,name:mn,start:m.start,end:m.end,budget:money(m.budget,'El presupuesto de un momento debe ser un número entero de euros.'),metrics};
 });
 return {name,concept,status,objectives,moments,budget:money(raw.budget,'El presupuesto debe ser un número entero de euros.'),spent:money(raw.spent,'El gasto debe ser un número entero de euros.'),show_numbers:raw.show_numbers?1:0};
}
export function readSelection(v:unknown):Selection|null{
 const s=parseJson<any>(v,null);
 if(!s||typeof s!=='object'||!Array.isArray(s.options))return null;
 return {question:String(s.question??''),pick:Number(s.pick)||1,allow_add:!!s.allow_add,deadline:String(s.deadline??''),options:s.options as Option[],final:Array.isArray(s.final)?s.final:[],answered_at:String(s.answered_at??'')};
}
/** El equipo define pregunta, número de elecciones y opciones propias; las que añadió el cliente se conservan. */
export function normalizeSelection(raw:any,current:Selection|null,newId:()=>string):Selection{
 if(!raw||typeof raw!=='object')throw Error('Datos de la selección no válidos.');
 const question=text(raw.question,200,'La pregunta admite hasta 200 caracteres.',true),pick=Number(raw.pick);
 if(!Number.isInteger(pick)||pick<1||pick>6)throw Error('Elegir entre 1 y 6 opciones.');
 const deadline=raw.deadline===''||raw.deadline==null?'':isDate(raw.deadline)?raw.deadline:(()=>{throw Error('Revisa la fecha límite de respuesta.');})();
 if(!Array.isArray(raw.options)||!raw.options.length||raw.options.length>12)throw Error('Añade entre 1 y 12 opciones.');
 const old=new Map((current?.options??[]).map(o=>[o.id,o])),seen=new Set<string>();
 const team:Option[]=raw.options.map((o:any)=>{let oid=id(o?.id);if(!oid||seen.has(oid)||old.get(oid)?.by==='client')oid=newId();seen.add(oid);return {id:oid,text:text(o?.text,120,'Cada opción necesita un texto (máximo 120 caracteres).',true),note:text(o?.note,200,'La nota de una opción admite hasta 200 caracteres.'),by:'team' as const,chosen:old.get(oid)?.chosen??false};});
 const mine=(current?.options??[]).filter(o=>o.by==='client');
 return {question,pick,allow_add:!!raw.allow_add,deadline,options:[...team,...mine],final:(current?.final??[]).filter(f=>[...team,...mine].some(o=>o.id===f)),answered_at:current?.answered_at??''};
}
/** Respuesta del cliente: marca sus favoritas entre las del equipo y gestiona sus propias opciones (máximo 5). */
export function applyAnswer(current:Selection,raw:any,newId:()=>string):Selection{
 if(!raw||typeof raw!=='object')throw Error('Respuesta no válida.');
 const chosen:string[]=Array.isArray(raw.chosen)?raw.chosen.filter((x:unknown)=>typeof x==='string'):[],mineRaw:any[]=Array.isArray(raw.mine)?raw.mine:[];
 if(mineRaw.length&&!current.allow_add)throw Error('En esta selección no se pueden añadir opciones.');
 if(mineRaw.length>5)throw Error('Puedes añadir hasta 5 opciones.');
 const team=current.options.filter(o=>o.by==='team'),old=new Map(current.options.filter(o=>o.by==='client').map(o=>[o.id,o])),seen=new Set<string>();
 if(chosen.some(c=>!team.some(o=>o.id===c)))throw Error('Alguna opción elegida ya no existe. Actualiza y vuelve a intentarlo.');
 const mine:Option[]=mineRaw.map(o=>{let oid=id(o?.id);if(!oid||!old.has(oid)||seen.has(oid))oid=newId();seen.add(oid);return {id:oid,text:text(o?.text,120,'Cada opción necesita un texto (máximo 120 caracteres).',true),note:text(o?.note,200,'La nota admite hasta 200 caracteres.'),by:'client' as const,chosen:o?.chosen!==false};});
 const total=chosen.length+mine.filter(o=>o.chosen).length;
 if(!total)throw Error('Elige al menos una opción.');
 if(total>current.pick)throw Error(`Puedes elegir hasta ${current.pick} ${current.pick===1?'opción':'opciones'}.`);
 return {...current,options:[...team.map(o=>({...o,chosen:chosen.includes(o.id)})),...mine],final:[],answered_at:new Date().toISOString()};
}
