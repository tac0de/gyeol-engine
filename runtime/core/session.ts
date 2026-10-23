import {integer} from './clock.ts';
import {createPauseController} from './pause.ts';
import {createRandom} from './random.ts';
export type Json=null|boolean|number|string|Json[]|{[key:string]:Json};
export interface RuleContext {tick:number;dtMs:number;random:()=>number}
export interface GameRules<S extends Json,A extends Json>{
 id:string;version:string;
 create(context:RuleContext):S;
 validState(value:unknown):value is S;
 validAction(value:unknown):value is A;
 reduce(state:S,action:A,context:RuleContext):S;
 update(state:S,context:RuleContext):S;
 finished(state:S):boolean;
}
export type Command<A extends Json>={type:'start'}|{type:'advance';ticks:number}|{type:'action';action:A}|{type:'pause';reason:string;paused:boolean}|{type:'restart'};
export interface Recording<A extends Json>{format:1;gameId:string;version:string;seed:number;commands:Command<A>[]}
export interface Snapshot<S extends Json>{state:S;tick:number;phase:'ready'|'playing'|'paused'|'finished'|'disposed';pauseReasons:string[];random:number}
export function copyJson<T>(value:T):T{
 let count=0;
 function visit(v:unknown,depth:number):void{
  if(++count>100000||depth>30)throw Error('JSON limit exceeded');
  if(v===null||typeof v==='boolean'||typeof v==='string')return;
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(typeof v!=='object'||!v||(Object.getPrototypeOf(v)!==Object.prototype&&!Array.isArray(v)))throw Error('Plain JSON required');
  for(const item of Object.values(v))visit(item,depth+1);
 }
 visit(value,0);const text=JSON.stringify(value);if(text.length>1_000_000)throw Error('JSON byte budget exceeded');return JSON.parse(text) as T;
}
/** Browser and CLI both use these exact commands. Rules never read wall time. */
export function createSession<S extends Json,A extends Json>(rules:GameRules<S,A>,seed=1){
 integer(seed,0,0xffffffff,'seed');
 const pause=createPauseController();let random=createRandom(seed),tick=0,started=false,disposed=false;
 let commands:Command<A>[]=[];
 let state=copyJson(rules.create({tick:0,dtMs:1000/60,random:()=>random.next()}));
 if(!rules.validState(state))throw Error('Invalid initial state');
 const phase=():Snapshot<S>['phase']=>disposed?'disposed':!started?'ready':rules.finished(state)?'finished':pause.isPaused()?'paused':'playing';
 const inspect=():Snapshot<S>=>({state:copyJson(state),tick,phase:phase(),pauseReasons:pause.getReasons(),random:random.read()});
 function command(input:Command<A>){
  if(disposed)throw Error('Session disposed');
  const c=copyJson(input);
  const previous=commands.at(-1),merge=c.type==='advance'&&previous?.type==='advance'&&previous.ticks+c.ticks<=3600;
  if(commands.length>=10000&&!merge&&c.type!=='restart')throw Error('Recording full; restart session');
  const keys=Object.keys(c).sort().join(',');
  if(c.type==='advance'){
   if(keys!=='ticks,type')throw Error('Invalid advance');integer(c.ticks,0,3600,'ticks');
  }else if(c.type==='action'){
   if(keys!=='action,type'||!rules.validAction(c.action))throw Error('Invalid action');
  }else if(c.type==='pause'){
   if(keys!=='paused,reason,type'||typeof c.paused!=='boolean'||typeof c.reason!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(c.reason))throw Error('Invalid pause');
  }else if((c.type!=='start'&&c.type!=='restart')||keys!=='type')throw Error('Invalid command');
  // Roll back state and RNG if user rules fail validation or throw.
  const before={state:copyJson(state),tick,seed:random.read(),started,reasons:pause.getReasons()};
  function apply(action?:A){
   const context={tick,dtMs:1000/60,random:()=>random.next()};
   const next=copyJson(action===undefined?rules.update(copyJson(state),context):rules.reduce(copyJson(state),action,context));
   if(!rules.validState(next))throw Error('Invalid rule state');state=next;
  }
  try{
   if(c.type==='restart'){
    random=createRandom(seed);tick=0;started=false;
    // Browser visibility/focus reasons survive a restart.
    state=copyJson(rules.create({tick,dtMs:1000/60,random:()=>random.next()}));
    if(!rules.validState(state))throw Error('Invalid reset state');
   }else if(c.type==='start')started=true;
   else if(c.type==='pause')pause.set(c.reason,c.paused);
   else if(phase()==='playing'){
    if(c.type==='action')apply(c.action);
    else for(let i=0;i<c.ticks&&phase()==='playing';i++){tick++;apply();}
   }
   // A restart opens a bounded recording epoch. Retain environmental pauses so
   // exporting/replaying the new run reproduces a hidden or unfocused restart.
   if(c.type==='restart')commands=pause.getReasons().map(reason=>({type:'pause',reason,paused:true}));
   if(merge&&c.type==='advance'&&previous?.type==='advance')previous.ticks+=c.ticks;else commands.push(c);
  }catch(error){
   state=before.state;tick=before.tick;random=createRandom(before.seed);started=before.started;
   for(const reason of pause.getReasons())pause.set(reason,false);for(const reason of before.reasons)pause.set(reason,true);throw error;
  }
  return inspect();
 }
 return {command,inspect,exportRecording:():Recording<A>=>({format:1,gameId:rules.id,version:rules.version,seed,commands:copyJson(commands)}),dispose(){disposed=true;commands=[];}};
}
export function replay<S extends Json,A extends Json>(rules:GameRules<S,A>,value:Recording<A>){
 const recording=copyJson(value);
 if(Object.keys(recording).sort().join(',')!=='commands,format,gameId,seed,version'||recording.format!==1||recording.gameId!==rules.id||recording.version!==rules.version||!Array.isArray(recording.commands)||recording.commands.length>10000)throw Error('Incompatible recording');
 const session=createSession(rules,recording.seed);for(const c of recording.commands)session.command(c);return session;
}
