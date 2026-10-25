/** Actual compiled public API, native CSS/image lifecycle, and controlled frame trace. */
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {resolve,join,isAbsolute} from 'node:path';
import {createServer} from 'vite';import {chromium} from '@playwright/test';import sharp from 'sharp';
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--evidence-dir'||!isAbsolute(args[1]))throw Error('--evidence-dir ABS required');
const evidence=args[1];await mkdir(evidence,{recursive:true});const requests:Record<string,number>={};let active=0,peak=0;
const entry=`import{mountBrowserGame}from'@thedivineparadox/game-engine/runtime/browser/host';import{createAssetScope}from'@thedivineparadox/game-engine/runtime/browser/assets';import{settleAnimations}from'@thedivineparadox/game-engine/runtime/browser/animations';window.features={mountBrowserGame,createAssetScope,settleAnimations};`;
const png=await sharp({create:{width:8,height:8,channels:4,background:'#72bc9b'}}).png().toBuffer();
const server=await createServer({root:resolve(import.meta.dirname,'..'),configFile:false,publicDir:false,cacheDir:join(evidence,'vite-cache'),server:{host:'127.0.0.1',port:0},plugins:[{name:'engine-feature-fixture',resolveId(id){if(id==='/entry.js')return '\0feature-entry.js';},load(id){if(id==='\0feature-entry.js')return entry;},configureServer(dev){dev.middlewares.use(async(req,res,next)=>{
 const path=new URL(req.url??'/','http://localhost').pathname;
 if(path.startsWith('/assets/probe/')){
  requests[path]=(requests[path]??0)+1;active++;peak=Math.max(peak,active);let ended=false;let timer:ReturnType<typeof setTimeout>;
  res.on('close',()=>{if(!ended){ended=true;active--;}clearTimeout(timer);});
  timer=setTimeout(()=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','image/png');if(path.includes('retry')&&requests[path]===1){res.statusCode=503;res.end('unavailable');}else res.end(png);},path.includes('slow')?300:30);return;
 }
 if(path!=='/')return next();res.setHeader('Content-Type','text/html');res.end(await dev.transformIndexHtml('/','<!doctype html><html><head><style>body{background:#102934;color:#fff;font:18px sans-serif;padding:24px}.badge{width:160px;padding:24px;background:#27766f;animation:pulse .16s linear}@keyframes pulse{from{opacity:.3}to{opacity:1}}@media(prefers-reduced-motion:reduce){.badge{animation:none}}</style></head><body><h1>Gyeol native lifecycle checks</h1><div id="fixture"></div><script type="module" src="/entry.js"></script></body></html>'));
 });}}]});
await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('Missing port');const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:650}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${address.port}`);await page.waitForFunction(()=>!!(window as any).features);
 const frames=await page.evaluate(()=>{
  const {mountBrowserGame}=(window as any).features,old={raf:requestAnimationFrame,cancel:cancelAnimationFrame};let id=0;const queue=new Map<number,FrameRequestCallback>();
  window.requestAnimationFrame=fn=>{queue.set(++id,fn);return id;};window.cancelAnimationFrame=id=>{queue.delete(id);};
  const rules={id:'probe',version:'1',create:()=>({n:0}),validState:()=>true,validAction:()=>true,reduce:(s:{n:number},a:number)=>({n:s.n+a}),update:(s:{n:number})=>({n:s.n+1}),finished:()=>false};
  function run(renderMode?:string){let draws=0;const canvas=document.createElement('canvas');document.body.append(canvas);const host=mountBrowserGame(canvas,{rules,width:100,height:100,renderMode,input:()=>undefined,render(){draws++;}});host.command({type:'start'});draws=0;
   for(let i=0;i<=240;i++){const [key,fn]=queue.entries().next().value!;queue.delete(key);fn(i*1000/120);}
   const result={draws,snapshot:host.inspect(),recording:host.exportRecording()};host.command({type:'action',action:2});if(draws!==result.draws+1)throw Error('Input redraw missing');host.dispose();canvas.remove();if(queue.size)throw Error('RAF retained');return result;
  }
  try{const all=run(),changed=run('on-change');if(JSON.stringify(all.snapshot)!==JSON.stringify(changed.snapshot)||JSON.stringify(all.recording)!==JSON.stringify(changed.recording))throw Error('State/recording drift');return {everyFrame:all.draws,onChange:changed.draws,tick:changed.snapshot.tick,recordingEqual:true,stateEqual:true};}
  finally{window.requestAnimationFrame=old.raf;window.cancelAnimationFrame=old.cancel;}
 });
 assert.equal(frames.everyFrame,241);assert.ok(frames.onChange<frames.everyFrame*.6);
 const assets=await page.evaluate(async()=>{
  const {createAssetScope}=(window as any).features,scope=createAssetScope('probe',{concurrency:2});const a=scope.loadImage('/assets/probe/a.png'),b=scope.loadImage('/assets/probe/a.png');if(a!==b)throw Error('Missing pending dedup');const image=await a;if(image!==await b)throw Error('Missing bitmap dedup');
  let failed=false;try{await scope.loadImage('/assets/probe/retry.png');}catch{failed=true;}if(!failed)throw Error('Expected fixture failure');await scope.loadImage('/assets/probe/retry.png');
  const domA=scope.loadElement('/assets/probe/dom.png'),domB=scope.loadElement('/assets/probe/dom.png');if(domA!==domB)throw Error('Missing DOM dedup');const element=await domA;
  await Promise.all(Array.from({length:6},(_,i)=>scope.loadImage('/assets/probe/batch-'+i+'.png')));await scope.dispose();if(image.width!==0||element.hasAttribute('src'))throw Error('Owned image not released');
  const pending=createAssetScope('probe',{concurrency:1}),first=pending.loadElement('/assets/probe/slow.png'),second=pending.loadElement('/assets/probe/never.png'),results=Promise.allSettled([first,second]);await pending.dispose();if(!(await results).every(x=>x.status==='rejected'))throw Error('Dispose did not reject work');
  return {dedup:true,retry:true,domDedup:true,bitmapClosed:true,elementReleased:true,cancelledQueued:true};
 });
 assert.equal(requests['/assets/probe/a.png'],1);assert.equal(requests['/assets/probe/dom.png'],1);assert.equal(requests['/assets/probe/retry.png'],2);assert.equal(requests['/assets/probe/never.png'],undefined);assert.ok(peak<=2);
 const animations=await page.evaluate(async()=>{
  const {settleAnimations}=(window as any).features,root=document.getElementById('fixture')!;root.innerHTML='<div class="badge">Native completion</div>';const completed=await settleAnimations(root);
  const el=root.firstElementChild!,a=el.animate([{opacity:.3},{opacity:1}],{duration:10000}),cancelled=settleAnimations(root);a.cancel();if((await cancelled).status!=='cancelled')throw Error('Cancel reported incorrectly');
  const b=el.animate([{opacity:.3},{opacity:1}],{duration:10000}),controller=new AbortController(),aborted=settleAnimations(root,{signal:controller.signal});controller.abort();if((await aborted).status!=='aborted')throw Error('Abort reported incorrectly');
  const timed=await settleAnimations(root,{timeoutMs:5});b.cancel();if(timed.status!=='timeout')throw Error('Timeout reported as success');return {completed,cancelled:true,aborted:true,timeout:true};
 });
 assert.equal(animations.completed.status,'finished');assert.equal(animations.completed.count,1);
 await page.emulateMedia({reducedMotion:'reduce'});const reduced=await page.evaluate(async()=>{const root=document.getElementById('fixture')!;root.innerHTML='<div class="badge">Reduced motion: no delay</div>';return (window as any).features.settleAnimations(root);});assert.equal(reduced.count,0);assert.equal(reduced.status,'finished');
 await page.screenshot({path:join(evidence,'native-lifecycle.png'),fullPage:true});assert.deepEqual(errors,[]);
 const result={frames,assets,requests,peak,animations,reduced,errors,scope:'compiled public API; native image/CSS lifecycle; controlled 120Hz trace, not device/GPU benchmark'};await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();await server.close();}
