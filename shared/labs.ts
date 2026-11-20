import {parseJson} from './projects';
export const campaignStatuses=[['draft','Borrador'],['active','En marcha'],['done','Terminada']] as const;
export type Objective={label:string;target:string};
export type Metric={name:string;value:string};
export type Moment={id:string;name:string;description:string;start:string;end:string;budget:number};
export type Option={id:string;text:string;note:string;link:string;by:'team'|'client';chosen:boolean};
export type Selection={mode:'team'|'client';ask_link:boolean;explanation:string;label:string;question:string;pick:number;allow_add:boolean;deadline:string;options:Option[];final:string[];answered_at:string};
/** Origen del material de una publicación: ya lo tiene el equipo, hay que crearlo o se saca de las marcas. */
export const materialSources=[['have','Ya lo tengo'],['create','Hay que crearlo'],['brand','Lo saco de las marcas']] as const;
const isDate=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00Z').toISOString().slice(0,10)===v;
const text=(v:unknown,max:number,msg:string,required=false)=>{if(v==null)v='';if(typeof v!=='string'||v.length>max)throw Error(msg);const t=v.trim();if(required&&!t)throw Error(msg);return t;};
const money=(v:unknown,msg:string)=>{const n=v===''||v==null?0:Number(v);if(!Number.isInteger(n)||n<0||n>10000000)throw Error(msg);return n;};
/** Enlace opcional: solo http(s); un dominio sin protocolo recibe https://. */
const link=(v:unknown)=>{if(v==null||v==='')return '';if(typeof v!=='string'||v.length>500)throw Error('El enlace admite hasta 500 caracteres.');const t=v.trim();if(!t)return '';let u:URL;try{u=new URL(/^[a-z][a-z0-9+.-]*:/i.test(t)?t:'https://'+t);}catch{throw Error('Revisa el enlace: debe ser una dirección web válida.');}if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.'))throw Error('Revisa el enlace: debe ser una dirección web válida (http o https).');return u.href;};
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
  return {id:mid,name:mn,description:text(m?.description,1000,'La explicación de un momento admite hasta 1.000 caracteres.'),start:m.start,end:m.end,budget:money(m.budget,'El presupuesto de un momento debe ser un número entero de euros.')};
 });
 return {name,concept,status,objectives,moments,budget:money(raw.budget,'El presupuesto debe ser un número entero de euros.'),spent:money(raw.spent,'El gasto debe ser un número entero de euros.'),show_numbers:raw.show_numbers?1:0};
}
/** Hay algo que elegir: elementos del equipo o, si los propone el cliente, un espacio para sus propuestas. */
export const hasElements=(s:Selection|null)=>!!s&&(s.mode==='client'||s.options.length>0);
/** Origen del material y fecha de creación (solo si hay que crearlo, y nunca después de la publicación). */
export function normalizeMaterial(rawMaterial:unknown,rawDate:unknown,postDate:string){
 const material=materialSources.some(s=>s[0]===rawMaterial)?rawMaterial as string:'';
 const d=material==='create'&&typeof rawDate==='string'?rawDate.trim():'';
 if(d&&!isDate(d))throw Error('La fecha de creación no es válida.');
 if(d&&postDate&&d>postDate.slice(0,10))throw Error('La fecha de creación no puede ser posterior a la publicación.');
 return {material,create_date:d};
}
export function readSelection(v:unknown):Selection|null{
 const s=parseJson<any>(v,null);
 if(!s||typeof s!=='object'||!Array.isArray(s.options))return null;
 return {mode:s.mode==='client'?'client':'team',ask_link:!!s.ask_link,explanation:String(s.explanation??''),label:String(s.label??''),question:String(s.question??''),pick:Number(s.pick)||1,allow_add:!!s.allow_add,deadline:String(s.deadline??''),options:(s.options as any[]).map(o=>({...o,link:typeof o?.link==='string'?o.link:''})) as Option[],final:Array.isArray(s.final)?s.final:[],answered_at:String(s.answered_at??'')};
}
/** El equipo explica la idea y, si hace falta, propone elementos a elegir (productos, temas, titulares…) con la etiqueta que quiera. Los que añadió el cliente se conservan. Devuelve null si no hay ni explicación ni elementos. */
export function normalizeSelection(raw:any,current:Selection|null,newId:()=>string):Selection|null{
 if(!raw||typeof raw!=='object')throw Error('Datos de la idea no válidos.');
 const explanation=text(raw.explanation,3000,'La explicación de la idea admite hasta 3.000 caracteres.');
 if(!Array.isArray(raw.options)||raw.options.length>12)throw Error('Añade hasta 12 elementos para elegir.');
 const mine=(current?.options??[]).filter(o=>o.by==='client'),mode=raw.mode==='client'?'client' as const:'team' as const,given=mode==='client'?[]:raw.options,elements=mode==='client'||given.length>0;
 if(!elements&&!explanation)return null;
 const label=text(raw.label,40,'El nombre de los elementos admite hasta 40 caracteres.')||'Opciones',pick=elements?Number(raw.pick):1;
 if(!Number.isInteger(pick)||pick<1||pick>6)throw Error('Elegir entre 1 y 6 elementos.');
 const deadline=raw.deadline===''||raw.deadline==null?'':isDate(raw.deadline)?raw.deadline:(()=>{throw Error('Revisa la fecha límite de respuesta.');})();
 const question=text(raw.question,200,'La pregunta admite hasta 200 caracteres.',elements);
 const old=new Map((current?.options??[]).map(o=>[o.id,o])),seen=new Set<string>();
 const team:Option[]=given.map((o:any)=>{let oid=id(o?.id);if(!oid||seen.has(oid)||old.get(oid)?.by==='client')oid=newId();seen.add(oid);return {id:oid,text:text(o?.text,120,'Cada elemento necesita un texto (máximo 120 caracteres).',true),note:text(o?.note,200,'La nota de un elemento admite hasta 200 caracteres.'),link:'',by:'team' as const,chosen:old.get(oid)?.chosen??false};});
 const all=[...team,...(elements?mine:[])];
 return {mode,ask_link:elements&&!!raw.ask_link,explanation,label,question,pick,allow_add:mode==='client'||(team.length>0&&!!raw.allow_add),deadline,options:all,final:(current?.final??[]).filter(f=>all.some(o=>o.id===f)),answered_at:elements?current?.answered_at??'':''};
}
/** Respuesta del cliente: marca sus favoritas entre las del equipo y gestiona sus propias opciones (máximo 5). */
export function applyAnswer(current:Selection,raw:any,newId:()=>string):Selection{
 if(!raw||typeof raw!=='object')throw Error('Respuesta no válida.');
 const chosen:string[]=Array.isArray(raw.chosen)?raw.chosen.filter((x:unknown)=>typeof x==='string'):[],mineRaw:any[]=Array.isArray(raw.mine)?raw.mine:[];
 if(mineRaw.length&&!current.allow_add)throw Error('En esta selección no se pueden añadir opciones.');
 if(mineRaw.length>(current.mode==='client'?12:5))throw Error(`Puedes añadir hasta ${current.mode==='client'?12:5} opciones.`);
 const team=current.options.filter(o=>o.by==='team'),old=new Map(current.options.filter(o=>o.by==='client').map(o=>[o.id,o])),seen=new Set<string>();
 if(chosen.some(c=>!team.some(o=>o.id===c)))throw Error('Alguna opción elegida ya no existe. Actualiza y vuelve a intentarlo.');
 const mine:Option[]=mineRaw.map(o=>{let oid=id(o?.id);if(!oid||!old.has(oid)||seen.has(oid))oid=newId();seen.add(oid);return {id:oid,text:text(o?.text,120,'Cada opción necesita un texto (máximo 120 caracteres).',true),note:text(o?.note,200,'La nota admite hasta 200 caracteres.'),link:current.ask_link?link(o?.link):'',by:'client' as const,chosen:o?.chosen!==false};});
 if(current.mode==='client'&&mine.length!==current.pick)throw Error(`Rellena los ${current.pick} espacios.`);
 const total=chosen.length+mine.filter(o=>o.chosen).length;
 if(!total)throw Error('Elige al menos una opción.');
 if(total>current.pick)throw Error(`Puedes elegir hasta ${current.pick} ${current.pick===1?'opción':'opciones'}.`);
 return {...current,options:[...team.map(o=>({...o,chosen:chosen.includes(o.id)})),...mine],final:[],answered_at:new Date().toISOString()};
}
