import type {Env} from './types';
export const schedule={team:[10,22],client:[10,16]};
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const at=(v:string)=>String(v??'').slice(0,24);
const clip=(s:string,n=280)=>s.length>n?s.slice(0,n-1)+'…':s;
export function madridSlot(now:Date){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(x=>[x.type,x.value]));return {hour:Number(p.hour),slot:`${p.year}-${p.month}-${p.day} ${p.hour}:00`,weekend:['Sat','Sun'].includes(p.weekday)};}
type Kind='changes'|'approved'|'pending'|'updates'|'comments'|'replies';type Item={post:string;meta:string;quote?:string;by?:string;time?:string;pill?:string};type Section={kind:Kind;title:string;items:Item[]};type Group={client:string;color:string;sections:Section[]};
const day=(d:string)=>d?d.slice(8,10)+'/'+d.slice(5,7):'';const meta=(p:any,...x:string[])=>[p.channel,p.format,day(p.date),...x].filter(Boolean).join(' · ');
const clock=(t:string)=>new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
export function teamDigest(clients:any[],posts:any[],comments:any[],reviews:any[],from:string,to:string):Group[]{
 const inWin=(t:string)=>t>from&&t<=to,post=new Map(posts.map(p=>[p.id,p]));
 return clients.map(c=>{const mine=(x:any)=>post.get(x.post_id)?.client_id===c.id&&x.created_at>(post.get(x.post_id)?.client_changed_at??'');
  const rv=reviews.filter(r=>r.role==='client'&&inWin(r.created_at)&&mine(r)),stamps=new Set(rv.map(r=>r.post_id+r.created_at));
  const co=comments.filter(m=>m.role==='client'&&inWin(m.created_at)&&mine(m));
  const note=(r:any)=>co.find(m=>m.post_id===r.post_id&&m.created_at===r.created_at)?.body;
  const sections:Section[]=[
   {kind:'changes' as Kind,title:'Cambios solicitados',items:rv.filter(r=>r.decision==='Cambios solicitados').map(r=>({post:post.get(r.post_id).title,meta:meta(post.get(r.post_id),r.actor),quote:clip(note(r)??'')}))},
   {kind:'approved' as Kind,title:'Aprobadas',items:rv.filter(r=>r.decision==='Aprobado').map(r=>({post:post.get(r.post_id).title,meta:meta(post.get(r.post_id),'por '+r.actor),pill:'✓ Aprobada'}))},
   {kind:'comments' as Kind,title:'Comentarios nuevos',items:co.filter(m=>!stamps.has(m.post_id+m.created_at)).map(m=>({post:post.get(m.post_id).title,meta:'',by:m.author,time:clock(m.created_at),quote:clip(m.body)}))}].filter(s=>s.items.length);
  return {client:c.name,color:c.color,sections};}).filter(g=>g.sections.length);
}
export function clientDigest(client:any,posts:any[],comments:any[],reviews:any[],from:string,to:string):Group[]{
 const inWin=(t:string)=>t>from&&t<=to,visible=posts.filter(p=>p.client_id===client.id&&!['Idea','Borrador'].includes(p.status)),post=new Map(visible.map(p=>[p.id,p]));
 const byClient=new Set(reviews.filter(r=>r.role==='client').map(r=>r.post_id+r.created_at));
 const changed=visible.filter(p=>inWin(at(p.updated_at))&&!byClient.has(p.id+at(p.updated_at)));
 const co=comments.filter(m=>m.role==='team'&&post.has(m.post_id)&&inWin(m.created_at)&&m.created_at>(post.get(m.post_id).client_changed_at??''));
 const sections:Section[]=[
  {kind:'pending' as Kind,title:'Pendientes de tu aprobación',items:changed.filter(p=>p.status==='En revisión').map(p=>({post:p.title,meta:meta(p),pill:'Por aprobar'}))},
  {kind:'replies' as Kind,title:'Respuestas del equipo',items:co.map(m=>({post:post.get(m.post_id).title,meta:'',by:m.author,time:clock(m.created_at),quote:clip(m.body)}))},
  {kind:'updates' as Kind,title:'Otras actualizaciones',items:changed.filter(p=>p.status!=='En revisión').map(p=>({post:p.title,meta:meta(p),pill:p.status}))}].filter(s=>s.items.length);
 return sections.length?[{client:client.name,color:client.color,sections}]:[];
}
const tone:Record<Kind,{label:string;color:string;pill?:[string,string];short:string}>={changes:{label:'#a3330a',color:'#f26b3a',short:'Cambios pedidos'},approved:{label:'#0e7a55',color:'',pill:['#e3f7ee','#0e7a55'],short:'Aprobadas'},pending:{label:'#7a5100',color:'',pill:['#fff3d1','#7a5100'],short:'Para revisar'},updates:{label:'#3d4c5c',color:'',pill:['#eef3f6','#3d4c5c'],short:'Actualizadas'},comments:{label:'#003680',color:'#0e8a5f',short:'Comentarios'},replies:{label:'#003680',color:'#003680',short:'Respuestas del equipo'}};
export function renderDigest(groups:Group[],audience:'team'|'client',hour:number,link:string){
 const count=groups.reduce((n,g)=>n+g.sections.reduce((m,s)=>m+s.items.length,0),0),totals=new Map<Kind,number>();
 for(const g of groups)for(const s of g.sections)totals.set(s.kind,(totals.get(s.kind)??0)+s.items.length);
 const order:Kind[]=['pending','changes','approved','comments','replies','updates'],sorted=order.filter(k=>totals.has(k)).map(k=>[k,totals.get(k)!] as [Kind,number]);
 const pending=totals.get('pending')??0,hh=String(hour).padStart(2,'0')+':00';
 const title=audience==='team'?(hour<12?'Esto es lo que ha pasado desde anoche':'Esto es lo que ha pasado hoy'):pending?'Tienes contenido listo para revisar':'Hay novedades en tu contenido';
 const intro=audience==='team'?'Tus clientes han estado activos. Aquí tienes lo que necesita tu atención, sin entrar en la app.':pending?`El equipo de Blau ha preparado ${pending===1?'una publicación nueva':pending+' publicaciones nuevas'} para ti. Revísalas y danos tu visto bueno.`:'El equipo de Blau ha avanzado con tu contenido. Esto es lo que ha cambiado.';
 const words:Record<Kind,[string,string]>={changes:['cambio pedido','cambios pedidos'],approved:['aprobada','aprobadas'],pending:['para revisar','para revisar'],updates:['actualizada','actualizadas'],comments:['comentario','comentarios'],replies:['respuesta del equipo','respuestas del equipo']};
 const summary=sorted.map(([k,n])=>`${n} ${words[k][n===1?0:1]}`).join(' · ');
 const cell=(w:number,first:boolean,last:boolean,[k,n]:[Kind,number])=>`<td width="${w}%" style="padding:18px ${last?32:8}px 18px ${first?32:0}px;vertical-align:top"><div style="font-size:28px;font-weight:800;color:#0f1d2e;line-height:1.1">${n}</div><div style="font-size:12px;font-weight:700;color:#0f1d2e">${esc(tone[k].short)}</div></td>`;
 const stats=sorted,w=Math.floor(100/stats.length);
 const label=(s:Section)=>`<p style="margin:26px 0 10px;font-size:11px;letter-spacing:1.6px;font-weight:800;color:${tone[s.kind].label};text-transform:uppercase">${esc(s.title)}</p>`;
 const list=(s:Section)=>{const [bg,fg]=tone[s.kind].pill!;return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e9ee;border-radius:10px;border-collapse:separate">${s.items.map((i,n)=>{const line=n<s.items.length-1?'border-bottom:1px solid #e3e9ee;':'';return `<tr><td style="padding:14px 18px;${line}"><span style="font-size:15px;font-weight:700;color:#0f1d2e">${esc(i.post)}</span><br><span style="font-size:12px;color:#5b6b7b">${esc(i.meta)}</span></td><td align="right" style="padding:14px 18px;${line}"><span style="background:${bg};color:${fg};font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap">${esc(i.pill)}</span></td></tr>`;}).join('')}</table>`;};
 const quote=(s:Section)=>s.items.map(i=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4ef;border-left:4px solid ${tone[s.kind].color};border-radius:10px;margin-bottom:10px"><tr><td style="padding:16px 18px"><div style="font-size:15px;font-weight:700;color:#0f1d2e">${esc(i.post)}</div><div style="font-size:12px;color:#7a2a08;margin:3px 0 10px">${esc(i.meta)}</div><div style="font-size:14px;line-height:1.55;color:#3d4c5c">“${esc(i.quote)}”</div></td></tr></table>`).join('');
 const bubble=(s:Section)=>s.items.map(i=>`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px"><tr><td width="42" valign="top"><div style="width:32px;height:32px;line-height:32px;border-radius:50%;background:${tone[s.kind].color};color:#fff;text-align:center;font-weight:700;font-size:13px">${esc(String(i.by).slice(0,1).toUpperCase())}</div></td><td style="background:#f6f9fb;border-radius:4px 12px 12px 12px;padding:12px 16px"><div style="font-size:12px;color:#5b6b7b;margin-bottom:4px"><b style="color:#0f1d2e">${esc(i.by)}</b> en ${esc(i.post)} · ${esc(i.time)}</div><div style="font-size:14px;line-height:1.55;color:#3d4c5c">${esc(i.quote)}</div></td></tr></table>`).join('');
 const block=(s:Section)=>label(s)+(s.kind==='changes'?quote(s):s.kind==='comments'||s.kind==='replies'?bubble(s):list(s));
 const cta=audience==='client'&&pending?'Revisar publicaciones':'Abrir Blau Content',foot=audience==='team'?'Nada sale sin revisión. Responde desde la app y tu cliente lo verá en su próximo resumen.':'Nada sale sin tu revisión. Aprueba o pide cambios en un clic desde la app.';
 const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blau Content</title></head><body style="margin:0;padding:0;background:#eef3f6;font-family:Helvetica,Arial,sans-serif;color:#0f1d2e"><div style="display:none;max-height:0;overflow:hidden">${esc(summary)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f6"><tr><td align="center" style="padding:32px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="background:#0f1d2e;border-radius:18px 18px 0 0;padding:30px 32px 34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-family:Impact,'Arial Black',Helvetica,sans-serif;font-size:40px;line-height:1;font-weight:900;letter-spacing:-1px;color:#13dbfb">BLAU.</td><td align="right" style="font-size:11px;letter-spacing:2px;color:#8fa3b8;font-weight:700">RESUMEN · ${hh}</td></tr></table><h1 style="margin:30px 0 10px;font-size:32px;line-height:1.12;letter-spacing:-1px;color:#ffffff;font-weight:800">${esc(title)}<span style="color:#13dbfb">.</span></h1><p style="margin:0;font-size:15px;line-height:1.6;color:#c9d5de">${esc(intro)}</p></td></tr>
<tr><td style="background:#13dbfb"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stats.map((s,n)=>cell(w,n===0,n===stats.length-1,s)).join('')}</tr></table></td></tr>
${groups.map((g,n)=>`<tr><td style="background:#ffffff;padding:${n?'8px':'30px'} 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${n?'border-top:1px solid #e3e9ee;padding-top:22px':''}"><tr><td style="font-size:20px;font-weight:800;color:#0f1d2e"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${/^#[0-9a-f]{3,8}$/i.test(g.color)?g.color:'#13dbfb'};margin-right:8px"></span>${esc(g.client)}</td><td align="right" style="font-size:12px;color:#5b6b7b">${(c=>c+' '+(c===1?'novedad':'novedades'))(g.sections.reduce((m,s)=>m+s.items.length,0))}</td></tr></table>${g.sections.map(block).join('')}</td></tr>`).join('')}
<tr><td style="background:#ffffff;padding:28px 32px 34px;border-radius:0 0 18px 18px">${link?`<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0f1d2e;border-radius:40px"><a href="${esc(link)}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${cta}&nbsp;&nbsp;<span style="color:#13dbfb">→</span></a></td></tr></table>`:''}<p style="margin:16px 0 0;font-size:13px;color:#5b6b7b;line-height:1.5">${foot}</p></td></tr>
<tr><td style="padding:28px 32px;text-align:center"><p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#0f1d2e;letter-spacing:-.4px">Contenido que se recuerda<span style="color:#13dbfb">.</span></p><p style="margin:0;font-size:12px;line-height:1.7;color:#5b6b7b">Blau · Desde Valencia, para todo el mundo<br><a href="mailto:hola@agenciablau.com" style="color:#003680">hola@agenciablau.com</a> · <a href="https://agenciablau.com" style="color:#003680">agenciablau.com</a></p><p style="margin:14px 0 0;font-size:11px;color:#8a98a6">Recibes este resumen ${audience==='team'?'a las 10:00 y a las 22:00':'a las 10:00 y a las 16:00, de lunes a viernes,'} solo cuando hay novedades.</p></td></tr>
</table></td></tr></table></body></html>`;
 const text=`${title}.\n${intro}\n\n`+groups.map(g=>`${g.client}\n`+g.sections.map(s=>`  ${s.title} (${s.items.length})\n`+s.items.map(i=>`  - ${i.post}${i.meta?' ('+i.meta+')':''}${i.by?' · '+i.by:''}${i.quote?': '+i.quote:''}`).join('\n')).join('\n')).join('\n\n')+(link?`\n\n${cta}: ${link}`:'')+'\n\nBlau · Contenido que se recuerda. · hola@agenciablau.com';
 return {html,text,count,summary};
}
async function send(env:Env,to:string,subject:string,body:{html:string;text:string}){
 const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY!,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({sender:{name:'Blau Content',email:env.EMAIL_FROM},to:[{email:to}],subject,htmlContent:body.html,textContent:body.text})});
 if(!r.ok){let m='';try{m=String(((await r.json()) as any)?.message??'').slice(0,200);}catch{}throw new Error(`Brevo ${r.status}${m?': '+m:''}`);}
}
export async function sendDigests(env:Env,now=new Date()):Promise<void>{
 const db=env.DB;if(!db||!env.BREVO_API_KEY||!env.EMAIL_FROM)return;
 const {hour,slot,weekend}=madridSlot(now),due=(['team','client'] as const).filter(a=>schedule[a].includes(hour)&&!(a==='client'&&weekend));if(!due.length)return;
 const w=await db.prepare('SELECT email,owner_name FROM workspace WHERE id=1').first<any>();if(!w)return;
 const link=env.APP_ORIGIN??'',to=now.toISOString();
 for(const audience of due){
  const key=audience+':'+slot,last=await db.prepare('SELECT window_to FROM email_digests WHERE slot LIKE ? ORDER BY window_to DESC LIMIT 1').bind(audience+':%').first<any>();
  const from=last?.window_to??new Date(now.getTime()-12*3600e3).toISOString();
  const claim=await db.prepare('INSERT INTO email_digests(slot,window_from,window_to,created_at) VALUES(?,?,?,?) ON CONFLICT(slot) DO NOTHING').bind(key,from,to,to).run();if(!claim.meta.changes)continue;
  const [clients,posts,comments,reviews,members]=await Promise.all(['SELECT id,name,color FROM clients WHERE archived=0 ORDER BY name','SELECT id,client_id,title,channel,format,date,status,updated_at,client_changed_at FROM posts','SELECT post_id,author,body,created_at,role FROM comments WHERE created_at>? AND created_at<=?','SELECT post_id,actor,role,decision,created_at FROM reviews','SELECT email,role,client_id,name FROM members'].map((q,i)=>(i===2?db.prepare(q).bind(from,to):db.prepare(q)).all<any>().then(r=>r.results)));
  const names=new Map<string,string>(members.filter((m:any)=>m.name).map((m:any)=>[m.email,m.name]));if(w.owner_name)names.set(w.email,w.owner_name);const named=(v:string)=>names.get(String(v??'').toLowerCase())||v;
  for(const m of comments)m.author=named(m.author);for(const r of reviews)r.actor=named(r.actor);
  const errors:string[]=[];let sent=0;
  const out=async(email:string,groups:Group[])=>{const body=renderDigest(groups,audience,hour,link);try{await send(env,email,`Blau · ${body.summary.charAt(0).toUpperCase()+body.summary.slice(1)}`,body);sent++;}catch(e){errors.push(email+': '+(e instanceof Error?e.message:'error'));}};
  if(audience==='team'){const groups=teamDigest(clients,posts,comments,reviews,from,to);if(groups.length)for(const email of [...new Set([w.email,...members.filter((m:any)=>m.role==='team').map((m:any)=>m.email)].map((e:string)=>e.toLowerCase()))])await out(email,groups);}
  else for(const c of clients){const groups=clientDigest(c,posts,comments,reviews,from,to);if(groups.some(g=>g.sections.some(s=>s.kind==='pending'||s.kind==='replies')))for(const m of members.filter((m:any)=>m.role==='client'&&m.client_id===c.id))await out(m.email,groups);}
  await db.prepare('UPDATE email_digests SET sent=?,error=? WHERE slot=?').bind(sent,errors.join('; ').slice(0,2000),key).run();
 }
}
export async function sendDigestTest(env:Env,email:string){
 if(!env.BREVO_API_KEY||!env.EMAIL_FROM)throw new Error('Configura BREVO_API_KEY y EMAIL_FROM en Cloudflare.');
 const now=Date.now(),t=(m:number)=>new Date(now-m*60e3).toISOString(),d=(n:number)=>new Date(now+n*864e5).toISOString().slice(0,10)+'T10:00';
 const clients=[{id:'a',name:'Cliente de ejemplo',color:'#13DBFB'}];
 const posts=[{id:'p1',client_id:'a',title:'Reel de presentación',channel:'Instagram',format:'Reel',date:d(5),status:'Cambios solicitados',updated_at:t(90)+':x',client_changed_at:''},{id:'p2',client_id:'a',title:'Carrusel de novedades',channel:'Instagram',format:'Carrusel',date:d(7),status:'Aprobado',updated_at:t(60)+':x',client_changed_at:''},{id:'p3',client_id:'a',title:'Historia del evento',channel:'Instagram',format:'Historia',date:d(3),status:'En revisión',updated_at:t(30)+':x',client_changed_at:''},{id:'p4',client_id:'a',title:'Post de equipo',channel:'LinkedIn',format:'Imagen',date:d(9),status:'En revisión',updated_at:t(30)+':x',client_changed_at:''}];
 const reviews=[{post_id:'p1',actor:'Cliente',role:'client',decision:'Cambios solicitados',created_at:t(90)},{post_id:'p2',actor:'Cliente',role:'client',decision:'Aprobado',created_at:t(60)}];
 const comments=[{post_id:'p1',author:'Cliente',body:'¿Podemos usar una foto más luminosa en la portada?',created_at:t(90),role:'client'},{post_id:'p2',author:'Cliente',body:'Me encanta el resultado, gracias.',created_at:t(50),role:'client'},{post_id:'p1',author:'Equipo Blau',body:'Hecho. Hemos cambiado la portada, échale un ojo.',created_at:t(20),role:'team'}];
 const from=t(720),to=new Date(now).toISOString(),hour=madridSlot(new Date(now)).hour<16?10:22,link=env.APP_ORIGIN??'';
 for(const [audience,groups] of [['team',teamDigest(clients,posts,comments,reviews,from,to)],['client',clientDigest(clients[0],posts,comments,reviews,from,to)]] as const){const body=renderDigest(groups,audience,hour,link);await send(env,email,`[Prueba · ${audience==='team'?'equipo':'cliente'}] Blau · ${body.summary.charAt(0).toUpperCase()+body.summary.slice(1)}`,body);}
}
