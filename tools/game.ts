import {readFile,readdir,mkdir,writeFile,lstat,rm,realpath} from 'node:fs/promises';
import {join,resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
const packageRoot=fileURLToPath(new URL('../../',import.meta.url));
import {copyJson,createSession,replay,type GameRules,type Json,type Command,type Recording} from '../runtime/core/index.ts';
import {gameId,gameDirectory,readManifest,manifests} from './catalog.ts';
export {gameId,gameDirectory,readManifest,manifests} from './catalog.ts';

async function noSymlinks(path:string){
 let current=resolve(path);const paths=[];
 while(dirname(current)!==current){paths.push(current);current=dirname(current);}
 for(const part of paths.reverse())try{if((await lstat(part)).isSymbolicLink())throw Error('Symlink path rejected: '+part);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
export async function createGame(root:string,id:string,title:string,options:{reservedIds?:readonly string[]}={}){
 root=await realpath(root);gameId(id);
 if(options.reservedIds?.includes(id)||['api','assets','preview','engine-lab'].includes(id))throw Error('Reserved or archived game id');
 if(typeof title!=='string'||!title.trim()||title.length>120||/[\u0000-\u001f\u007f]/.test(title))throw Error('Invalid title');
 createRequire(join(root,'package.json')).resolve('@thedivineparadox/game-engine/runtime');
 const target=join(root,'portal/games',id);await noSymlinks(target);await mkdir(dirname(target),{recursive:true});
 await mkdir(target); // Exclusive creation. Never adopt or overwrite an existing directory.
 try{
  const source=join(packageRoot,'templates/mobile-game');
  for(const file of await readdir(source)){
   if(!file.endsWith('.tpl'))continue;
   const tokens:Record<string,string>={__ID_JSON__:JSON.stringify(id),__TITLE_JSON__:JSON.stringify(title),__ID_TEXT__:id,__TITLE_TEXT__:title};
   const content=(await readFile(join(source,file),'utf8')).replace(/__ID_JSON__|__TITLE_JSON__|__ID_TEXT__|__TITLE_TEXT__/g,token=>tokens[token]);
   await writeFile(join(target,file.slice(0,-4)),content,{flag:'wx'});
  }
 }catch(error){await rm(target,{recursive:true,force:true});throw error;}
 return {id,status:'draft',path:target};
}
export async function loadRules(root:string,id:string):Promise<GameRules<Json,Json>>{
 const directory=await gameDirectory(root,id),file=join(directory,'rules.ts');await noSymlinks(file);
 return (await import(pathToFileURL(file).href)).rules;
}
export async function writePrivateOutput(root:string,path:string,value:unknown){
 if(!isAbsolute(path))throw Error('Output must be an absolute private path');
 const base=await realpath(dirname(path)),project=await realpath(root),target=join(base,resolve(path).split(sep).at(-1)!);
 const fromProject=relative(project,target);if(!fromProject.startsWith('..'+sep)&&fromProject!=='..'&&!isAbsolute(fromProject))throw Error('Evidence must stay outside source');
 await writeFile(target,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
}
export async function runScenario(root:string,id:string,source:string,output:string,replayMode=false){
 const text=await readFile(source,'utf8');if(text.length>1_000_000)throw Error('Scenario too large');const value=copyJson(JSON.parse(text));
 const rules=await loadRules(root,id);
 let game;
 if(replayMode)game=replay(rules,(value.recording??value) as Recording<Json>);
 else{
  if(!value||Object.keys(value).sort().join(',')!=='commands,seed'||!Array.isArray(value.commands)||value.commands.length>10000)throw Error('Expected {seed,commands}');
  game=createSession(rules,value.seed);for(const command of value.commands)game.command(command as Command<Json>);
 }
 const snapshot=game.inspect(),recording=game.exportRecording(),digest=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 await writePrivateOutput(root,output,{snapshot,recording,sha256:digest});return {gameId:id,phase:snapshot.phase,sha256:digest,output};
}
/** Isolated local preview: no platform server, account API, cookies or personal DB. */
export async function startPreview(root:string,id:string,options:{port?:number;instance?:string}={}){
 root=await realpath(root);await readManifest(root,id);const instance=gameId(options.instance??'default');
 const scope=createHash('sha256').update(root).digest('hex').slice(0,12),profile=join(homedir(),'.local/state/tdp-game-previews',scope,id,instance);
 await mkdir(profile,{recursive:true,mode:0o700});const lock=join(profile,'active.lock');await mkdir(lock);
 const entry='/__tdp_entry.tsx',virtual='\0tdp-preview-entry.tsx';let server:Awaited<ReturnType<typeof createServer>>|undefined;
 try{
  server=await createServer({root,configFile:false,publicDir:join(root,'public'),cacheDir:join(profile,'vite-cache'),
   server:{host:'127.0.0.1',port:options.port??0,strictPort:true,fs:{allow:[root,packageRoot,await realpath(join(root,'node_modules'))]}},
   optimizeDeps:{entries:[join(root,`portal/games/${id}/client.tsx`)]},
   plugins:[{name:'tdp-game-preview',enforce:'pre',resolveId(value,importer){
    if(value===entry)return virtual;
    if(value.startsWith('.')&&importer&&!importer.startsWith('\0'))value=resolve(dirname(importer.split('?')[0]),value);
    const match=value.replaceAll('\\','/').match(/\/portal\/games\/([^/]+)\//);
    if(match&&match[1]!==id)throw Error('Cross-game preview import rejected');
   },load(value){if(value===virtual)return `import{createElement}from'react';import{createRoot}from'react-dom/client';import Game from '/portal/games/${id}/client.tsx';createRoot(document.getElementById('game')).render(createElement(Game,{locale:'ko',preview:true}));`;},
   configureServer(dev){dev.middlewares.use(async(req,res,next)=>{
    let path:string;try{path=decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
    const other=path.match(/\/(?:portal\/games|assets)\/([^/]+)(?:\/|$)/);
    if(path.startsWith('/api')||other&&other[1]!==id){res.writeHead(404);return res.end();}
    if(path!=='/')return next();
    const html=await dev.transformIndexHtml('/',`<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${id} · Development preview</title></head><body style="margin:0;padding:16px;background:#f5f3ec"><main id="game"></main><script type="module" src="${entry}"></script></body></html>`);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);
   });},}],
  });
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('Preview address unavailable');
  let closing:Promise<void>|undefined;
  return {url:`http://127.0.0.1:${address.port}/`,profile,async close(){closing??=(async()=>{await server!.close();await rm(lock,{recursive:true});})();await closing;}};
 }catch(error){await server?.close();await rm(lock,{recursive:true,force:true});throw error;}
}
export async function testGames(root:string,id?:string){
 const ids=id?[gameId(id)]:(await manifests(root)).map(game=>game.id);
 for(const slug of ids){const directory=await gameDirectory(root,slug),tests=(await readdir(directory)).filter(file=>file.endsWith('.test.ts')).map(file=>join(directory,file));
  if(!tests.length)throw Error(`No rule tests for ${slug}`);
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const compiler=join(dirname(createRequire(join(root,'package.json')).resolve('typescript/package.json')),'bin/tsc');
  const typed=spawnSync(process.execPath,[compiler,'--ignoreConfig','--noEmit','--strict','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--jsx','react-jsx','--skipLibCheck','--types','node','--typeRoots',join(root,'node_modules/@types'),'--allowImportingTsExtensions',join(directory,'client.tsx'),join(directory,'rules.ts'),...tests],{cwd:root,stdio:'inherit',env});
  if(typed.error)throw typed.error;if(typed.status!==0)throw Error(`Game typecheck failed: ${slug}`);
  const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',env});if(result.error)throw result.error;if(result.status!==0)throw Error(`Game tests failed: ${slug}`);
 }
 return {games:ids.length};
}
