import type {User} from './types';
import {validateMaterial} from '../shared/material-links';
import {normalizeClientProfile} from '../shared/client-profile';
type Row=Record<string,unknown>;
const text=(x:unknown,max=15000)=>typeof x==='string'&&x.length<=max;
export async function importBackup(db:D1Database,backup:unknown,user:User){
 if(!backup||typeof backup!=='object')throw Error('Copia no válida.');
 const b=backup as Record<string,unknown>;
 const tables=['clients','posts','comments','reviews','members'] as const;
 if(b.version!==1||!tables.every(t=>Array.isArray(b[t])))throw Error('Formato de copia no válido.');
 const rows=Object.fromEntries(tables.map(t=>[t,b[t]])) as Record<typeof tables[number],Row[]>;
 if(tables.reduce((n,t)=>n+rows[t].length,0)>4000)throw Error('La copia supera 4.000 registros. Solicita una importación por lotes.');
 for(const t of tables){const n=await db.prepare(`SELECT COUNT(*) AS count FROM ${t}`).first<{count:number}>();if(n?.count)throw Error('La importación solo se permite en un espacio vacío.');}
 const clients=new Set(rows.clients.map(r=>r.id)),posts=new Set(rows.posts.map(r=>r.id));
 const valid=(condition:boolean)=>{if(!condition)throw Error('La copia contiene registros no válidos.');};
 const statements:D1PreparedStatement[]=[];
 for(const r of rows.clients){valid(text(r.id,100)&&text(r.name,100)&&!!r.name&&text(r.color,7)&&/^#[\da-f]{6}$/i.test(r.color as string)&&text(r.notes,5000));statements.push(db.prepare('INSERT INTO clients(id,name,color,notes,archived,profile) VALUES(?,?,?,?,?,?)').bind(r.id,r.name,r.color,r.notes,r.archived?1:0,JSON.stringify(normalizeClientProfile(r.profile))));}
 for(const r of rows.posts){valid(text(r.id,100)&&clients.has(r.client_id)&&text(r.title,160)&&!!r.title&&text(r.copy)&&text(r.channel,100)&&text(r.format,100)&&text(r.date,16)&&text(r.asset,42000)&&text(r.updated_at,150)&&['Idea','Borrador','En revisión','Cambios solicitados','Aprobado','Planificado','Publicado'].includes(r.status as string));valid(!validateMaterial(r.asset as string,r.format as string));statements.push(db.prepare('INSERT INTO posts(id,client_id,title,copy,channel,format,date,status,asset,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(r.id,r.client_id,r.title,r.copy,r.channel,r.format,r.date,r.status,r.asset,r.updated_at));}
 for(const r of rows.comments){valid(text(r.id,100)&&posts.has(r.post_id)&&text(r.author,254)&&text(r.body,5000)&&text(r.created_at,100));statements.push(db.prepare('INSERT INTO comments(id,post_id,author,body,created_at,role,resolved) VALUES(?,?,?,?,?,?,?)').bind(r.id,r.post_id,r.author,r.body,r.created_at,['client','team'].includes(r.role as string)?r.role:'unknown',r.resolved===0&&['client','team'].includes(r.role as string)?0:1));}
 for(const r of rows.reviews){valid(text(r.id,100)&&posts.has(r.post_id)&&text(r.actor,254)&&text(r.email,254)&&text(r.role,30)&&['Aprobado','Cambios solicitados'].includes(r.decision as string)&&text(r.snapshot,100000)&&text(r.created_at,100));statements.push(db.prepare('INSERT INTO reviews(id,post_id,actor,email,role,decision,snapshot,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(r.id,r.post_id,r.actor,r.email,r.role,r.decision,r.snapshot,r.created_at));}
 for(const r of rows.members){valid(text(r.email,254)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email as string)&&['team','client'].includes(r.role as string)&&(r.role!=='client'||clients.has(r.client_id)));if((r.email as string).toLowerCase()===user.email)continue;statements.push(db.prepare('INSERT INTO members(email,role,client_id) VALUES(?,?,?)').bind((r.email as string).toLowerCase(),r.role,r.role==='client'?r.client_id:null));}
 if(statements.length)await db.batch(statements);
}
