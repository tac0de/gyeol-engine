import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVisualTools} from '@thedivineparadox/game-engine/tools/visual';
import {createMediaTools} from '@thedivineparadox/game-engine/tools/media';
test('explicit asset entry points reject traversal, symlinks and undeclared production provenance',async()=>{
 const root=mkdtempSync(join(tmpdir(),'engine-visual-'));try{
  const tools=createVisualTools({project:root,kernelBin:process.execPath,authorityRef:'test fixture only'});
  assert.throws(()=>tools.pixel('export','../escape.json'),/Canonical/);
  assert.throws(()=>tools.media('publish',{project:'/elsewhere',manifestPath:'art/pack.json'}),/Invalid explicit/);
  mkdirSync(join(root,'art'));symlinkSync(tmpdir(),join(root,'art','escape'),'dir');
  assert.throws(()=>tools.pixel('assemble','art/escape/plan.json'),/symlink/);
  let calls=0;const media=createMediaTools({project:root,invoke:()=>{calls++;throw Error('Unexpected production call');}});
  await assert.rejects(media.buildMedia('fixture'),/provenance/);assert.equal(calls,0);
  assert.throws(()=>media.prepareMedia('..','r1'),/Invalid asset id/);
  assert.deepEqual(await media.checkMedia(),{games:0});
 }finally{rmSync(root,{recursive:true,force:true});}
});
