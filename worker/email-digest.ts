import type {Env} from './types';
const hours=[10,22];
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const at=(v:string)=>String(v??'').slice(0,24);
const clip=(s:string,n=280)=>s.length>n?s.slice(0,n-1)+'…':s;
export function madridSlot(now:Date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));return {hour:Number(p.hour),slot:`${p.year}-${p.month}-${p.day} ${p.hour}:00`};}
type Item={post:string;text:string};type Section={title:string;items:Item[]};type Group={client:string;sections:Section[]};
export function teamDigest(clients:any[],posts:any[],comments:any[],reviews:any[],from:string,to:string):Group[]{
 const inWin=(t:string)=>t>from&&t<=to,post=new Map(posts.map(p=>[p.id,p]));
 return clients.map(c=>{const mine=(x:any)=>post.get(x.post_id)?.client_id===c.id&&x.created_at>(post.get(x.post_id)?.client_changed_at??'');
  const rv=reviews.filter(r=>r.role==='client'&&inWin(r.created_at)&&mine(r)),stamps=new Set(rv.map(r=>r.post_id+r.created_at));
  const co=comments.filter(m=>m.role==='client'&&inWin(m.created_at)&&mine(m));
  const note=(r:any)=>co.find(m=>m.post_id===r.post_id&&m.created_at===r.created_at)?.body;
  const sections:Section[]=[
   {title:'Aprobadas',items:rv.filter(r=>r.decision==='Aprobado').map(r=>({post:post.get(r.post_id).title,text:`Aprobada por ${r.actor}`}))},
   {title:'Cambios solicitados',items:rv.filter(r=>r.decision==='Cambios solicitados').map(r=>({post:post.get(r.post_id).title,text:`${r.actor}: ${clip(note(r)??'')}`}))},
   {title:'Comentarios nuevos',items:co.filter(m=>!stamps.has(m.post_id+m.created_at)).map(m=>({post:post.get(m.post_id).title,text:`${m.author}: ${clip(m.body)}`}))}].filter(s=>s.items.length);
  return {client:c.name,sections};}).filter(g=>g.sections.length);
}
export function clientDigest(client:any,posts:any[],comments:any[],reviews:any[],from:string,to:string):Group[]{
 const inWin=(t:string)=>t>from&&t<=to,visible=posts.filter(p=>p.client_id===client.id&&!['Idea','Borrador'].includes(p.status)),post=new Map(visible.map(p=>[p.id,p]));
 const byClient=new Set(reviews.filter(r=>r.role==='client').map(r=>r.post_id+r.created_at));
 const changed=visible.filter(p=>inWin(at(p.updated_at))&&!byClient.has(p.id+at(p.updated_at)));
 const co=comments.filter(m=>m.role==='team'&&post.has(m.post_id)&&inWin(m.created_at)&&m.created_at>(post.get(m.post_id).client_changed_at??''));
 const sections:Section[]=[
  {title:'Pendientes de tu aprobación',items:changed.filter(p=>p.status==='En revisión').map(p=>({post:p.title,text:`${p.channel} · ${p.format}${p.date?' · '+p.date.slice(0,10).split('-').reverse().join('/'):''}`}))},
  {title:'Otras actualizaciones',items:changed.filter(p=>p.status!=='En revisión').map(p=>({post:p.title,text:`Estado: ${p.status}`}))},
  {title:'Respuestas del equipo',items:co.map(m=>({post:post.get(m.post_id).title,text:`${m.author}: ${clip(m.body)}`}))}].filter(s=>s.items.length);
 return sections.length?[{client:client.name,sections}]:[];
}
export function renderDigest(groups:Group[],intro:string,link:string){
 const count=groups.reduce((n,g)=>n+g.sections.reduce((m,s)=>m+s.items.length,0),0);
 const html=`<!doctype html><html lang="es"><body style="margin:0;background:#f5f8fa;font-family:Arial,Helvetica,sans-serif;color:#0f1d2e"><div style="max-width:600px;margin:0 auto;padding:28px 18px"><p style="margin:0 0 4px;font-size:12px;letter-spacing:1.4px;color:#5b6b7b;font-weight:700">BLAU CONTENT</p><h1 style="margin:0 0 8px;font-size:22px">Resumen de actividad</h1><p style="margin:0 0 22px;color:#3d4c5c;font-size:14px;line-height:1.5">${esc(intro)}</p>${groups.map(g=>`<div style="background:#fff;border:1px solid #e3e9ee;border-radius:12px;padding:18px 20px;margin-bottom:14px"><h2 style="margin:0 0 10px;font-size:17px;color:#003680">${esc(g.client)}</h2>${g.sections.map(s=>`<p style="margin:14px 0 6px;font-size:12px;font-weight:700;letter-spacing:.6px;color:#5b6b7b;text-transform:uppercase">${esc(s.title)} · ${s.items.length}</p>${s.items.map(i=>`<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><b>${esc(i.post)}</b><br><span style="color:#3d4c5c">${esc(i.text)}</span></p>`).join('')}`).join('')}</div>`).join('')}${link?`<p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#13dbfb;color:#0f1d2e;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Abrir Blau Content</a></p>`:''}<p style="font-size:12px;color:#5b6b7b">Recibes este correo porque tienes acceso a Blau Content. Se envía a las 10:00 y a las 22:00 solo si hay novedades.</p></div></body></html>`;
 const text=`Resumen de actividad · Blau Content\n${intro}\n\n`+groups.map(g=>`${g.client}\n`+g.sections.map(s=>`  ${s.title} (${s.items.length})\n`+s.items.map(i=>`  - ${i.post}: ${i.text}`).join('\n')).join('\n')).join('\n\n')+(link?`\n\n${link}`:'');
 return {html,text,count};
}
async function send(env:Env,to:string,subject:string,body:{html:string;text:string}){
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:'Blau Content',email:env.EMAIL_FROM},to:[{email:to}],subject,htmlContent:body.html,textContent:body.text})});
 if(!r.ok)throw new Error(`Brevo ${r.status}`);
}
export async function sendDigests(env:Env,now=new Date()):Promise<void>{
 const db=env.DB;if(!db||!env.BREVO_API_KEY||!env.EMAIL_FROM)return;
 const {hour,slot}=madridSlot(now);if(!hours.includes(hour))return;
 const w=await db.prepare('SELECT email FROM workspace WHERE id=1').first<any>();if(!w)return;
 const last=await db.prepare('SELECT window_to FROM email_digests ORDER BY window_to DESC LIMIT 1').first<any>();
 const to=now.toISOString(),from=last?.window_to??new Date(now.getTime()-12*3600e3).toISOString();
 const claim=await db.prepare('INSERT INTO email_digests(slot,window_from,window_to,created_at) VALUES(?,?,?,?) ON CONFLICT(slot) DO NOTHING').bind(slot,from,to,to).run();if(!claim.meta.changes)return;
 const [clients,posts,comments,reviews,members]=await Promise.all(['SELECT id,name FROM clients WHERE archived=0 ORDER BY name','SELECT id,client_id,title,channel,format,date,status,updated_at,client_changed_at FROM posts','SELECT post_id,author,body,created_at,role FROM comments WHERE created_at>? AND created_at<=?','SELECT post_id,actor,role,decision,created_at FROM reviews','SELECT email,role,client_id FROM members'].map((q,i)=>(i===2?db.prepare(q).bind(from,to):db.prepare(q)).all<any>().then(r=>r.results)));
 const link=env.APP_ORIGIN??'',errors:string[]=[];let sent=0;
 const out=async(email:string,groups:Group[],intro:string)=>{if(!groups.length)return;const body=renderDigest(groups,intro,link);try{await send(env,email,`Blau Content · ${body.count} ${body.count===1?'novedad':'novedades'}`,body);sent++;}catch(e){errors.push(email+': '+(e instanceof Error?e.message:'error'));}};
 const team=[...new Set([w.email,...members.filter((m:any)=>m.role==='team').map((m:any)=>m.email)].map((e:string)=>e.toLowerCase()))];
 const teamGroups=teamDigest(clients,posts,comments,reviews,from,to);
 for(const email of team)await out(email,teamGroups,'Lo que han hecho tus clientes desde el último resumen.');
 for(const c of clients){const groups=clientDigest(c,posts,comments,reviews,from,to);if(groups.length)for(const m of members.filter((m:any)=>m.role==='client'&&m.client_id===c.id))await out(m.email,groups,'Novedades del equipo de Blau desde el último resumen.');}
 await db.prepare('UPDATE email_digests SET sent=?,error=? WHERE slot=?').bind(sent,errors.join('; ').slice(0,2000),slot).run();
}
