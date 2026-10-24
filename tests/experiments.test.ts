import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {replay,type GameRules} from '../runtime/core/index.ts';
import {collectIdentity,hashValue} from '../tools/reproduction.ts';import {runExperiment,type ExperimentPolicy} from '../tools/experiments.ts';
const rules:GameRules<{n:number},{add:number}>={id:'demo',version:'1',create:()=>({n:0}),validState:(v):v is {n:number}=>!!v&&Number.isFinite((v as any).n),validAction:(v):v is {add:number}=>!!v&&Number.isFinite((v as any).add),reduce:(s,a)=>({n:s.n+a.add}),update:s=>({n:s.n+1}),finished:s=>s.n>=12};
const plan={seeds:[1,42,99],maxTicks:20,maxTotalTicks:500,wallTimeMs:10000};
async function identity(t:any){const root=await mkdtemp(join(tmpdir(),'engine-experiment-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'rules'),'source');return collectIdentity('demo',{rules:{root,files:['rules']}});}
const policies:ExperimentPolicy<{add:number}>[]=[{id:'idle',information:'visible count only',reactionTicks:0,decisionEveryTicks:1,select:()=>[]},{id:'delayed',information:'count delayed by three ticks; every two ticks',reactionTicks:3,decisionEveryTicks:2,select:()=>[{add:1}]}];
test('matched seed/policy records use actual rules and independently replay every run',async t=>{
 const input=await identity(t),report=runExperiment(rules,input,plan,policies,s=>({n:s.state.n}),s=>({n:s.state.n}));
 assert.equal(report.runs.length,6);assert.deepEqual(report.runs.map(r=>r.id),['1-idle','1-delayed','42-idle','42-delayed','99-idle','99-delayed']);
 for(const run of report.runs){assert.equal(run.stop,'finished');assert.equal(hashValue(replay(rules,run.recording).inspect()),run.sha256);}
 assert.equal(report.summaries[0].metrics.n.n,3);assert.ok(report.runs[0].tick>report.runs[1].tick);
 const observed:number[]=[];runExperiment(rules,input,{...plan,seeds:[1]},[{...policies[1],select:o=>{observed.push((o as {n:number}).n);return [];}}],s=>({n:s.state.n}),()=>({}));
 assert.equal(observed[0],1,'first decision at tick4 receives tick1 observation');
});
test('total step exhaustion and policy failures remain visible, never counted as wins',async t=>{
 const input=await identity(t),limited=runExperiment(rules,input,{...plan,maxTotalTicks:2},policies,s=>s.state,()=>({}));
 assert.equal(limited.totalTicks,2);assert.ok(limited.runs.every(r=>r.stop==='total_budget'));assert.ok(limited.summaries.every(s=>s.completed===0));
 const broken=runExperiment(rules,input,plan,[{...policies[0],select:()=>{throw Error('policy failure');}}],s=>s.state,()=>({}));
 assert.ok(broken.runs.every(r=>r.stop==='rule_or_policy_error'));assert.equal(broken.summaries[0].errors,3);
 assert.throws(()=>runExperiment(rules,input,{...plan,seeds:[1,1]},policies,s=>s.state,()=>({})),/Invalid matched/);
 assert.throws(()=>runExperiment(rules,input,plan,[{...policies[0],reactionTicks:Infinity}],s=>s.state,()=>({})),/assumptions/);
});
test('stateful policy resets at each matched seed and identity tampering is rejected',async t=>{
 const input=await identity(t);let decisions=0;const firstCounts:number[]=[];
 const policy={...policies[0],reset:()=>{firstCounts.push(decisions);decisions=0;},select:()=>{decisions++;return [];}};
 const report=runExperiment(rules,input,plan,[policy],s=>s.state,()=>({}));
 assert.deepEqual(firstCounts,[0,12,12]);assert.equal(report.policies[0].reset,'callback-per-run');
 assert.throws(()=>runExperiment(rules,{...input,sha256:'0'.repeat(64)},plan,policies,s=>s.state,()=>({})),/digest mismatch/);
});
