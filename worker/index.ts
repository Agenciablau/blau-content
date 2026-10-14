import {authenticate} from './auth';
import {createWorkspaceApi} from './workspace';
import type {Env} from './types';
function security(response:Response){const h=new Headers(response.headers);h.set('Cache-Control','no-store');h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','same-origin');h.set('X-Frame-Options','DENY');h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-src https://drive.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");return new Response(response.body,{status:response.status,headers:h});}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(!env.TEAM_DOMAIN||!env.POLICY_AUD||!env.ADMIN_EMAIL||!env.DB)return security(new Response('Blau Content está pendiente de configuración. Conecta D1 y configura ADMIN_EMAIL, TEAM_DOMAIN y POLICY_AUD en Cloudflare.',{status:503}));
  if(env.APP_ORIGIN&&url.origin!==env.APP_ORIGIN)return security(new Response('Utiliza la dirección oficial de Blau Content.',{status:403}));
  const user=await authenticate(request,env);
  if(!user){if(url.pathname.startsWith('/api/'))return security(Response.json({error:'Inicia sesión con tu correo para acceder.'},{status:401}));return security(new Response('<!doctype html><html lang="es"><meta charset="utf-8"><title>Blau Content</title><h1>Blau Content</h1><p>Inicia sesión mediante el acceso de Cloudflare.</p><a href="/cdn-cgi/access/login">Iniciar sesión</a></html>',{status:401,headers:{'Content-Type':'text/html; charset=utf-8'}}));}
  if(url.pathname==='/auth/logout')return Response.redirect(url.origin+'/cdn-cgi/access/logout',302);
  if(url.pathname==='/api/workspace'){
   if(request.method!=='GET'&&request.method!=='POST')return security(new Response('Método no permitido.',{status:405,headers:{Allow:'GET, POST'}}));
   if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return security(Response.json({error:'Origen o formato no permitido.'},{status:403}));
   if(request.method==='POST'&&Number(request.headers.get('Content-Length')??0)>8000000)return security(Response.json({error:'La copia es demasiado grande.'},{status:413}));
   try{const api=createWorkspaceApi(env,user);return security(request.method==='GET'?await api.GET(request):await api.POST(request));}catch{return security(Response.json({error:'No se pudo completar la operación. Comprueba que la base de datos tiene sus migraciones aplicadas.'},{status:500}));}
  }
  if(url.pathname.startsWith('/api/'))return security(new Response('No encontrado.',{status:404}));
  return security(await env.ASSETS.fetch(request));
 }
};
