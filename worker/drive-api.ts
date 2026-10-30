import type {Env} from './types';
import {drivePreviewUrl} from '../src/drive-preview';
const encoder=new TextEncoder();
function bytes64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');}
function from64(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(env:Env){if(!/^[a-f\d]{64}$/i.test(env.INTEGRATION_ENCRYPTION_KEY??''))throw Error('Configura la clave de cifrado de las integraciones.');return crypto.subtle.importKey('raw',Uint8Array.from(env.INTEGRATION_ENCRYPTION_KEY!.match(/../g)!,v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function seal(env:Env,value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(value));return bytes64(iv)+'.'+bytes64(new Uint8Array(encrypted));}
async function unseal(env:Env,value:string){const [iv,body]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(iv)},await key(env),from64(body)));}
export function driveConfigured(env:Env){return !!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&/^[a-f\d]{64}$/i.test(env.INTEGRATION_ENCRYPTION_KEY??''));}
export async function beginDrive(env:Env,ownerId:string,origin:string){
 if(!driveConfigured(env))throw Error('Configura las credenciales de Google Drive en Cloudflare.');
 const state=bytes64(crypto.getRandomValues(new Uint8Array(32))),verifier=bytes64(crypto.getRandomValues(new Uint8Array(32))),challenge=bytes64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
 await env.DB!.prepare('DELETE FROM integration_oauth_states WHERE expires_at<?').bind(Date.now()).run();
 await env.DB!.prepare('INSERT INTO integration_oauth_states(state,owner_id,verifier,expires_at) VALUES(?,?,?,?)').bind(state,ownerId,verifier,Date.now()+600000).run();
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:origin+'/api/integrations/drive/callback',response_type:'code',scope:'https://www.googleapis.com/auth/drive.readonly',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();return url.href;
}
export async function finishDrive(env:Env,ownerId:string,url:URL){
 const state=url.searchParams.get('state')??'';
 const saved=await env.DB!.prepare('DELETE FROM integration_oauth_states WHERE state=? AND owner_id=? AND expires_at>? RETURNING verifier').bind(state,ownerId,Date.now()).first<{verifier:string}>();
 if(!saved||url.searchParams.has('error')||!url.searchParams.get('code'))throw Error('La autorización de Drive no es válida o ha caducado. Vuelve a conectar.');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:url.origin+'/api/integrations/drive/callback',grant_type:'authorization_code',code:url.searchParams.get('code')!,code_verifier:saved.verifier})});const token:any=await r.json();
 if(!r.ok||!token.refresh_token)throw Error('Google no devolvió permiso permanente. Vuelve a autorizar Drive.');
 if(!String(token.scope??'').split(' ').includes('https://www.googleapis.com/auth/drive.readonly'))throw Error('No se concedió permiso para leer los archivos de Drive.');
 await env.DB!.prepare('INSERT INTO drive_connection(id,refresh_token,connected_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET refresh_token=excluded.refresh_token,connected_at=excluded.connected_at').bind(await seal(env,token.refresh_token),new Date().toISOString()).run();
}
export async function driveAccessToken(env:Env){const row=await env.DB!.prepare('SELECT refresh_token FROM drive_connection WHERE id=1').first<{refresh_token:string}>();if(!row)throw Error('Conecta tu cuenta de Google Drive.');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,grant_type:'refresh_token',refresh_token:await unseal(env,row.refresh_token)}),signal:AbortSignal.timeout(30000)});const token:any=await r.json();if(!r.ok||!token.access_token)throw Error('El permiso de Drive ha caducado. Vuelve a conectar tu cuenta.');return token.access_token as string;}
export function mediaOrigin(env:Env){const url=new URL(env.R2_PUBLIC_ORIGIN??'');if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Configura el dominio público del material en R2.');return url.origin;}
export async function copyDriveFile(env:Env,link:string,token:string){
 const preview=drivePreviewUrl(link);if(!preview)throw Error('Para enviar a Buffer utiliza enlaces a archivos individuales de Drive.');const parsed=new URL(preview),id=parsed.pathname.split('/')[3];const headers:Record<string,string>={Authorization:`Bearer ${token}`};const resourceKey=parsed.searchParams.get('resourcekey');if(resourceKey&&!/^[A-Za-z0-9_-]+$/.test(resourceKey))throw Error('El enlace de Drive no es válido.');if(resourceKey)headers['X-Goog-Drive-Resource-Keys']=`${id}/${resourceKey}`;
 const base=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
 const metadata=await fetch(base+'?supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,thumbnailLink,capabilities(canDownload)',{headers,signal:AbortSignal.timeout(30000)});if(!metadata.ok)throw Error('No se puede leer un archivo de Drive. Comprueba el permiso de la cuenta conectada.');const meta:any=await metadata.json();const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','video/mp4':'mp4','application/pdf':'pdf'};const size=Number(meta.size);
 if(!types[meta.mimeType]||meta.capabilities?.canDownload===false)throw Error('El material debe ser JPG, PNG, MP4 o PDF y permitir su descarga.');if(!size||size>200*1024*1024)throw Error('Cada archivo debe ocupar entre 1 byte y 200 MB.');
 const r=await fetch(base+'?alt=media&supportsAllDrives=true',{headers,signal:AbortSignal.timeout(120000)});if(!r.ok||!r.body)throw Error('No se pudo descargar el archivo de Drive.');
 const objectKey='buffer/'+crypto.randomUUID()+'.'+types[meta.mimeType],origin=mediaOrigin(env);if(!env.MEDIA)throw Error('Conecta el almacenamiento R2.');
 const stream=new FixedLengthStream(size);
 try{await Promise.all([r.body.pipeTo(stream.writable),env.MEDIA.put(objectKey,stream.readable,{httpMetadata:{contentType:meta.mimeType,cacheControl:'public, max-age=3600'},customMetadata:{sourceId:id}})]);
  const check=await fetch(base+'?supportsAllDrives=true&fields=modifiedTime',{headers,signal:AbortSignal.timeout(30000)});if(!check.ok||(await check.json() as any).modifiedTime!==meta.modifiedTime)throw Error('El archivo cambió mientras se copiaba. Revisa su versión antes de enviarlo.');
  const publicCheck=await fetch(origin+'/'+objectKey,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(15000)});if(!publicCheck.ok||!publicCheck.headers.get('Content-Type')?.startsWith(meta.mimeType))throw Error('La copia no es accesible para Buffer. Revisa el dominio público de R2 y sus permisos.');
 }catch(e){await env.MEDIA.delete(objectKey);throw e;}
 let thumb:{key:string;url:string}|undefined;
 if(meta.mimeType==='application/pdf'){const thumbKey='buffer/'+crypto.randomUUID()+'.jpg';try{
  if(!meta.thumbnailLink)throw Error('Drive todavía no ha generado la portada del PDF. Inténtalo de nuevo en unos minutos.');
  const t=await fetch(String(meta.thumbnailLink).replace(/=s\d+$/,'=s1200'),{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});const type=t.headers.get('Content-Type')??'';if(!t.ok||!type.startsWith('image/'))throw Error('No se pudo obtener la portada del PDF desde Drive.');
  await env.MEDIA.put(thumbKey,await t.arrayBuffer(),{httpMetadata:{contentType:type,cacheControl:'public, max-age=3600'},customMetadata:{sourceId:id}});thumb={key:thumbKey,url:origin+'/'+thumbKey};
 }catch(e){await env.MEDIA.delete([objectKey,thumbKey]);throw e;}}
 return {key:objectKey,url:origin+'/'+objectKey,mimeType:meta.mimeType,thumb};
}
