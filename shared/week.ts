export const weekKinds=['task','post','free'] as const;
export const isDay=(v:unknown):v is number=>Number.isInteger(v)&&(v as number)>=0&&(v as number)<=4;
/** Lunes (AAAA-MM-DD) de la semana de una fecha. */
export function mondayOf(d:string){const x=new Date(d.slice(0,10)+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10);}
export const isWeek=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v&&mondayOf(v)===v;
export const addWeeks=(w:string,n:number)=>{const x=new Date(w+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+7*n);return x.toISOString().slice(0,10);};
export const dayOf=(w:string,i:number)=>{const x=new Date(w+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+i);return x.toISOString().slice(0,10);};
export function normalizeFocus(v:unknown):string[]{if(!Array.isArray(v)||v.length>3)throw Error('El foco admite hasta 3 prioridades.');return v.map(x=>{if(typeof x!=='string'||x.length>160)throw Error('Cada prioridad admite hasta 160 caracteres.');return x.trim();}).filter(Boolean);}
