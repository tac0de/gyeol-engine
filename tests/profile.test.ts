import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {profileScenario} from '../tools/profile.ts';import type {GameRules} from '../runtime/core/index.ts';
const rules:GameRules<{value:number},never>={id:'profile-probe',version:'1',create:()=>({value:0}),validState:(v):v is {value:number}=>!!v&&typeof v==='object'&&typeof(v as {value:number}).value==='number',validAction:(_):_ is never=>false,reduce:s=>s,update:s=>({value:s.value+1}),finished:s=>s.value>=10};
test('bounded profiles verify every actual replay and expose comparable scope/identity',()=>{
 const result=profileScenario(rules,{seed:7,commands:[{type:'start'},{type:'advance',ticks:10}]},{samples:3});assert.equal(result.tick,10);assert.equal(result.phase,'finished');assert.equal(result.replaysVerified,5);assert.match(result.snapshotHash!,/^[a-f0-9]{64}$/);assert.ok(result.milliseconds.commands.p95>=result.milliseconds.commands.median);assert.match(result.scope,/not browser/);
 assert.throws(()=>profileScenario(rules,{seed:7,commands:[]},{samples:0}));assert.throws(()=>profileScenario(rules,{seed:7,commands:Array.from({length:1000},()=>({type:'advance',ticks:3600}))},{samples:100}),/budget/);
 let value=0;assert.throws(()=>profileScenario({...rules,create:()=>({value:value++})},{seed:1,commands:[]},{samples:3}),/drift/);
});
test('compiled CLI profiles an actual local rule module and rejects unknown flags',()=>{
 const root=mkdtempSync(join(tmpdir(),'gyeol-profile-'));
 try{mkdirSync(join(root,'portal/games/probe'),{recursive:true});writeFileSync(join(root,'portal/games/probe/manifest.json'),JSON.stringify({id:'probe',title:'Probe',status:'draft',version:1}));writeFileSync(join(root,'portal/games/probe/rules.ts'),`export const rules={id:'probe',version:'1',create:()=>({value:0}),validState:v=>v&&typeof v.value==='number',validAction:()=>false,reduce:s=>s,update:s=>({value:s.value+1}),finished:s=>s.value>=5};`);const file=join(root,'scenario.json');writeFileSync(file,JSON.stringify({seed:1,commands:[{type:'start'},{type:'advance',ticks:5}]}));
 const run=spawnSync(process.execPath,['dist/tools/cli.js','profile',root,'probe','--scenario',file,'--samples','3'],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).tick,5);
 const bad=spawnSync(process.execPath,['dist/tools/cli.js','profile',root,'probe','--unknown',file],{encoding:'utf8'});assert.notEqual(bad.status,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
