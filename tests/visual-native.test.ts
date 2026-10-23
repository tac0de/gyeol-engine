/** Explicit native integration, not a production art-quality or Imagegen comparison test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {createVisualTools} from '@thedivineparadox/game-engine/tools/visual';
test('existing native assembler/exporter validates and binds editable pixel sources without changing originals',{timeout:120000},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'engine-native-'));
 try{
  fs.mkdirSync(path.join(root,'art'),{recursive:true});
  const raw=Buffer.alloc(16*8*4);for(let f=0;f<2;f++)for(let y=2;y<6;y++)for(let x=2;x<6;x++){const n=(y*16+x+f*8)*4;raw[n]=f?220:80;raw[n+1]=150;raw[n+3]=255;}
  await sharp(raw,{raw:{width:16,height:8,channels:4}}).png().toFile(path.join(root,'art/fixture.png'));
  const plan={version:1,id:'fixture',directory:'art/native-r1',output:'/assets/fixture/r1/hero',canvas:{width:8,height:8},pivot:{x:4,y:7},scale:1,columns:2,frames:[{id:'idle-0',image:'fixture.png',rect:{x:0,y:0,w:8,h:8},durationMs:100},{id:'idle-1',image:'fixture.png',rect:{x:8,y:0,w:8,h:8},durationMs:120}],clips:{idle:{from:'idle-0',to:'idle-1',loop:true,minDistinctFrames:2}}};
  fs.writeFileSync(path.join(root,'art/plan.json'),JSON.stringify(plan));
  const tools=createVisualTools({project:root,kernelBin:path.join(process.env.TDP_AGENT_KERNEL_ROOT??path.join(os.homedir(),'codex-agent-kernel'),'bin/agent'),authorityRef:'User-authorized visual tools verification; technical fixture, not adopted art'});
  tools.pixel('assemble','art/plan.json');tools.pixel('export','art/plan.json');
  const value=tools.bindPixel('art/plan.json','fixture','hero');
  assert.deepEqual(value.frames.map((f:any)=>f.durationMs),[100,120]);assert.equal(value.image,'/assets/fixture/r1/hero.png');
  const module=await import(pathToFileURL(path.join(root,'portal/games/fixture/pixel-hero.generated.ts')).href);
  assert.deepEqual(module.sprite,value);assert.equal(tools.checkPixelBinding('fixture','hero').mechanicalStatus,'passed');
  assert.throws(()=>tools.bindPixel('art/plan.json','another','hero'),/consuming game/);
  fs.appendFileSync(path.join(root,'art/native-r1/sprite.aseprite'),'stale');
  assert.throws(()=>tools.checkPixelBinding('fixture','hero'),/Stale native pixel output/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
