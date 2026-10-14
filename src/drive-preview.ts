/** Only Google Drive file links are embedded; folders and other providers stay links. */
export function drivePreviewUrl(value:string):string|null {
 try {
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||url.hostname!=='drive.google.com'||url.port||url.username||url.password)return null;
  const match=url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/);
  const id=match?.[1]??(/^\/(?:open|uc)\/?$/.test(url.pathname)?url.searchParams.get('id'):null);
  if(!id||! /^[A-Za-z0-9_-]+$/.test(id))return null;
  const preview=new URL(`https://drive.google.com/file/d/${id}/preview`);
  const resourceKey=url.searchParams.get('resourcekey');
  if(resourceKey)preview.searchParams.set('resourcekey',resourceKey);
  return preview.toString();
 }catch{return null;}
}
