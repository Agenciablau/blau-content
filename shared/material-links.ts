export const MAX_CAROUSEL_IMAGES=20;
export function materialLinks(value:string):string[]{return value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);}
export function validateMaterial(value:string,format:string):string|null{
 if(value.length>42000)return 'Los enlaces de material son demasiado largos.';
 const links=materialLinks(value);
 if(links.length>(format==='Carrusel'?MAX_CAROUSEL_IMAGES:1))return format==='Carrusel'?'El carrusel admite hasta 20 imágenes.':'Solo Carrusel admite varios enlaces.';
 for(const link of links){if(link.length>2000)return 'Un enlace supera el tamaño permitido.';try{const u=new URL(link);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return 'Utiliza enlaces válidos de https:// o http://.';}catch{return 'Introduce un enlace válido para cada imagen.';}}
 return null;
}
