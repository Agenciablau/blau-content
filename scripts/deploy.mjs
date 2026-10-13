import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const id=process.env.CLOUDFLARE_D1_ID;
if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw Error('Configura CLOUDFLARE_D1_ID en las variables de compilación de Cloudflare. Crea primero la base D1 blau-content-db.');
const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
config.main=resolve(config.main);config.assets.directory=resolve(config.assets.directory);
config.d1_databases=[{binding:'DB',database_name:'blau-content-db',database_id:id,migrations_dir:resolve('migrations')}];
config.keep_vars=true;
mkdirSync('.wrangler',{recursive:true});writeFileSync('.wrangler/deploy.json',JSON.stringify(config,null,2));
const cli=resolve('node_modules/wrangler/bin/wrangler.js');
for(const args of [['d1','migrations','apply','DB','--remote','--config','.wrangler/deploy.json'],['deploy','--config','.wrangler/deploy.json']]){
 const result=spawnSync(process.execPath,[cli,...args],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
