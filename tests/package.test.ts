import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSession,createSaveSlot,restoreSession} from '@thedivineparadox/game-engine/runtime';
import {createBrowserSaveSlot} from '@thedivineparadox/game-engine/runtime/browser/save';
import {createGame,startPreview,testGames} from '@thedivineparadox/game-engine/tools';
import {mountScreens,mountDialog} from '@thedivineparadox/game-engine/runtime/browser/ui';
import {assetBriefTemplate,reviewAssetBrief} from '@thedivineparadox/game-engine/tools/asset-production';
test('compiled public entries and shipped templates resolve without consumer source paths',()=>{
 assert.equal(typeof createSession,'function');assert.equal(typeof createGame,'function');assert.equal(typeof startPreview,'function');assert.equal(typeof testGames,'function');
 assert.equal(typeof mountScreens,'function');assert.equal(typeof mountDialog,'function');
 assert.equal(typeof createSaveSlot,'function');assert.equal(typeof createBrowserSaveSlot,'function');assert.equal(typeof restoreSession,'function');
 const require=createRequire(import.meta.url),root=new URL('../',import.meta.url);
 assert.ok(require.resolve('@thedivineparadox/game-engine/runtime'));
 assert.ok(existsSync(new URL('dist/runtime/react/game-surface.css',root)));
 assert.ok(existsSync(new URL('dist/runtime/browser/ui.css',root)));
 assert.ok(existsSync(new URL('AGENTS.md',root)));assert.ok(existsSync(new URL('docs/asset-production.md',root)));
 assert.equal(reviewAssetBrief(assetBriefTemplate('ui-frame')).status,'incomplete');
 const source=readFileSync(new URL('dist/tools/game.js',root),'utf8');
 assert.doesNotMatch(source,/GAME_SAVE_LIMITS|thedivineparadox'|portal\/engine|scripts\/game-tools/);
 const template=readFileSync(new URL('templates/mobile-game/client.tsx.tpl',root),'utf8');
 assert.match(template,/@thedivineparadox\/game-engine\/runtime\/react/);
 assert.throws(()=>require.resolve('@thedivineparadox/game-engine/dist/tools/game.js'),{code:'ERR_PACKAGE_PATH_NOT_EXPORTED'});
});
test('packed runtime installs offline in an unrelated project without source or optional tooling peers',()=>{
 const dir=mkdtempSync(join(tmpdir(),'paradox-package-')),root=fileURLToPath(new URL('../',import.meta.url));
 try{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const pack=spawnSync('npm',['pack','--ignore-scripts','--json','--pack-destination',dir],{cwd:root,env,encoding:'utf8'});
  assert.equal(pack.status,0,pack.stderr);const [{filename}]=JSON.parse(pack.stdout);
  const consumer=join(dir,'consumer');mkdirSync(consumer);writeFileSync(join(consumer,'package.json'),JSON.stringify({name:'unrelated-engine-consumer',private:true,type:'module'}));
  const install=spawnSync('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund','--omit=dev',join(dir,filename)],{cwd:consumer,env,encoding:'utf8'});
  assert.equal(install.status,0,install.stderr);
  const probe=spawnSync(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';import {createFixedClock} from '@thedivineparadox/game-engine/runtime';import {assetBriefTemplate,reviewAssetBrief} from '@thedivineparadox/game-engine/tools/asset-production';import {readFileSync,existsSync} from 'node:fs';import {dirname,join} from 'node:path';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);assert.equal(typeof createFixedClock,'function');for(const kind of ['image','animation','ui-frame'])assert.equal(reviewAssetBrief(assetBriefTemplate(kind)).status,'incomplete');const root=dirname(require.resolve('@thedivineparadox/game-engine/package.json'));assert.ok(readFileSync(join(root,'AGENTS.md'),'utf8').includes('docs/asset-production.md'));assert.ok(existsSync(join(root,'docs/asset-production.md')));for(const name of ['react','vite','typescript'])assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});`],{cwd:consumer,env,encoding:'utf8'});
  assert.equal(probe.status,0,probe.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
