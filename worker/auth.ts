import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import type {Env,User} from './types';
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(request:Request,env:Env,keys?:JWTVerifyGetKey):Promise<User|null>{
 const issuer=env.TEAM_DOMAIN?.replace(/\/$/,'');
 if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!env.POLICY_AUD)return null;
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token)return null;
 try{
  if(!keys){if(!keySets.has(issuer))keySets.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));keys=keySets.get(issuer)!;}
  const {payload}=await jwtVerify(token,keys,{issuer,audience:env.POLICY_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email']});
  if(typeof payload.email!=='string'||typeof payload.sub!=='string'||!payload.sub||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))return null;
  const email=payload.email.trim().toLowerCase();
  return {userId:payload.sub,email,displayName:email};
 }catch{return null;}
}
