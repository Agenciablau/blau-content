export const bufferFormats=['Historia','Reel','Imagen','Carrusel'];
export const lockedBufferStates=['queued','preparing','sending','unknown','scheduled','draft','needs_approval','notification_sent','remote_error'];
export function madridToUtc(value:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Introduce una fecha y hora válidas.');
 const base=Date.parse(value+'Z'),matches:number[]=[];
 const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(const offset of [60,120]){const candidate=base-offset*60000;if(formatter.format(candidate).replace(' ','T')===value)matches.push(candidate);}
 if(matches.length!==1)throw Error('Esta hora coincide con el cambio de horario en Madrid. Elige otra hora para evitar ambigüedades.');
 return new Date(matches[0]).toISOString();
}
export function bufferState(post:{status:string;schedulingType?:string|null;notificationStatus?:string|null}):string{
 if(post.status==='sent'&&post.schedulingType==='notification'&&post.notificationStatus!=='markedAsPublished')return 'notification_sent';
 if(post.status==='sent')return 'sent';
 if(post.status==='error')return 'remote_error';
 return ['scheduled','draft','needs_approval','sending'].includes(post.status)?post.status:'unknown';
}
export const bufferStateLabels:Record<string,string>={queued:'Aprobada · pendiente de envío automático',preparing:'Preparando archivos',sending:'Enviando a Buffer',unknown:'Envío sin confirmar: revisar Buffer',scheduled:'Programada en Buffer',draft:'Borrador en Buffer: añade la música y prográmalo allí',needs_approval:'Pendiente de aprobación en Buffer',notification_sent:'Aviso enviado: falta publicar en Instagram',sent:'Publicada',remote_error:'Error de publicación en Buffer',error:'No se pudo enviar',cancelled:'Cancelada en Buffer'};
