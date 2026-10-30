import type {Env} from './types';
import {madridToUtc,sendsToBuffer} from '../shared/buffer-scheduling';
import {autoApproveLeadMinutes} from '../shared/client-profile';
const at=(v:string)=>String(v??'').slice(0,24);
// Approves posts still «En revisión» of clients with auto_approve when the client has not interacted with the current version and publication is within the lead time.
export async function autoApprove(env:Env,now=new Date()):Promise<string[]>{
 const db=env.DB;if(!db)return [];
 const rows=(await db.prepare("SELECT p.* FROM posts p JOIN clients c ON c.id=p.client_id WHERE p.status='En revisión' AND p.date<>'' AND c.archived=0 AND json_extract(c.profile,'$.auto_approve')=1").all<any>()).results;
 const approved:string[]=[];
 for(const post of rows){
  let due:number;try{due=Date.parse(madridToUtc(post.date));}catch{continue;}
  if(due-now.getTime()>autoApproveLeadMinutes*60000||due-now.getTime()<5*60000)continue;
  const since=at(post.updated_at)>(post.client_changed_at??'')?at(post.updated_at):post.client_changed_at;
  if(await db.prepare("SELECT 1 FROM comments WHERE post_id=? AND role='client' AND created_at>? UNION SELECT 1 FROM reviews WHERE post_id=? AND role='client' AND created_at>? LIMIT 1").bind(post.id,since,post.id,since).first())continue;
  const stamp=now.toISOString(),version=stamp+':'+crypto.randomUUID();
  const operations=[db.prepare("UPDATE posts SET status='Aprobado',updated_at=? WHERE id=? AND updated_at=? AND status='En revisión'").bind(version,post.id,post.updated_at),
   db.prepare("INSERT INTO reviews(id,post_id,actor,email,role,decision,snapshot,created_at) SELECT ?,?,'Aprobación automática','','auto','Aprobado',?,? WHERE EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)").bind(crypto.randomUUID(),post.id,JSON.stringify(post),stamp,post.id,version),
   db.prepare('UPDATE comments SET resolved=1 WHERE post_id=? AND EXISTS(SELECT 1 FROM posts WHERE id=? AND updated_at=?)').bind(post.id,post.id,version)];
  if(sendsToBuffer(post.channel,post.format))operations.push(db.prepare("INSERT INTO buffer_jobs(post_id,client_id,state,mode,snapshot,created_at,updated_at) SELECT id,client_id,'queued','automatic',?,?,? FROM posts WHERE id=? AND updated_at=? ON CONFLICT(post_id) DO UPDATE SET state='queued',mode='automatic',snapshot=excluded.snapshot,error='',updated_at=excluded.updated_at WHERE buffer_jobs.state IN ('error','cancelled') AND buffer_jobs.assets='[]'").bind(JSON.stringify({approvedVersion:version}),stamp,stamp,post.id,version));
  const results=await db.batch(operations);if(results[0].meta.changes)approved.push(post.id);
 }
 return approved;
}
