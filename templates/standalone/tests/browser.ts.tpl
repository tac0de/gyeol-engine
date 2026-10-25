import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {chromium} from 'playwright';
import {replay} from '@thedivineparadox/game-engine/runtime';
import {rules,solution} from '../src/rules.ts';
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--evidence-dir'||!isAbsolute(args[1]))throw Error('check:browser -- --evidence-dir ABS_DIRECTORY');
const evidence=args[1];await mkdir(evidence,{recursive:true});
// Explicit headless library lane. No user browser/profile, foregrounding, or sandbox override.
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1120,height:850},acceptDownloads:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const root=resolve(import.meta.dirname,'..');
 // A private loopback server matches the real Vite-built browser deployment.
 const {preview}=await import('vite');const server=await preview({root,preview:{host:'127.0.0.1',port:0},logLevel:'error'});
 try{
  const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('Missing port');
  await page.goto(`http://127.0.0.1:${address.port}`);await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:join(evidence,'ready.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Start circuit'}).click();
  const canvas=page.locator('#board');await canvas.focus();
  const keys={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};
  for(const action of solution())await page.keyboard.press(keys[action.direction]);
  assert.equal(await canvas.getAttribute('data-won'),'true');await page.screenshot({path:join(evidence,'won.png'),fullPage:true});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export trail'}).click();const download=await downloadPromise;const recordingPath=join(evidence,'trail.json');await download.saveAs(recordingPath);
  const recording=JSON.parse(await readFile(recordingPath,'utf8'));const restored=replay(rules,recording);assert.equal(restored.inspect().phase,'finished');
  await page.getByRole('button',{name:'Replay trail'}).click();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.replayVerified==='true');
  await page.getByRole('button',{name:'Restart circuit'}).click();assert.equal(await canvas.getAttribute('data-won'),'false');
  // Pointer path uses logical coordinates through the same public input adapter.
  const box=await canvas.boundingBox();assert.ok(box);await canvas.click({position:{x:box.width*232/720,y:box.height*264/400}});assert.equal(await page.locator('#moves').textContent(),'01');
  await page.locator('#import').setInputFiles(recordingPath);await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.won==='true');
  await page.getByRole('button',{name:'Replay trail'}).click();await page.waitForFunction(()=>document.querySelector<HTMLElement>('#board')?.dataset.replayVerified==='true');
  await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":999}')});await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent?.includes('Could not import'));
  await page.setViewportSize({width:680,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(evidence,'compact.png'),fullPage:true});
  assert.deepEqual(errors,[]);await writeFile(join(evidence,'browser-result.json'),JSON.stringify({won:true,replayVerified:true,exportImport:true,pointer:true,invalidImportRejected:true,viewports:[1120,680],errors},null,2));console.log('Browser play, export/import, replay, pointer, and layout passed.');
 }finally{await new Promise<void>((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));await page.close();}
}finally{await browser.close();}
