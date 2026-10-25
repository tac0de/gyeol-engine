import test,{type TestContext} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import type {GameRules,Recording} from '../runtime/core/index.ts';
import {collectIdentity,createReproduction,replayReproduction,compareReproductions} from '../tools/reproduction.ts';
const rules:GameRules<{n:number},{add:number}>={id:'demo',version:'1',create:()=>({n:0}),validState:(v):v is {n:number}=>!!v&&Number.isFinite((v as {n:number}).n),validAction:(v):v is {add:number}=>!!v&&Number.isFinite((v as {add:number}).add),reduce:(s,a)=>({n:s.n+a.add}),update:s=>({n:s.n+1}),finished:s=>s.n>=20};
const recording:Recording<{add:number}>={format:1,gameId:'demo',version:'1',seed:42,commands:[{type:'start'},{type:'advance',ticks:20}]};
async function fixture(t:TestContext){const root=await mkdtemp(join(tmpdir(),'engine-repro-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'rules.ts'),'revision-one');return {root,identity:await collectIdentity('demo',{rules:{root,files:['rules.ts']}})};}
test('source-bound exact replay and same-version drift refusal preserve raw legacy recordings',async t=>{
 const {root,identity}=await fixture(t),bundle=createReproduction(rules,identity,recording);
 assert.equal(bundle.trace.length,21);assert.equal(bundle.final.tick,20);assert.equal(replayReproduction(rules,identity,bundle).matched,true);
 await writeFile(join(root,'rules.ts'),'changed-with-the-same-version');const current=await collectIdentity('demo',{rules:{root,files:['rules.ts']}});
 let called=false;assert.throws(()=>replayReproduction({...rules,create:()=>{called=true;return {n:0};}},current,bundle),/identity changed/);assert.equal(called,false);
 assert.throws(()=>replayReproduction(rules,identity,recording as any),/legacy recording/);
 assert.deepEqual(recording.commands,[{type:'start'},{type:'advance',ticks:20}]);
});
test('matched revision comparison identifies first changed tick and state field',async t=>{
 const {root,identity}=await fixture(t),expected=createReproduction(rules,identity,recording);
 await writeFile(join(root,'rules.ts'),'buggy-revision');const changed=await collectIdentity('demo',{rules:{root,files:['rules.ts']}});
 const buggy={...rules,update:(s:{n:number},c:{tick:number})=>({n:s.n+(c.tick===7?2:1)})};
 const actual=createReproduction(buggy,changed,recording),difference=compareReproductions(expected,actual);
 assert.equal(difference.equal,false);assert.equal(difference.identityChanged,true);assert.equal(difference.tick,7);
 assert.ok(difference.differences.some(d=>d.path==='snapshot.state.n'&&d.expected===7&&d.actual===8));
 assert.throws(()=>replayReproduction(buggy,identity,expected),/diverged at tick 7/);
});
test('diagnostic split locates failing tick without changing actual multi-tick rollback semantics',async t=>{
 const {identity}=await fixture(t),broken={...rules,update:(s:{n:number},c:{tick:number})=>{if(c.tick===7)throw Error('injected');return {n:s.n+1};}};
 const bundle=createReproduction(broken,identity,recording);assert.equal(bundle.stop,'rule_error');assert.deepEqual(bundle.failure,{command:1,tick:7});
 assert.equal(bundle.final.tick,0);assert.equal(bundle.final.state.n,0,'authoritative full advance rolled back');
 assert.equal(bundle.trace.at(-1)!.snapshot.tick,6,'diagnostic shadow explicitly retains only its successful prefix');
 assert.equal(replayReproduction(broken,identity,bundle).stop,'rule_error');
});
test('bounded trace, changed bytes, path escape and symlinks fail explicitly',async t=>{
 const {root,identity}=await fixture(t),bundle=createReproduction(rules,identity,recording);
 assert.throws(()=>createReproduction(rules,identity,recording,10),/step budget/);
 bundle.final.state.n=300;assert.throws(()=>replayReproduction(rules,identity,bundle),/digest mismatch/);
 await assert.rejects(collectIdentity('demo',{rules:{root,files:['../escape']}}),/relative/);
 await symlink(join(root,'rules.ts'),join(root,'alias.ts'));await assert.rejects(collectIdentity('demo',{rules:{root,files:['alias.ts']}}),/regular path/);
});

test('source-bound reproduction accepts checkpoint-origin recordings without replaying old history',async t=>{
 const {createSession,restoreSession}=await import('../runtime/core/index.ts');const {identity}=await fixture(t);const initial=createSession(rules,42);initial.command({type:'start'});initial.command({type:'advance',ticks:6});const continued=restoreSession(rules,initial.exportCheckpoint());continued.command({type:'advance',ticks:3});const recording=continued.exportRecording();assert.equal(recording.format,2);const bundle=createReproduction(rules,identity,recording);assert.equal(bundle.final.tick,9);assert.equal(replayReproduction(rules,identity,bundle).matched,true);
});
