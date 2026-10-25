import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,symlink,rm,realpath,access} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {startPreview} from '../tools/game.ts';
test('explicit private preview state preserves locks, close/restart and source/symlink boundaries',async()=>{
 const project=await realpath(await mkdtemp(join(tmpdir(),'gyeol-preview-project-'))),state=await realpath(await mkdtemp(join(tmpdir(),'gyeol-preview-state-')));
 try{
  await mkdir(join(project,'portal/games/probe'),{recursive:true});await writeFile(join(project,'package.json'),JSON.stringify({name:'preview-probe',type:'module'}));await symlink(await realpath(new URL('../node_modules',import.meta.url)),join(project,'node_modules'),'dir');
  await writeFile(join(project,'portal/games/probe/client.tsx'),'export default function Game(){return null;}');await writeFile(join(project,'portal/games/probe/manifest.json'),JSON.stringify({id:'probe',status:'draft',title:{ko:'검사',en:'Probe'},description:{ko:'검사',en:'Probe'}}));
  await assert.rejects(startPreview(project,'probe',{stateDir:'relative'}),/absolute/);await assert.rejects(startPreview(project,'probe',{stateDir:null as unknown as string}),/absolute/);await assert.rejects(startPreview(project,'probe',{stateDir:join(project,'state')}),/outside/);await assert.rejects(access(join(project,'state')));
  await symlink(state,join(state,'alias'),'dir');await assert.rejects(startPreview(project,'probe',{stateDir:join(state,'alias')}),/Symlink/);
  const a=await startPreview(project,'probe',{stateDir:state});try{await assert.rejects(startPreview(project,'probe',{stateDir:state}));assert.equal((await fetch(a.url)).status,200);assert.equal((await fetch(a.url+'api/session')).status,404);}finally{await a.close();}
  const b=await startPreview(project,'probe',{stateDir:state});await b.close();assert.ok(b.profile.startsWith(state));
 }finally{await rm(project,{recursive:true,force:true});await rm(state,{recursive:true,force:true});}
});
