import {mkdir,writeFile,cp,readFile,rm,lstat} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {build} from 'vite';
import {packager} from '@electron/packager';
import {solution} from '../src/rules.ts';
const root=resolve(import.meta.dirname,'..'),out=join(root,'desktop-out'),mode=process.argv[2];
const require=createRequire(import.meta.url);
try{
 if(mode==='package'){
  // Generated staging output only. Never package source, node_modules, or private evidence.
  const stage=join(out,'stage');await mkdir(out,{recursive:true});await rm(stage,{recursive:true,force:true});await mkdir(stage);
  await cp(join(root,'dist'),join(stage,'dist'),{recursive:true});
  await build({configFile:false,build:{outDir:stage,emptyOutDir:false,ssr:join(root,'desktop/main.ts'),rolldownOptions:{external:['electron',/^node:/],output:{format:'cjs',entryFileNames:'main.cjs'}}}});
  await writeFile(join(stage,'package.json'),JSON.stringify({name:'__PROJECT_ID__',productName:__TITLE_JSON__,version:'0.1.0',main:'main.cjs',license:'MIT'}));
  await cp(join(root,'LICENSE'),join(stage,'LICENSE'));
  const engineRoot=resolve(require.resolve('@thedivineparadox/game-engine/package.json'),'..');await cp(join(engineRoot,'LICENSE'),join(stage,'ENGINE-LICENSE'));
  const electronVersion=JSON.parse(await readFile(require.resolve('electron/package.json'),'utf8')).version;
  const paths=await packager({dir:stage,out,name:'__PROJECT_ID__',platform:process.platform,arch:process.arch,electronVersion,asar:true,overwrite:true,prune:false,appBundleId:'org.gyeol.__PROJECT_ID__',download:{cacheRoot:process.env.ELECTRON_CACHE}});
  await writeFile(join(out,'package-result.json'),JSON.stringify({platform:process.platform,arch:process.arch,electronVersion,paths,signed:false},null,2));
  console.log(JSON.stringify({paths,signed:false}));
 }else if(mode==='smoke'){
  if(process.argv.length!==5||process.argv[3]!=='--report'||!isAbsolute(process.argv[4]))throw Error('desktop:smoke -- --report ABS_NEW_JSON');
  for(const path of [process.argv[4],process.argv[4]+'.png']){try{await lstat(path);throw Error('Report already exists');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
  const result=JSON.parse(await readFile(join(out,'package-result.json'),'utf8'));if(result.platform!==process.platform||result.arch!==process.arch)throw Error('Smoke requires a host-native package');
  const base=result.paths[0],name='__PROJECT_ID__';
  const executable=process.platform==='darwin'?join(base,name+'.app','Contents/MacOS',name):join(base,process.platform==='win32'?name+'.exe':name);
  const keys={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};
  const child=spawnSync(executable,['--gyeol-smoke'],{cwd:base,encoding:'utf8',timeout:60000,env:{...process.env,GYEOL_SMOKE_REPORT:process.argv[4],GYEOL_SMOKE_ROUTE:JSON.stringify(solution().map(a=>keys[a.direction])),ELECTRON_RUN_AS_NODE:undefined}});
  if(child.status!==0)throw Error('Packaged smoke failed: '+child.stderr);console.log(await readFile(process.argv[4],'utf8'));
 }else throw Error('Use package | smoke --report ABS_NEW_JSON');
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
