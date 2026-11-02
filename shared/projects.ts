import {materialLinks} from './material-links';
export const taskColumns=[['todo','Por hacer'],['doing','En curso'],['wait','Esperando al cliente'],['review','En revisión'],['done','Hecho']] as const;
export const columnKeys:string[]=taskColumns.map(c=>c[0]);
export const projectViewers=[['web','Navegador web','Pantallas en escritorio y móvil'],['pack','Pieza física','Arte plano, mockup 3D y muestra'],['gallery','Galería de imágenes','Propuestas e imágenes'],['doc','Documento','PDF o presentación']] as const;
export const deliverableViews=['Escritorio','Móvil','Enlace','Documento','Imagen','Aplicaciones','Arte plano','Mockup 3D','Foto de muestra'];
export const fieldTypes=['Texto','Número','Fecha','Lista','Enlace'];
export const projectStatuses=[['active','En curso'],['paused','En pausa'],['done','Terminado']] as const;
export const projectOptions=[['pct','Mostrar el porcentaje de avance','Se calcula con las tareas visibles terminadas'],['hist','Mostrar el historial','Avances, aprobaciones y cambios pedidos'],['prod','Mostrar los datos del proyecto','Campos marcados como visibles: material, cantidades, dominio…'],['lock','Confirmación doble al aprobar','Para artes que van a imprenta y ya no se pueden cambiar']] as const;
export type Phase={id:string;name:string;start:string;end:string;milestone:string};
export type Field={name:string;type:string;value:string;visible:boolean};
export type ProjectOptions=Record<string,boolean>;
export type ChecklistItem={text:string;done:boolean};
type TemplateTask=[title:string,phase:number,client:boolean,visible:boolean,deliverable:boolean,views?:string[]];
export type ProjectTemplate={label:string;desc:string;viewer:string;phases:[name:string,days:number,milestone:string][];fields:[name:string,type:string,value:string,visible:boolean][];tasks:TemplateTask[];options?:Partial<ProjectOptions>};
export const projectTemplates:Record<string,ProjectTemplate>={
 web:{label:'Página web',desc:'Diseño y desarrollo de una web',viewer:'web',
  phases:[['Descubrimiento',12,'Mapa del sitio aprobado'],['Diseño',19,'Diseño aprobado'],['Contenido',9,'Textos y fotos recibidos'],['Desarrollo',30,'Versión de prueba lista'],['Lanzamiento',5,'Web publicada']],
  fields:[['Dominio','Enlace','',true],['Plataforma','Lista','WordPress',true],['Idiomas','Texto','Español',true]],
  tasks:[['Reunión inicial',0,false,true,false],['Enviar accesos al dominio y al hosting',0,true,true,false],['Mapa del sitio',0,false,true,true,['Documento']],['Maqueta de portada',1,false,true,true,['Escritorio','Móvil']],['Maqueta de páginas interiores',1,false,true,true,['Escritorio','Móvil']],['Enviar textos y fotos',2,true,true,false],['Maquetación y versión móvil',3,false,true,false],['Versión de prueba',3,false,true,true,['Enlace']],['Publicación y analítica',4,false,true,false]]},
 pack:{label:'Empaques',desc:'Diseño y fabricación de packaging',viewer:'pack',
  phases:[['Briefing',5,'Briefing cerrado'],['Diseño de artes',19,'Artes aprobados'],['Pruebas y muestras',12,'Muestra aprobada'],['Producción',33,'Fin de fabricación'],['Entrega',5,'Entrega en almacén']],
  fields:[['Material','Lista','',true],['Acabado','Texto','',true],['Cantidad por referencia','Número','',true],['Proveedor','Texto','',false],['Fecha de fabricación','Fecha','',true],['Seguimiento del envío','Enlace','',true]],
  tasks:[['Reunión de briefing',0,false,true,false],['Enviar logos y textos legales',0,true,true,false],['Artes y troqueles',1,false,true,true,['Arte plano','Mockup 3D']],['Pedir prueba de color a imprenta',2,false,false,false],['Prueba de color',2,false,true,true,['Foto de muestra']],['Aprobar la muestra física',2,true,true,false],['Control de calidad',3,false,true,false],['Confirmar dirección de entrega',4,true,true,false]],options:{lock:true}},
 brand:{label:'Branding',desc:'Identidad de marca y manual',viewer:'gallery',
  phases:[['Investigación',10,'Informe de marca'],['Concepto',14,'Concepto elegido'],['Identidad',22,'Logotipo aprobado'],['Manual de marca',26,'Manual entregado']],
  fields:[['Valores de marca','Texto','',true]],
  tasks:[['Entrevista con el cliente',0,false,true,false],['Cuestionario de marca',0,true,true,false],['Propuestas de concepto',1,false,true,true,['Imagen']],['Logotipo',2,false,true,true,['Imagen','Aplicaciones']],['Manual de marca',3,false,true,true,['Documento']]]},
 blank:{label:'En blanco',desc:'Empieza sin nada y configúralo',viewer:'gallery',phases:[['Fase 1',28,'']],fields:[],tasks:[]}};
