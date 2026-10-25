/** Explicit end-to-end acceptance from a packed public CLI, outside the engine checkout. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const args=process.argv.slice(2);const packageOnly=args[2]==='--package-only',desktop=packageOnly||args[2]==='--desktop';
if(!(args.length===2||(args.length===3&&desktop))||args[0]!=='--evidence-dir'||!isAbsolute(args[1]))throw Error('--evidence-dir ABS_DIRECTORY [--desktop | --package-only] required');
const root=resolve(import.meta.dirname,'..');await mkdir(args[1],{recursive:true});
const evidence=await mkdtemp(join(args[1],'run-'));await writeFile(join(args[1],'latest.json'),JSON.stringify({evidence}));
const env={...process.env,ELECTRON_CACHE:join(evidence,'electron-cache')};delete env.NODE_TEST_CONTEXT;
let sequence=0;
function run(cwd:string,argv:string[],timeout=600000){
 const result=spawnSync(argv[0],argv.slice(1),{cwd,env,encoding:'utf8',timeout,maxBuffer:10_000_000});
 const stem=String(++sequence).padStart(2,'0');writeFileSync(join(evidence,stem+'.log'),result.stdout+'\n'+result.stderr);
 assert.equal(result.status,0,`${argv.join(' ')} failed. See ${stem}.log: ${result.error?.message??result.stderr.slice(-3000)}`);return result.stdout;
}
const pack=JSON.parse(run(root,['npm','pack','--ignore-scripts','--json','--pack-destination',evidence]))[0];
const bootstrap=join(evidence,'bootstrap');await mkdir(bootstrap);await writeFile(join(bootstrap,'package.json'),JSON.stringify({name:'gyeol-bootstrap',private:true,type:'module'}));
run(bootstrap,['npm','install','--offline','--ignore-scripts','--omit=dev','--no-audit','--no-fund',join(evidence,pack.filename)]);
const project=join(evidence,'signal-garden');run(bootstrap,[join(bootstrap,'node_modules/.bin/gyeol'),'create',project]);
run(project,['npm','install','--no-audit','--no-fund']);
const projectRequire=createRequire(join(project,'package.json'));assert.throws(()=>projectRequire.resolve('electron'),{code:'MODULE_NOT_FOUND'});assert.throws(()=>projectRequire.resolve('@electron/packager'),{code:'MODULE_NOT_FOUND'});
run(project,['npm','run','check']);
run(project,['npm','run','inspect']);
const recording=join(evidence,'scenario.json');run(project,['npm','run','scenario','--','--out',recording]);
const replayText=run(project,[process.execPath,'scripts/game.ts','replay',recording]);const snapshot=JSON.parse(replayText);assert.equal(snapshot.phase,'finished');
run(project,[process.execPath,'node_modules/playwright/cli.js','install','chromium']);
run(project,['npm','run','check:browser','--','--evidence-dir',join(evidence,'browser')]);
run(project,['npm','run','check:persistence','--','--evidence-dir',join(evidence,'persistence')]);
if(!desktop){
 await writeFile(join(evidence,'acceptance.json'),JSON.stringify({project,engineVersion:pack.version,scenario:snapshot,browser:JSON.parse(await readFile(join(evidence,'browser/browser-result.json'),'utf8')),persistence:JSON.parse(await readFile(join(evidence,'persistence/persistence-result.json'),'utf8')),desktop:{status:'not_requested'},webOnlyInstall:true},null,2));
 console.log(JSON.stringify({project,engineVersion:pack.version,steps:sequence,webOnlyInstall:true,desktopExecution:'not_requested'}));
 process.exit(0);
}
run(project,['npm','run','desktop:setup']);
run(project,['npm','run','desktop:package']);
const packageResult=JSON.parse(await readFile(join(project,'desktop-out/package-result.json'),'utf8'));
const require=createRequire(join(project,'package.json'));const asar=await import(pathToFileURL(require.resolve('@electron/asar')).href);
const archive=process.platform==='darwin'?join(packageResult.paths[0],'signal-garden.app/Contents/Resources/app.asar'):join(packageResult.paths[0],'resources/app.asar');
const contents=asar.listPackage(archive) as string[];
for(const file of ['/main.cjs','/dist/index.html','/LICENSE','/ENGINE-LICENSE'])assert.ok(contents.includes(file),file);
assert.ok(contents.some(x=>/\/dist\/assets\/.+\.js$/.test(x)));assert.ok(contents.some(x=>/\/dist\/assets\/.+\.css$/.test(x)));assert.ok(!contents.some(x=>x.includes('/node_modules')));
const acceptance={project,engineVersion:pack.version,scenario:snapshot,browser:JSON.parse(await readFile(join(evidence,'browser/browser-result.json'),'utf8')),persistence:JSON.parse(await readFile(join(evidence,'persistence/persistence-result.json'),'utf8')),packageResult,archiveContents:contents,desktop:{status:'not_run'} as Record<string,unknown>};
await writeFile(join(evidence,'acceptance.json'),JSON.stringify(acceptance,null,2));
try{
 if(packageOnly){acceptance.desktop={status:'not_run',verified:false,reason:'Explicit --package-only; packaged execution remains a separate check.'};}
 else{
 run(project,['npm','run','desktop:smoke','--','--report',join(evidence,'desktop-smoke.json')],90000);
 const desktop=JSON.parse(await readFile(join(evidence,'desktop-smoke.json'),'utf8'));assert.equal(desktop.isolatedSession,true);assert.equal(desktop.packaged,true);assert.equal(desktop.replayVerified,true);acceptance.desktop={status:'passed',...desktop};
 }
}catch(error){
 const logName=String(sequence).padStart(2,'0')+'.log',log=await readFile(join(evidence,logName),'utf8');acceptance.desktop={status:/sandbox initialization failed: Operation not permitted/.test(log)?'blocked_by_host_sandbox':'failed',verified:false,log:logName};
 await writeFile(join(evidence,'acceptance.json'),JSON.stringify(acceptance,null,2));throw error;
}
await writeFile(join(evidence,'acceptance.json'),JSON.stringify(acceptance,null,2));
console.log(JSON.stringify({project,engineVersion:pack.version,steps:sequence,play:true,replay:true,packaged:true,desktopExecution:acceptance.desktop.status,platform:process.platform,arch:process.arch}));
