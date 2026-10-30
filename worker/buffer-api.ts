import type {Env} from './types';
export class BufferRequestError extends Error{constructor(message:string,public definitive=false){super(message);}}
export async function bufferQuery(env:Env,query:string,variables:Record<string,unknown>={}){
 if(!env.BUFFER_API_KEY)throw new BufferRequestError('Configura la conexión con Buffer.',true);
 let response:Response;try{response=await fetch('https://api.buffer.com',{method:'POST',headers:{Authorization:`Bearer ${env.BUFFER_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(30000)});}catch{throw new BufferRequestError('No se ha recibido confirmación de Buffer. Revisa el envío antes de repetirlo.');}
 let body:any;try{body=await response.json();}catch{throw new BufferRequestError('Buffer no devolvió una confirmación válida.');}
 if(!response.ok||body.errors?.length)throw new BufferRequestError(response.status===401?'La clave de Buffer no es válida.':'Buffer rechazó la petición. Revisa la conexión y los permisos.',response.status===401||response.status===403||response.status===429);
 return body.data;
}
export async function bufferChannels(env:Env){
 const data=await bufferQuery(env,'query { account { organizations { id name } } }');const result:any[]=[];
 for(const org of data.account.organizations){const channels=await bufferQuery(env,'query($input:ChannelsInput!){channels(input:$input){id name displayName service isDisconnected isQueuePaused hasActiveMemberDevice}}',{input:{organizationId:org.id}});for(const c of channels.channels)if(['instagram','linkedin'].includes(c.service))result.push({...c,organizationId:org.id,organizationName:org.name});}
 return result;
}
export const remotePostFields='id status schedulingType notificationStatus dueAt';
