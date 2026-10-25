import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {replay} from '@thedivineparadox/game-engine/runtime';
import {rules,solution} from '../src/rules.ts';
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--evidence-dir'||!isAbsolute(args[1]))throw Error('check:browser -- --evidence-dir ABS_DIRECTORY');
const evidence=args[1];await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1120,height:850},acceptDownloads:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const root=resolve(import.meta.dirname,'..');const {preview,createServer}=await import('vite');
 const dev=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});
 try{await dev.listen();const address=dev.httpServer!.address();if(!address||typeof address==='string')throw Error('Missing dev port');await page.goto(`http://127.0.0.1:${address.port}`);await page.getByRole('button',{name:'Start circuit'}).waitFor();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(17, 26, 26)');assert.equal(await page.locator('#menu .gyeol-stack').first().evaluate(e=>getComputedStyle(e).display),'flex');await page.screenshot({path:join(evidence,'dev-menu.png'),fullPage:true});}finally{await dev.close();}
 const server=await preview({root,preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 try{
  const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('Missing port');
  await page.goto(`http://127.0.0.1:${address.port}`);await page.evaluate(()=>document.fonts.ready);
  await writeFile(join(evidence,'visible-controls.json'),JSON.stringify(await page.getByRole('button').allTextContents()));
  const start=page.getByRole('button',{name:'Start circuit'}),canvas=page.locator('#board'),flow=page.locator('#screens');
  assert.equal(await start.count(),1);assert.equal(await start.isEnabled(),true);assert.equal(await page.evaluate(()=>document.activeElement?.id),'start');
  assert.equal(await page.locator('[data-gyeol-screen]:not([hidden])').count(),1);await page.screenshot({path:join(evidence,'menu.png'),fullPage:true});
  await start.click();assert.equal(await flow.getAttribute('data-screen'),'play');assert.equal(await page.evaluate(()=>document.activeElement?.id),'board');
  await page.screenshot({path:join(evidence,'play.png'),fullPage:true});
  await page.keyboard.press('Escape');const dialog=page.getByRole('dialog',{name:'Circuit paused.'});assert.equal(await dialog.isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement?.id),'resume');
  const pausedTick=await canvas.getAttribute('data-tick');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#moves').textContent(),'00');
  for(let i=0;i<3;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.id),'resume');
  await page.screenshot({path:join(evidence,'pause.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.id),'board');
  await page.getByRole('button',{name:'Pause',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.getByRole('button',{name:'Resume circuit'}).click();assert.equal(await canvas.getAttribute('data-phase'),'paused');
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await canvas.focus();
  const keys={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};for(const action of solution())await page.keyboard.press(keys[action.direction]);
  assert.equal(await flow.getAttribute('data-screen'),'result');assert.equal(await canvas.getAttribute('data-won'),'true');assert.equal(await page.evaluate(()=>document.activeElement?.id),'again');await page.screenshot({path:join(evidence,'result.png'),fullPage:true});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export trail',exact:true}).click();const download=await downloadPromise,recordingPath=join(evidence,'trail.json');await download.saveAs(recordingPath);
  const recording=JSON.parse(await readFile(recordingPath,'utf8'));assert.equal(replay(rules,recording).inspect().phase,'finished');
  await page.getByRole('button',{name:'Replay trail',exact:true}).click();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.replayVerified==='true');
  await page.getByRole('button',{name:'Restart circuit'}).click();assert.equal(await canvas.getAttribute('data-won'),'false');assert.equal(await page.getByRole('button',{name:'Pause',exact:true}).isEnabled(),true);
  const box=await canvas.boundingBox();assert.ok(box);await canvas.click({position:{x:box.width*232/720,y:box.height*264/400}});assert.equal(await page.locator('#moves').textContent(),'01');
  await page.locator('#import').setInputFiles(recordingPath);await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.won==='true');
  await page.getByRole('button',{name:'Replay trail',exact:true}).click();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.replayVerified==='true');
  await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":999}')});await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('Could not import'));
  await page.getByRole('button',{name:'Menu',exact:true}).click();
  for(let i=0;i<5;i++){await start.click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to menu'}).click();assert.equal(await flow.getAttribute('data-screen'),'menu');}
  const tick=await canvas.getAttribute('data-tick');await page.keyboard.press('ArrowRight');await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));assert.equal(await canvas.getAttribute('data-tick'),tick);
  for(const width of [680,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(evidence,`menu-${width}.png`),fullPage:true});await start.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(evidence,`play-${width}.png`),fullPage:true});await page.getByRole('button',{name:'Menu',exact:true}).click();}
  await page.locator('h1').evaluate(e=>{e.textContent='아주긴게임이름과함께ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ';});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Exercise the shipped public lifecycle module in a separate owned DOM fixture.
  const fixture=await browser.newPage();await fixture.setContent('<button id="outside">Outside</button><main id="root"><section id="a"><button>A</button></section><section id="b"><button>B</button></section></main><dialog id="dialog"><button>Resume</button></dialog>');
  const require=createRequire(import.meta.url),source=await readFile(require.resolve('@thedivineparadox/game-engine/runtime/browser/ui'),'utf8');
  const lifecycle=await fixture.evaluate(async source=>{
   const {mountScreens,mountDialog}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
   const el=(id:string)=>document.getElementById(id)!,root=el('root'),a=el('a'),b=el('b'),outside=el('outside');let clicks=0,cleanups=0;const signals:AbortSignal[]=[];outside.focus();
   const flow=mountScreens(root,{initial:'a',screens:{a:{element:a,enter:({signal}:{signal:AbortSignal})=>{signals.push(signal);a.querySelector('button')!.addEventListener('click',()=>clicks++,{signal});return ()=>cleanups++;}},b:{element:b,enter:({signal}:{signal:AbortSignal})=>{signals.push(signal);return ()=>cleanups++;}}}});
   a.querySelector('button')!.click();flow.show('b');a.querySelector('button')!.click();flow.show('a');flow.show('a');a.querySelector('button')!.click();flow.show('b');flow.dispose();flow.dispose();
   const restored=!a.hidden&&!a.inert&&!b.hidden&&!b.inert&&document.activeElement===outside;
   let disposedRejected=false;try{flow.show('a');}catch{disposedRejected=true;}
   let nestedRejected=false;const nested=document.createElement('section');a.append(nested);try{mountScreens(root,{initial:'a',screens:{a:{element:a},nested:{element:nested}}});}catch{nestedRejected=true;}nested.remove();
   const failed=mountScreens(root,{initial:'a',screens:{a:{element:a},b:{element:b,enter:()=>{throw Error('fixture enter failure');}}}});let failedClosed=false;try{failed.show('b');}catch{failedClosed=failed.current()===null&&a.hidden&&b.hidden;}failed.show('a');failed.dispose();
   const changes:boolean[]=[];const dialog=mountDialog(el('dialog'),{changed:(open:boolean)=>changes.push(open)});outside.focus();dialog.open();dialog.close();dialog.open();await new Promise(resolve=>setTimeout(resolve,0));const reopened=dialog.isOpen()&&(el('dialog') as HTMLDialogElement).open;dialog.close();dialog.dispose();dialog.dispose();let dialogDisposedRejected=false;try{dialog.open();}catch{dialogDisposedRejected=true;}
   return {clicks,cleanups,allAborted:signals.every(s=>s.aborted),restored,disposedRejected,nestedRejected,failedClosed,reopened,changes,dialogDisposedRejected,focusRestored:document.activeElement===outside};
  },source);
  assert.deepEqual(lifecycle,{clicks:2,cleanups:4,allAborted:true,restored:true,disposedRejected:true,nestedRejected:true,failedClosed:true,reopened:true,changes:[true,false,true,false],dialogDisposedRejected:true,focusRestored:true});await fixture.close();
  assert.deepEqual(errors,[]);await writeFile(join(evidence,'browser-result.json'),JSON.stringify({won:true,replayVerified:true,exportImport:true,pointer:true,invalidImportRejected:true,screenFlow:true,modalEscapeFocus:true,independentPause:true,reentry:true,lifecycle,viewports:[1120,680,320],errors},null,2));console.log('Web screens, focus, modal, lifecycle, play, export/import, and replay passed.');
 }catch(error){await page.screenshot({path:join(evidence,'failure.png'),fullPage:true});throw error;}
 finally{await page.close();await new Promise<void>((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));}
}finally{await browser.close();}
