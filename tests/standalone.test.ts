import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir,symlink,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createStandaloneProject} from '@thedivineparadox/game-engine/tools/standalone';
test('standalone generator ships a self-contained engine and safely escapes title tokens',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'gyeol-generator-')));try{
  const target=join(root,'signal-garden');const result=await createStandaloneProject(target,{title:'A <signal> & "garden" __PROJECT_ID__'});
  assert.equal(result.project,target);const pkg=JSON.parse(await readFile(join(target,'package.json'),'utf8'));
  assert.equal(pkg.dependencies['@thedivineparadox/game-engine'],'file:vendor/gyeol-engine.tgz');
  assert.equal(pkg.devDependencies.electron,undefined);assert.equal(pkg.devDependencies['@electron/packager'],undefined);assert.match(pkg.scripts['desktop:setup'],/desktop.ts setup/);
  assert.match(await readFile(join(target,'index.html'),'utf8'),/A &lt;signal&gt; &amp; &quot;garden&quot; __PROJECT_ID__/);
  const main=await readFile(join(target,'desktop/main.ts'),'utf8');assert.ok(main.includes('title:'+JSON.stringify('A <signal> & "garden" __PROJECT_ID__')));
  // The fast check proves runtime-only offline use; full toolchain install is the explicit integration lane.
  pkg.devDependencies={};await writeFile(join(target,'package.json'),JSON.stringify(pkg));
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const installed=spawnSync('npm',['install','--offline','--ignore-scripts','--omit=dev','--no-audit','--no-fund'],{cwd:target,env,encoding:'utf8'});assert.equal(installed.status,0,installed.stderr);
  const test=spawnSync(process.execPath,['--test','tests/rules.test.ts'],{cwd:target,env,encoding:'utf8'});assert.equal(test.status,0,test.stderr);
  await assert.rejects(createStandaloneProject(target),/EEXIST/);assert.equal(JSON.parse(await readFile(join(target,'package.json'),'utf8')).name,'signal-garden');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('generator rejects existing and symlink destinations, invalid ids, and control titles',async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),'gyeol-boundary-')));try{
  const original=join(root,'original');await mkdir(original);await writeFile(join(original,'keep'),'original');
  await symlink(original,join(root,'alias'));
  await assert.rejects(createStandaloneProject(join(root,'alias/new-game')),/Symlink/);
  await assert.rejects(createStandaloneProject(original),/EEXIST/);
  await assert.rejects(createStandaloneProject(join(root,'Bad Name')),/project id/);
  await assert.rejects(createStandaloneProject(join(root,'valid'),{title:'Bad\nTitle'}),/Invalid title/);
  assert.equal(await readFile(join(original,'keep'),'utf8'),'original');
 }finally{await rm(root,{recursive:true,force:true});}
});
