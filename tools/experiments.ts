import {performance} from 'node:perf_hooks';
import {copyJson,createSession,type GameRules,type Json,type Recording,type Snapshot} from '../runtime/core/index.ts';
import {hashValue,validIdentity,type SourceIdentity} from './reproduction.ts';

export interface ExperimentPolicy<A extends Json>{id:string;information:string;reactionTicks:number;decisionEveryTicks:number;reset?:()=>void;select:(observation:Json)=>A[]}
export interface ExperimentPlan{seeds:number[];maxTicks:number;maxTotalTicks:number;wallTimeMs:number}
export interface ExperimentRun<S extends Json,A extends Json>{id:string;seed:number;policy:string;stop:string;tick:number;actions:number;metrics:Record<string,number>;recording:Recording<A>;final:Snapshot<S>;sha256:string;elapsedMs:number}
/** Trusted TypeScript policies, never executable expressions from JSON. Does not call a model.
 * A synchronous policy cannot be preempted here: use the existing outer command timeout too.
 */
export function runExperiment<S extends Json,A extends Json>(rules:GameRules<S,A>,identity:SourceIdentity,plan:ExperimentPlan,policies:ExperimentPolicy<A>[],
 observe:(snapshot:Snapshot<S>)=>Json,measure:(snapshot:Snapshot<S>)=>Record<string,number>){
 validIdentity(identity);
 if(identity.gameId!==rules.id||!plan.seeds.length||plan.seeds.length>64||new Set(plan.seeds).size!==plan.seeds.length||
  plan.seeds.some(s=>!Number.isSafeInteger(s)||s<0||s>0xffffffff)||!policies.length||policies.length>4||new Set(policies.map(p=>p.id)).size!==policies.length)throw Error('Invalid matched experiment');
 for(const [value,min,max] of [[plan.maxTicks,1,3600],[plan.maxTotalTicks,1,1_000_000],[plan.wallTimeMs,1,60000]])if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid experiment budget');
 for(const p of policies)if(!/^[a-z0-9-]{1,50}$/.test(p.id)||!p.information.trim()||!Number.isSafeInteger(p.reactionTicks)||p.reactionTicks<0||p.reactionTicks>600||!Number.isSafeInteger(p.decisionEveryTicks)||p.decisionEveryTicks<1||p.decisionEveryTicks>600)throw Error('Invalid policy assumptions');
 const started=performance.now(),runs:ExperimentRun<S,A>[]=[];let totalTicks=0,bytes=0;
 for(const seed of plan.seeds)for(const policy of policies){
  const game=createSession(rules,seed),at=performance.now(),history:Json[]=[];let actions=0,stop='step_limit';
  try{
   policy.reset?.();
   game.command({type:'start'});
   for(let tick=0;tick<plan.maxTicks;tick++){
    if(totalTicks>=plan.maxTotalTicks){stop='total_budget';break;}
    if(performance.now()-started>=plan.wallTimeMs){stop='wall_budget';break;}
    const snapshot=game.inspect();if(snapshot.phase==='finished'){stop='finished';break;}
    history.push(copyJson(observe(snapshot)));if(history.length>policy.reactionTicks+1)history.shift();
    if(tick>=policy.reactionTicks&&tick%policy.decisionEveryTicks===0){
     const selected=policy.select(copyJson(history[0]));
     if(!Array.isArray(selected)||selected.length>2)throw Error('Policy action budget exceeded');
     for(const action of selected){game.command({type:'action',action});actions++;}
    }
    game.command({type:'advance',ticks:1});totalTicks++;
   }
  }catch{stop='rule_or_policy_error';}
  try{
   const final=game.inspect();if(final.phase==='finished'&&stop!=='rule_or_policy_error')stop='finished';
   const metrics=measure(final);
   if(Object.keys(metrics).length>32||Object.values(metrics).some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Invalid experiment metric');
   const recording=game.exportRecording(),base={id:seed+'-'+policy.id,seed,policy:policy.id,stop,tick:final.tick,actions,metrics,recording,final,sha256:hashValue(final),elapsedMs:performance.now()-at};
   bytes+=Buffer.byteLength(JSON.stringify(base));if(bytes>16*1024*1024)throw Error('Experiment byte budget exceeded');runs.push(base);
  }finally{game.dispose();}
 }
 const summaries=policies.map(policy=>{
  const matched=runs.filter(r=>r.policy===policy.id),names=[...new Set(matched.flatMap(r=>Object.keys(r.metrics)))];
  return {policy:policy.id,completed:matched.filter(r=>r.stop==='finished').length,limited:matched.filter(r=>r.stop.includes('budget')||r.stop==='step_limit').length,
   errors:matched.filter(r=>r.stop==='rule_or_policy_error').length,metrics:Object.fromEntries(names.map(name=>{
    const values=matched.map(r=>r.metrics[name]).filter(Number.isFinite).sort((a,b)=>a-b);
    return [name,{n:values.length,min:values[0],p50:values[Math.floor((values.length-1)*.5)],p95:values[Math.floor((values.length-1)*.95)],max:values.at(-1)}];
   }))};
 });
 return {kind:'game-experiment',format:1,identity,plan:copyJson(plan),policies:policies.map(({id,information,reactionTicks,decisionEveryTicks,reset})=>({id,information,reactionTicks,decisionEveryTicks,reset:reset?'callback-per-run':'stateless-policy-declaration'})),runs,summaries,totalTicks,elapsedMs:performance.now()-started,
  limitation:'Declared policies and seeds, not human skill groups or proof of enjoyment; elapsed includes instrumentation.'};
}
