export const socialNetworks=[['instagram','Instagram'],['facebook','Facebook'],['linkedin','LinkedIn'],['tiktok','TikTok'],['youtube','YouTube'],['x','X'],['google_business','Google Business']] as const;
export type ClientProfile={website:string;contact_name:string;contact_email:string;phone:string;address:string;socials:Record<string,string>};
export function normalizeClientProfile(value:unknown):ClientProfile{
 const raw=typeof value==='string'?JSON.parse(value||'{}'):(value??{});
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Los datos del cliente no son válidos.');
 const field=(key:string,max:number)=>{const v=raw[key]??'';if(typeof v!=='string'||v.length>max)throw Error('Revisa el tamaño de los datos de contacto.');return v.trim();};
 const url=(v:string)=>{if(!v)return '';try{const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href;}catch{throw Error('La web y las redes sociales deben tener enlaces completos, por ejemplo https://…');}};
 const contact_email=field('contact_email',254);
 if(contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))throw Error('Introduce un correo de contacto válido.');
 if(raw.socials!==undefined&&(!raw.socials||typeof raw.socials!=='object'||Array.isArray(raw.socials)))throw Error('Las redes sociales no son válidas.');
 const socials:Record<string,string>={};for(const [key] of socialNetworks){const v=raw.socials?.[key]??'';if(typeof v!=='string'||v.length>2000)throw Error('Revisa el enlace de la red social.');socials[key]=url(v);}
 return {website:url(field('website',2000)),contact_name:field('contact_name',150),contact_email,phone:field('phone',80),address:field('address',500),socials};
}
export function readClientProfile(value:unknown):ClientProfile{
 let raw:any={};try{raw=typeof value==='string'?JSON.parse(value||'{}'):(value??{});}catch{}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))raw={};
 const field=(key:string)=>typeof raw[key]==='string'?raw[key]:'';
 const socials:Record<string,string>={};for(const [key] of socialNetworks)socials[key]=typeof raw.socials?.[key]==='string'?raw.socials[key]:'';
 return {website:field('website'),contact_name:field('contact_name'),contact_email:field('contact_email'),phone:field('phone'),address:field('address'),socials};
}
