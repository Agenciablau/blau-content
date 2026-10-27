export const commitmentCategories=[['feed','Contenido feed'],['stories','Historias'],['email','Email marketing'],['linkedin','LinkedIn']] as const;
export type MonthlyGoals=Record<string,number|null>;
export function normalizeMonthlyGoals(value:any):MonthlyGoals{if(value!=null&&(typeof value!=='object'||Array.isArray(value)))throw Error('Revisa los compromisos mensuales.');const goals:MonthlyGoals={};for(const [key] of commitmentCategories){const v=value?.[key]??null;if(v!==null&&(!Number.isInteger(v)||v<0||v>10000))throw Error('Los compromisos deben ser cantidades enteras entre 0 y 10.000.');goals[key]=v;}return goals;}
export const socialNetworks=[['instagram','Instagram'],['facebook','Facebook'],['linkedin','LinkedIn'],['tiktok','TikTok'],['youtube','YouTube'],['x','X'],['google_business','Google Business']] as const;
export type ClientLink={label:string;url:string};
export const maxClientLinks=30;
export type ClientProfile={drive_folder_url:string;website:string;contact_name:string;contact_email:string;phone:string;address:string;socials:Record<string,string>;monthly_goals:MonthlyGoals;links:ClientLink[]};
export function normalizeDriveFolderUrl(value:unknown):string{if(value===undefined||value===null||value==='')return '';if(typeof value!=='string'||value.length>2000)throw Error('Introduce un enlace válido a una carpeta de Google Drive.');try{const u=new URL(value.trim());if(u.protocol==='https:'&&u.hostname==='drive.google.com'&&!u.username&&!u.password&&!u.port&&/^\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+\/?$/.test(u.pathname))return u.href;}catch{}throw Error('Introduce un enlace válido a una carpeta de Google Drive.');}
export function normalizeClientProfile(value:unknown):ClientProfile{
 const raw=typeof value==='string'?JSON.parse(value||'{}'):(value??{});
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Los datos del cliente no son válidos.');
 const field=(key:string,max:number)=>{const v=raw[key]??'';if(typeof v!=='string'||v.length>max)throw Error('Revisa el tamaño de los datos de contacto.');return v.trim();};
 const url=(v:string)=>{if(!v)return '';try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href;}catch{throw Error('La web y las redes sociales deben tener enlaces completos, por ejemplo https://…');}};
 const contact_email=field('contact_email',254);
 if(contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))throw Error('Introduce un correo de contacto válido.');
 if(raw.socials!==undefined&&(!raw.socials||typeof raw.socials!=='object'||Array.isArray(raw.socials)))throw Error('Las redes sociales no son válidas.');
 const socials:Record<string,string>={};for(const [key] of socialNetworks){const v=raw.socials?.[key]??'';if(typeof v!=='string'||v.length>2000)throw Error('Revisa el enlace de la red social.');socials[key]=url(v);}
 if(raw.links!==undefined&&!Array.isArray(raw.links))throw Error('Los enlaces no son válidos.');
 const links:ClientLink[]=[];for(const item of raw.links??[]){if(!item||typeof item!=='object'||(item.label!==undefined&&typeof item.label!=='string')||(item.url!==undefined&&typeof item.url!=='string')||(item.label??'').length>100||(item.url??'').length>2000)throw Error('Revisa el nombre y el enlace.');const label=(item.label??'').trim(),href=(item.url??'').trim();if(!href){if(label)throw Error('Añade el enlace de «'+label+'».');continue;}let link:string;try{link=url(href);}catch{throw Error('Los enlaces deben ser direcciones completas, por ejemplo https://…');}links.push({label:label||new URL(link).hostname,url:link});}
 if(links.length>maxClientLinks)throw Error('Puedes guardar hasta '+maxClientLinks+' enlaces por cliente.');
 return {drive_folder_url:normalizeDriveFolderUrl(raw.drive_folder_url),website:url(field('website',2000)),contact_name:field('contact_name',150),contact_email,phone:field('phone',80),address:field('address',500),socials,monthly_goals:normalizeMonthlyGoals(raw.monthly_goals),links};
}
export function readClientProfile(value:unknown):ClientProfile{
 let raw:any={};try{raw=typeof value==='string'?JSON.parse(value||'{}'):(value??{});}catch{}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))raw={};
 const field=(key:string)=>typeof raw[key]==='string'?raw[key]:'';
 const socials:Record<string,string>={};for(const [key] of socialNetworks)socials[key]=typeof raw.socials?.[key]==='string'?raw.socials[key]:'';
 return {drive_folder_url:field('drive_folder_url'),website:field('website'),contact_name:field('contact_name'),contact_email:field('contact_email'),phone:field('phone'),address:field('address'),socials,monthly_goals:Object.fromEntries(commitmentCategories.map(([key])=>[key,typeof raw.monthly_goals?.[key]==='number'?raw.monthly_goals[key]:null])),links:Array.isArray(raw.links)?raw.links.filter((l:any)=>l&&typeof l==='object').map((l:any)=>({label:typeof l.label==='string'?l.label:'',url:typeof l.url==='string'?l.url:''})):[]};
}
