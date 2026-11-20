/** Publicación directa en Instagram con la Content Publishing API de Meta. Sin conectar al cron todavía: solo el cliente de la API, con host y token como parámetros (Facebook Login for Business: graph.facebook.com; Instagram Login: graph.instagram.com). */
export class MetaRequestError extends Error{constructor(message:string,public definitive=false){super(message);}}
export interface MetaAccount{host:'graph.facebook.com'|'graph.instagram.com';igId:string;token:string;version?:string;}
export const META_VERSION='v27.0',META_DAILY_LIMIT=50,META_STATUS_MAX_MINUTES=5;
const FORMATS:Record<string,string>={Reel:'REELS',Historia:'STORIES'};
export const metaEnabled=(env:{META_PUBLISH?:string})=>env.META_PUBLISH==='1';
async function call(acc:MetaAccount,path:string,init:{method:'GET'|'POST';body?:Record<string,unknown>},f:typeof fetch=fetch){
 if(!/^\d{1,30}$/.test(acc.igId)||!acc.token)throw new MetaRequestError('Falta la conexión de Instagram de este cliente.',true);
 let res:Response;try{res=await f(`https://${acc.host}/${acc.version??META_VERSION}/${path}`,{method:init.method,headers:{Authorization:`Bearer ${acc.token}`,...(init.body?{'Content-Type':'application/json'}:{})},body:init.body?JSON.stringify(init.body):undefined,signal:AbortSignal.timeout(30000)});}catch{throw new MetaRequestError('No se ha recibido confirmación de Meta. Revisa la publicación antes de repetirla.');}
 let data:any;try{data=await res.json();}catch{throw new MetaRequestError('Meta no devolvió una respuesta válida.');}
 if(!res.ok||data?.error){const code=data?.error?.code;throw new MetaRequestError(res.status===401||code===190?'El acceso de Instagram ha caducado. Vuelve a conectar la cuenta.':'Meta rechazó la petición. Revisa el formato, los permisos y el límite diario.',res.status>=400&&res.status<500&&res.status!==429);}
 return data;
}
/** Crea el contenedor. Reel e Historia llevan vídeo; Imagen solo admite JPEG; los elementos de un carrusel se marcan con carouselItem. */
export async function createContainer(acc:MetaAccount,p:{format:string;url:string;isVideo:boolean;caption?:string;carouselItem?:boolean},f?:typeof fetch):Promise<string>{
 if(!/^https:\/\//.test(p.url))throw new MetaRequestError('El archivo debe estar en una dirección pública https.',true);
 if(!p.isVideo&&!/\.jpe?g(\?|$)/i.test(p.url))throw new MetaRequestError('Instagram solo admite imágenes JPEG.',true);
 const body:Record<string,unknown>={...(p.isVideo?{video_url:p.url}:{image_url:p.url}),...(FORMATS[p.format]?{media_type:FORMATS[p.format]}:p.isVideo&&p.carouselItem?{media_type:'VIDEO'}:{}),...(p.carouselItem?{is_carousel_item:true}:p.caption&&p.format!=='Historia'?{caption:p.caption}:{})};
 const d=await call(acc,`${acc.igId}/media`,{method:'POST',body},f);if(!d.id)throw new MetaRequestError('Meta no devolvió el identificador del contenedor.');return String(d.id);
}
export async function createCarousel(acc:MetaAccount,children:string[],caption:string,f?:typeof fetch):Promise<string>{
 if(children.length<2||children.length>20)throw new MetaRequestError('Un carrusel necesita entre 2 y 20 elementos.',true);
 const d=await call(acc,`${acc.igId}/media`,{method:'POST',body:{media_type:'CAROUSEL',children:children.join(','),caption}},f);if(!d.id)throw new MetaRequestError('Meta no devolvió el identificador del carrusel.');return String(d.id);
}
export type ContainerStatus='EXPIRED'|'ERROR'|'FINISHED'|'IN_PROGRESS'|'PUBLISHED';
export async function containerStatus(acc:MetaAccount,id:string,f?:typeof fetch):Promise<ContainerStatus>{
 const d=await call(acc,`${encodeURIComponent(id)}?fields=status_code`,{method:'GET'},f);if(!['EXPIRED','ERROR','FINISHED','IN_PROGRESS','PUBLISHED'].includes(d.status_code))throw new MetaRequestError('Meta devolvió un estado desconocido.');return d.status_code;
}
/** Publica un contenedor FINISHED. Un fallo de red tras enviar es «incierto»: no repetir sin comprobar el estado (PUBLISHED). */
export async function publishContainer(acc:MetaAccount,id:string,f?:typeof fetch):Promise<string>{
 const d=await call(acc,`${acc.igId}/media_publish`,{method:'POST',body:{creation_id:id}},f);if(!d.id)throw new MetaRequestError('Meta no devolvió el identificador de la publicación.');return String(d.id);
}
/** Publicaciones hechas por la API en las últimas 24 h frente al tope prudente (la documentación indica 100 y 50 en dos apartados). */
export async function publishingUsage(acc:MetaAccount,f?:typeof fetch):Promise<{used:number;left:number}>{
 const d=await call(acc,`${acc.igId}/content_publishing_limit?fields=quota_usage`,{method:'GET'},f),used=Number(d?.data?.[0]?.quota_usage);if(!Number.isFinite(used))throw new MetaRequestError('Meta no devolvió el uso del límite diario.');return{used,left:Math.max(0,META_DAILY_LIMIT-used)};
}
/** Los contenedores caducan a las 24 h: se crean poco antes de la hora y se publican al llegar. */
export const metaContainerLeadMs=15*60000;
export const metaShouldCreate=(dueAt:string,now=Date.now())=>Date.parse(dueAt)-now<=metaContainerLeadMs;
