import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function module(file){const bundle=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node',target:'es2022'});return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));}
const m=await module('worker/meta-api.ts');
const acc={host:'graph.facebook.com',igId:'1234',token:'tok'};
const calls=[];const fake=(responses)=>async(url,init)=>{calls.push({url,init});const r=responses.shift();return new Response(JSON.stringify(r.body),{status:r.status??200});};
assert.equal(m.metaEnabled({}),false);assert.equal(m.metaEnabled({META_PUBLISH:'1'}),true);
// Reel: contenedor, estado y publicación
let id=await m.createContainer(acc,{format:'Reel',url:'https://cdn.test/v.mp4',isVideo:true,caption:'Hola'},fake([{body:{id:'c1'}}]));assert.equal(id,'c1');
assert.equal(calls[0].url,'https://graph.facebook.com/v27.0/1234/media');assert.equal(calls[0].init.headers.Authorization,'Bearer tok');
assert.deepEqual(JSON.parse(calls[0].init.body),{video_url:'https://cdn.test/v.mp4',media_type:'REELS',caption:'Hola'});
// Historia sin texto, imagen JPEG
await m.createContainer(acc,{format:'Historia',url:'https://cdn.test/s.jpg',isVideo:false,caption:'x'},fake([{body:{id:'c2'}}]));assert.deepEqual(JSON.parse(calls[1].init.body),{image_url:'https://cdn.test/s.jpg',media_type:'STORIES'});
// Imagen que no es JPEG, URL no https, carrusel con pocos elementos
await assert.rejects(m.createContainer(acc,{format:'Imagen',url:'https://cdn.test/a.png',isVideo:false},fake([])),/JPEG/);
await assert.rejects(m.createContainer(acc,{format:'Reel',url:'http://cdn.test/v.mp4',isVideo:true},fake([])),/https/);
await assert.rejects(m.createCarousel(acc,['a'],'t',fake([])),/entre 2 y 20/);
// Carrusel: elementos con is_carousel_item y sin pie
await m.createContainer(acc,{format:'Carrusel',url:'https://cdn.test/1.jpg',isVideo:false,carouselItem:true,caption:'no'},fake([{body:{id:'i1'}}]));assert.deepEqual(JSON.parse(calls.at(-1).init.body),{image_url:'https://cdn.test/1.jpg',is_carousel_item:true});
assert.equal(await m.createCarousel(acc,['i1','i2'],'Pie',fake([{body:{id:'car'}}])),'car');assert.deepEqual(JSON.parse(calls.at(-1).init.body),{media_type:'CAROUSEL',children:'i1,i2',caption:'Pie'});
// Estado y publicación
assert.equal(await m.containerStatus(acc,'c1',fake([{body:{status_code:'FINISHED'}}])),'FINISHED');assert.ok(calls.at(-1).url.endsWith('/c1?fields=status_code'));
await assert.rejects(m.containerStatus(acc,'c1',fake([{body:{status_code:'RARO'}}])),/desconocido/);
assert.equal(await m.publishContainer(acc,'c1',fake([{body:{id:'m1'}}])),'m1');assert.deepEqual(JSON.parse(calls.at(-1).init.body),{creation_id:'c1'});
// Límite diario
assert.deepEqual(await m.publishingUsage(acc,fake([{body:{data:[{quota_usage:12}]}}])),{used:12,left:38});assert.equal((await m.publishingUsage(acc,fake([{body:{data:[{quota_usage:80}]}}]))).left,0);
await assert.rejects(m.publishingUsage(acc,fake([{body:{}}])),/límite/);
// Errores: token caducado (definitivo), 5xx e incertidumbre de red (no definitivos)
await assert.rejects(m.publishContainer(acc,'c1',fake([{status:401,body:{error:{code:190}}}])),e=>e.definitive&&/caducado/.test(e.message));
await assert.rejects(m.publishContainer(acc,'c1',fake([{status:500,body:{error:{code:2}}}])),e=>!e.definitive);
await assert.rejects(m.publishContainer(acc,'c1',fake([{status:429,body:{error:{code:4}}}])),e=>!e.definitive);
await assert.rejects(m.publishContainer(acc,'c1',async()=>{throw new Error('red');}),e=>!e.definitive&&/confirmación/.test(e.message));
await assert.rejects(m.publishContainer({...acc,token:''},'c1',fake([])),e=>e.definitive);await assert.rejects(m.publishContainer({...acc,igId:'../x'},'c1',fake([])),e=>e.definitive);
// Contenedor solo poco antes de la hora
const now=Date.parse('2030-01-01T10:00:00Z');assert.equal(m.metaShouldCreate('2030-01-01T10:10:00Z',now),true);assert.equal(m.metaShouldCreate('2030-01-01T10:20:00Z',now),false);
console.log('check-meta: ok');
