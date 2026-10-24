import {createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {copyJson,replay,type GameRules,type Json,type Recording,type Snapshot} from '../runtime/core/index.ts';

const MAX_BYTES=16*1024*1024;
export function canonical(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
}
export const hashValue=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export interface SourceIdentity {format:1;gameId:string;inputs:Array<{group:string;path:string;sha256:string}>;sha256:string}
/** Trusted authoring roots, declared dependency lists. Not automatic dependency discovery or authorization. */
export async function collectIdentity(gameId:string,groups:Record<string,{root:string;files:string[]}>):Promise<SourceIdentity>{
 if(!/^[a-z0-9-]{1,80}$/.test(gameId)||!Object.keys(groups).length)throw Error('Invalid identity');
 const inputs:SourceIdentity['inputs']=[];
 for(const group of Object.keys(groups).sort()){
  if(!/^[a-z0-9-]{1,40}$/.test(group)||!groups[group].files.length)throw Error('Invalid identity group');
  const {files}=groups[group],root=await realpath(groups[group].root);
  if(new Set(files).size!==files.length)throw Error('Duplicate identity input');
  for(const file of [...files].sort()){
   if(isAbsolute(file)||file.includes('\\')||file.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Canonical relative identity path required');
   const source=resolve(root,file),actual=await realpath(source),rel=relative(root,actual);
   if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||actual!==source||!(await lstat(source)).isFile())throw Error('Identity input must be an owned regular path');
   inputs.push({group,path:file,sha256:createHash('sha256').update(await readFile(source)).digest('hex')});
  }
 }
 if(inputs.length>256)throw Error('Identity input limit');
 const base={format:1 as const,gameId,inputs};return {...base,sha256:hashValue(base)};
}
export interface TracePoint<S extends Json>{command:number;offset:number;snapshot:Snapshot<S>;error?:'rule_error'}
export interface Reproduction<S extends Json,A extends Json>{
 kind:'game-reproduction';format:1;identity:SourceIdentity;recording:Recording<A>;
 trace:TracePoint<S>[];final:Snapshot<S>;stop:'completed'|'rule_error';failure?:{command:number;tick:number};sha256:string;
}
export function validIdentity(identity:SourceIdentity){
 if(!identity||identity.format!==1||!Array.isArray(identity.inputs)||!identity.inputs.length||identity.inputs.length>256)throw Error('Invalid identity');
 const {sha256,...base}=identity;if(hashValue(base)!==sha256)throw Error('Identity digest mismatch');
}
/** Captures actual command boundaries. Split advances are a diagnostic shadow only:
 * authoritative failing multi-tick commands still roll back as core/session specifies.
 */
export function createReproduction<S extends Json,A extends Json>(rules:GameRules<S,A>,identity:SourceIdentity,source:Recording<A>,maxSteps=3600):Reproduction<S,A>{
 validIdentity(identity);if(identity.gameId!==rules.id)throw Error('Identity game mismatch');
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>36000)throw Error('Invalid step budget');
 const recording=copyJson(source),empty={...recording,commands:[]};
 // Validate metadata and the unmodified recording budget before diagnostic execution.
 if(!Array.isArray(recording.commands)||recording.commands.length>10000)throw Error('Recording limit');
 const actual=replay(rules,empty),shadow=replay(rules,empty),trace:TracePoint<S>[]=[];
 let steps=0,bytes=0,stop:'completed'|'rule_error'='completed',failure:Reproduction<S,A>['failure'];
 const append=(point:TracePoint<S>)=>{
  bytes+=Buffer.byteLength(JSON.stringify(point));
  if(trace.length>=14000||bytes>MAX_BYTES-1_100_000)throw Error('Trace byte/point budget exceeded');
  trace.push(point);
 };
 try{
  for(let index=0;index<recording.commands.length;index++){
   const command=recording.commands[index];
   if(command.type==='advance'){
    if(!Number.isSafeInteger(command.ticks)||command.ticks<0||command.ticks>3600)throw Error('Invalid advance');
    steps+=command.ticks;if(steps>maxSteps)throw Error('Trace step budget exceeded');
   }
   let failed=false;
   try{actual.command(command);}catch{failed=true;}
   let shadowFailed=false;
   const count=command.type==='advance'?command.ticks:1;
   for(let offset=0;offset<count;offset++){
    try{shadow.command(command.type==='advance'?{type:'advance',ticks:1}:command);}
    catch{
     shadowFailed=true;failure={command:index,tick:shadow.inspect().tick+(command.type==='advance'?1:0)};
     append({command:index,offset,snapshot:shadow.inspect(),error:'rule_error'});break;
    }
    append({command:index,offset,snapshot:shadow.inspect()});
   }
   if(failed!==shadowFailed)throw Error('Rules depend on command partition; diagnostic trace unsupported');
   if(failed){stop='rule_error';break;}
   if(hashValue(actual.inspect())!==hashValue(shadow.inspect()))throw Error('Diagnostic partition mismatch');
  }
  const base={kind:'game-reproduction' as const,format:1 as const,identity,recording,trace,final:actual.inspect(),stop,...(failure?{failure}:{})};
  if(Buffer.byteLength(JSON.stringify(base))>MAX_BYTES)throw Error('Reproduction byte budget exceeded');
  return {...base,sha256:hashValue(base)};
 }finally{actual.dispose();shadow.dispose();}
}
export function validateReproduction<S extends Json,A extends Json>(bundle:Reproduction<S,A>){
 if(!bundle||bundle.kind!=='game-reproduction'||bundle.format!==1||!Array.isArray(bundle.trace)||bundle.trace.length>14000||Buffer.byteLength(JSON.stringify(bundle))>MAX_BYTES)throw Error('Invalid bounded reproduction; legacy recording requires explicit raw replay');
 validIdentity(bundle.identity);const {sha256,...base}=bundle;if(hashValue(base)!==sha256)throw Error('Reproduction digest mismatch');
}
export function stateDifferences(expected:unknown,actual:unknown,path='',result:Array<{path:string;expected:unknown;actual:unknown}>=[]){
 if(result.length>=32||canonical(expected)===canonical(actual))return result;
 if(expected&&actual&&typeof expected==='object'&&typeof actual==='object'){
  for(const key of [...new Set([...Object.keys(expected),...Object.keys(actual)])].sort()){
   stateDifferences((expected as Record<string,unknown>)[key],(actual as Record<string,unknown>)[key],path?path+'.'+key:key,result);
   if(result.length>=32)break;
  }
 }else result.push({path,expected:expected===undefined?'(missing)':expected,actual:actual===undefined?'(missing)':actual});
 return result;
}
/** Comparison can diagnose two separately captured revisions; it never executes either input. */
export function compareReproductions<S extends Json,A extends Json>(expected:Reproduction<S,A>,actual:Reproduction<S,A>){
 validateReproduction(expected);validateReproduction(actual);
 if(hashValue(expected.recording)!==hashValue(actual.recording))throw Error('Recordings differ; not a matched comparison');
 const length=Math.max(expected.trace.length,actual.trace.length);
 for(let index=0;index<length;index++)if(hashValue(expected.trace[index]??null)!==hashValue(actual.trace[index]??null)){
  const e=expected.trace[index],a=actual.trace[index];
  return {equal:false,identityChanged:expected.identity.sha256!==actual.identity.sha256,index,
   command:a?.command??e.command,tick:actual.failure?.command===a?.command?actual.failure.tick:a?.snapshot.tick??e.snapshot.tick,
   differences:stateDifferences(e??null,a??null)};
 }
 const differences=stateDifferences(expected.final,actual.final);
 return {equal:!differences.length,identityChanged:expected.identity.sha256!==actual.identity.sha256,index:null,command:null,tick:null,differences};
}
export function replayReproduction<S extends Json,A extends Json>(rules:GameRules<S,A>,current:SourceIdentity,bundle:Reproduction<S,A>){
 validateReproduction(bundle);validIdentity(current);
 if(current.sha256!==bundle.identity.sha256)throw Error('Source identity changed; replay refused');
 const observed=createReproduction(rules,current,bundle.recording,36000),comparison=compareReproductions(bundle,observed);
 if(!comparison.equal)throw Error('Replay diverged at tick '+comparison.tick);
 return {matched:true as const,stop:observed.stop,final:observed.final};
}
