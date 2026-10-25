import {performance} from 'node:perf_hooks';
import {copyJson,createSession,replay,type GameRules,type Json,type Command,type Snapshot} from '../runtime/core/index.ts';
import {hashValue} from './reproduction.ts';
export type ProfileScenario<A extends Json>={seed:number;commands:Command<A>[]};
function distribution(values:number[]){const sorted=[...values].sort((a,b)=>a-b),at=(p:number)=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];return {min:sorted[0],median:at(.5),p95:at(.95),max:sorted.at(-1)!};}
/** CPU command/snapshot costs, not GPU/FPS. Replays are validated outside each timed region. */
export function profileScenario<S extends Json,A extends Json>(rules:GameRules<S,A>,input:unknown,options:{samples?:number}={}){
 const samples=options.samples??10,scenario=copyJson(input) as ProfileScenario<A>;
 if(!Number.isSafeInteger(samples)||samples<3||samples>100)throw Error('Samples must be 3..100');
 if(!scenario||Object.keys(scenario).sort().join(',')!=='commands,seed'||!Array.isArray(scenario.commands)||scenario.commands.length>10000)throw Error('Expected {seed,commands}');
 let steps=0;for(const command of scenario.commands)if(command.type==='advance'){if(!Number.isSafeInteger(command.ticks)||command.ticks<0||command.ticks>3600)throw Error('Invalid advance');steps+=command.ticks;}
 if((steps+scenario.commands.length)*(samples+2)>1_000_000)throw Error('Profile work budget exceeded');
 const createMs:number[]=[],commandsMs:number[]=[],inspectMs:number[]=[];let expected:string|undefined,last:Snapshot<S>|undefined;
 for(let i=-2;i<samples;i++){
  const a=performance.now(),session=createSession(rules,scenario.seed),b=performance.now();
  try{
   for(const command of scenario.commands)session.command(command);
   const c=performance.now(),snapshot=session.inspect(),d=performance.now();
   const identity=hashValue(snapshot);if(expected!==undefined&&identity!==expected)throw Error('Profile state drift');expected=identity;last=snapshot;
   const again=replay(rules,session.exportRecording());try{if(hashValue(again.inspect())!==identity)throw Error('Profile replay drift');}finally{again.dispose();}
   if(i>=0){createMs.push(b-a);commandsMs.push(c-b);inspectMs.push(d-c);}
  }finally{session.dispose();}
 }
 return {format:1,gameId:rules.id,version:rules.version,seed:scenario.seed,scenarioHash:hashValue(scenario),snapshotHash:expected,tick:last!.tick,phase:last!.phase,samples,warmup:2,replaysVerified:samples+2,commands:scenario.commands.length,requestedTicks:steps,milliseconds:{create:distribution(createMs),commands:distribution(commandsMs),inspect:distribution(inspectMs)},scope:'Node CPU command/snapshot wall time; includes validation and copies; replay verification excluded; not browser/GPU/FPS or cross-engine comparison'};
}
