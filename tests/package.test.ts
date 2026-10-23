import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSession} from '@thedivineparadox/game-engine/runtime';
import {createGame,startPreview,testGames} from '@thedivineparadox/game-engine/tools';
test('compiled public entries and shipped templates resolve without consumer source paths',()=>{
 assert.equal(typeof createSession,'function');assert.equal(typeof createGame,'function');assert.equal(typeof startPreview,'function');assert.equal(typeof testGames,'function');
 const require=createRequire(import.meta.url),root=new URL('../',import.meta.url);
 assert.ok(require.resolve('@thedivineparadox/game-engine/runtime'));
 assert.ok(existsSync(new URL('dist/runtime/react/game-surface.css',root)));
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
  const probe=spawnSync(process.execPath,['--input-type=module','-e',`import assert from 'node:assert/strict';import {createFixedClock} from '@thedivineparadox/game-engine/runtime';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);assert.equal(typeof createFixedClock,'function');for(const name of ['react','vite','typescript'])assert.throws(()=>require.resolve(name),{code:'MODULE_NOT_FOUND'});`],{cwd:consumer,env,encoding:'utf8'});
  assert.equal(probe.status,0,probe.stderr);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