export const defaultOptions:ProjectOptions={pct:true,hist:true,prod:true,lock:false};
const date=(v:unknown)=>{if(v===''||v==null)return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00Z').toISOString().slice(0,10)!==v)throw Error('Revisa las fechas del proyecto.');return v;};
const text=(v:unknown,max:number,msg:string,required=false)=>{if(v==null)v='';if(typeof v!=='string'||v.length>max)throw Error(msg);const t=v.trim();if(required&&!t)throw Error(msg);return t;};
export const addDays=(d:string,n:number)=>{const x=new Date(d+'T12:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
export function normalizeProject(raw:any){
 if(!raw||typeof raw!=='object')throw Error('Datos del proyecto no válidos.');
 const name=text(raw.name,120,'Escribe el nombre del proyecto (máximo 120 caracteres).',true),summary=text(raw.summary,1000,'El resumen admite hasta 1.000 caracteres.');
 const template=Object.hasOwn(projectTemplates,raw.template)?raw.template:'blank',viewer=projectViewers.some(v=>v[0]===raw.viewer)?raw.viewer:'gallery',status=projectStatuses.some(s=>s[0]===raw.status)?raw.status:'active';
 if(!Array.isArray(raw.phases)||!raw.phases.length||raw.phases.length>20)throw Error('El proyecto necesita entre 1 y 20 fases.');
 const ids=new Set<string>();
 const phases:Phase[]=raw.phases.map((p:any)=>{if(!p||typeof p!=='object')throw Error('Revisa las fases.');const id=text(p.id,60,'Revisa las fases.',true);if(ids.has(id))throw Error('Revisa las fases.');ids.add(id);const ph={id,name:text(p.name,80,'Cada fase necesita un nombre (máximo 80 caracteres).',true),start:date(p.start),end:date(p.end),milestone:text(p.milestone,120,'El hito admite hasta 120 caracteres.')};if(ph.start&&ph.end&&ph.end<ph.start)throw Error(`La fase «${ph.name}» termina antes de empezar.`);return ph;});
 if(raw.fields!=null&&!Array.isArray(raw.fields)||(raw.fields?.length??0)>30)throw Error('Puedes guardar hasta 30 campos.');
 const fields:Field[]=(raw.fields??[]).map((f:any)=>({name:text(f?.name,60,'Cada campo necesita un nombre (máximo 60 caracteres).',true),type:fieldTypes.includes(f?.type)?f.type:'Texto',value:text(f?.value,500,'El valor de un campo admite hasta 500 caracteres.'),visible:f?.visible===true}));
 const options:ProjectOptions={};for(const [k] of projectOptions)options[k]=raw.options&&typeof raw.options[k]==='boolean'?raw.options[k]:defaultOptions[k];
 if(raw.team!=null&&!Array.isArray(raw.team)||(raw.team?.length??0)>20)throw Error('Revisa el equipo del proyecto.');
 const team=[...new Set<string>((raw.team??[]).map((t:any)=>text(t,80,'Revisa el equipo del proyecto.')).filter(Boolean))];
 return {name,summary,template,viewer,status,phases,fields,options,team};
}
export function normalizeTask(raw:any,phaseIds:string[]){
 if(!raw||typeof raw!=='object')throw Error('Datos de la tarea no válidos.');
 const title=text(raw.title,160,'Escribe el título de la tarea (máximo 160 caracteres).',true),description=text(raw.description,5000,'La descripción admite hasta 5.000 caracteres.');
 const phase_id=typeof raw.phase_id==='string'&&phaseIds.includes(raw.phase_id)?raw.phase_id:(phaseIds[0]??'');
 const column_key=columnKeys.includes(raw.column_key)?raw.column_key:'todo';
 if(raw.views!=null&&!Array.isArray(raw.views)||raw.checklist!=null&&!Array.isArray(raw.checklist)||(raw.checklist?.length??0)>50)throw Error('Revisa la tarea.');
 const views=deliverableViews.filter(v=>(raw.views??[]).includes(v));
 const checklist:ChecklistItem[]=(raw.checklist??[]).map((c:any)=>({text:text(c?.text,200,'Cada punto del checklist admite hasta 200 caracteres.',true),done:c?.done===true}));
 const linkText=text(raw.links,42000,'Los enlaces son demasiado largos.'),links=materialLinks(linkText);
 if(links.length>20)throw Error('Puedes añadir hasta 20 enlaces por tarea.');
 for(const l of links){try{const u=new URL(l);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{throw Error('Los enlaces deben ser direcciones completas, por ejemplo https://…');}}
 return {title,description,phase_id,column_key,assignee:text(raw.assignee,80,'Revisa el responsable.'),due:date(raw.due),visible:raw.visible===true||raw.visible===1?1:0,client_task:raw.client_task===true||raw.client_task===1?1:0,deliverable:raw.deliverable===true||raw.deliverable===1?1:0,views:JSON.stringify(views),checklist:JSON.stringify(checklist),links:links.join('\n')};
}
export function parseJson<T>(v:unknown,fallback:T):T{try{const x=typeof v==='string'?JSON.parse(v):v;return x??fallback;}catch{return fallback;}}
export function projectPhases(p:any):Phase[]{const x=parseJson<Phase[]>(p?.phases,[]);return Array.isArray(x)?x:[];}
export function currentPhaseIndex(phases:Phase[],tasks:any[],today=new Date().toISOString().slice(0,10)){
 const open=phases.findIndex(ph=>tasks.some(t=>t.phase_id===ph.id&&t.column_key!=='done'));
 if(open>=0)return open;
 const dated=phases.findIndex(ph=>ph.end&&ph.end>=today);
 return dated>=0?dated:Math.max(0,phases.length-1);
}
export const progress=(tasks:any[])=>tasks.length?Math.round(tasks.filter(t=>t.column_key==='done').length/tasks.length*100):0;
