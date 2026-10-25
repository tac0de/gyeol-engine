import {copyJson,type Json} from './session.ts';
export type StoragePort={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void};
export type SaveIssue='unavailable'|'corrupt'|'too_large'|'future_version'|'migration_missing'|'migration_failed'|'invalid_data'|'conflict'|'not_loaded'|'recovery_required'|'quota_exceeded'|'write_failed'|'invalid_value';
export type SaveLoad<T>={status:'empty'}|{status:'ready'|'recoverable';value:T;version:number;sourceVersion:number;sequence:number;migrated:boolean;reason?:SaveIssue}|{status:'error';reason:SaveIssue};
export type SaveWrite={status:'saved';sequence:number}|{status:'reset'}|{status:'error';reason:SaveIssue};
export type SaveOptions<T extends Json>={key:string;gameId:string;version:number;validate:(value:unknown)=>value is T;migrations?:Record<number,(value:Json)=>Json>;maxBytes?:number};
type RecordValue={version:number;sequence:number;payload:Json;checksum:string};
type Envelope={format:1;gameId:string;current:RecordValue;backup:RecordValue|null};
class Invalid extends Error {reason:SaveIssue;constructor(reason:SaveIssue){super(reason);this.reason=reason;}}
const bytes=(text:string)=>new TextEncoder().encode(text).byteLength;
// Accidental-corruption detection only; this is not authentication or anti-cheat.
function checksum(gameId:string,version:number,sequence:number,payload:Json){let hash=2166136261;for(const byte of new TextEncoder().encode(JSON.stringify({gameId,version,sequence,payload})))hash=Math.imul(hash^byte,16777619)>>>0;return hash.toString(16).padStart(8,'0');}
const positive=(n:unknown)=>Number.isSafeInteger(n)&&(n as number)>0;
const keys=(v:unknown,expected:string)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===expected;

/** One-key atomic replacement with an embedded last-good record. load never writes. */
export function createSaveSlot<T extends Json>(options:SaveOptions<T>&{storage:()=>StoragePort}){
 options={...options,migrations:options.migrations?{...options.migrations}:undefined};
 const limit=options.maxBytes??512000;
 if(typeof options.key!=='string'||!options.key||options.key.length>160||typeof options.gameId!=='string'||!options.gameId||options.gameId.length>80||!positive(options.version)||!Number.isSafeInteger(limit)||limit<128||limit>1_000_000)throw Error('Invalid save slot options');
 let observed:{raw:string|null;result:SaveLoad<T>;current?:RecordValue;backup?:RecordValue}|undefined;
 function record(input:unknown):{original:RecordValue;value:T}{
  if(!keys(input,'checksum,payload,sequence,version'))throw new Invalid('corrupt');
  const r=input as RecordValue;
  if(!positive(r.version)||!positive(r.sequence)||typeof r.checksum!=='string')throw new Invalid('corrupt');
  let value:Json;try{value=copyJson(r.payload);}catch{throw new Invalid('invalid_data');}
  if(checksum(options.gameId,r.version,r.sequence,value)!==r.checksum)throw new Invalid('corrupt');
  if(r.version>options.version)throw new Invalid('future_version');
  let version=r.version,steps=0;
  while(version<options.version){
   const migrate=options.migrations?.[version];if(!migrate||++steps>32)throw new Invalid('migration_missing');
   try{value=copyJson(migrate(copyJson(value)));}catch{throw new Invalid('migration_failed');}version++;
  }
  try{if(!options.validate(copyJson(value)))throw new Invalid('invalid_data');}catch(error){if(error instanceof Invalid)throw error;throw new Invalid('invalid_data');}
  return {original:copyJson(r),value:copyJson(value) as T};
 }
 function reason(error:unknown):SaveIssue{return error instanceof Invalid?error.reason:'corrupt';}
 function decode(raw:string|null):NonNullable<typeof observed>{
  if(raw===null)return {raw,result:{status:'empty'}};
  if(raw.length>limit||bytes(raw)>limit)return {raw,result:{status:'error',reason:'too_large'}};
  let envelope:Envelope;
  try{
   const value=JSON.parse(raw);
   if(value?.format>1)throw new Invalid('future_version');
   if(!keys(value,'backup,current,format,gameId')||value.format!==1||value.gameId!==options.gameId)throw new Invalid('corrupt');
   envelope=value;
  }catch(error){return {raw,result:{status:'error',reason:reason(error)}};}
  try{
   const found=record(envelope.current);
   return {raw,current:found.original,result:{status:'ready',value:found.value,version:options.version,sourceVersion:found.original.version,sequence:found.original.sequence,migrated:found.original.version!==options.version}};
  }catch(error){
   const issue=reason(error);
   // Never downgrade or hide an unsupported future save behind an older backup.
   if(issue==='future_version')return {raw,result:{status:'error',reason:issue}};
   if(envelope.backup!==null)try{
    const found=record(envelope.backup);
    return {raw,backup:found.original,result:{status:'recoverable',value:found.value,version:options.version,sourceVersion:found.original.version,sequence:found.original.sequence,migrated:found.original.version!==options.version,reason:issue}};
   }catch{/* Preserve both bytes; no valid backup is available to promote. */}
   return {raw,result:{status:'error',reason:issue}};
  }
 }
 function load():SaveLoad<T>{
  try{observed=decode(options.storage().getItem(options.key));return copyJson(observed.result);}
  catch{observed=undefined;return {status:'error',reason:'unavailable'};}
 }
 function writeError(error:unknown):SaveIssue{return (error as {name?:string})?.name==='QuotaExceededError'?'quota_exceeded':(error as {name?:string})?.name==='SecurityError'?'unavailable':'write_failed';}
 function commit(value:T,backup:RecordValue|null,sequence:number):SaveWrite{
  if(!observed)return {status:'error',reason:'not_loaded'};
  let payload:Json,text:string;
  try{
   payload=copyJson(value);if(!options.validate(copyJson(payload)))return {status:'error',reason:'invalid_value'};
   if(!positive(sequence))return {status:'error',reason:'invalid_value'};
   const current={version:options.version,sequence,payload,checksum:checksum(options.gameId,options.version,sequence,payload)};
   text=JSON.stringify({format:1,gameId:options.gameId,current,backup});
   if(text.length>limit||bytes(text)>limit)return {status:'error',reason:'too_large'};
  }catch{return {status:'error',reason:'invalid_value'};}
  try{
   const storage=options.storage();if(storage.getItem(options.key)!==observed.raw)return {status:'error',reason:'conflict'};
   storage.setItem(options.key,text);observed=decode(text);return {status:'saved',sequence};
  }catch(error){return {status:'error',reason:writeError(error)};}
 }
 return {
  load,
  save(value:T):SaveWrite{
   if(!observed)return {status:'error',reason:'not_loaded'};
   if(observed.result.status==='error')return {status:'error',reason:observed.result.reason};
   if(observed.result.status==='recoverable')return {status:'error',reason:'recovery_required'};
   return commit(value,observed.current??null,(observed.current?.sequence??0)+1);
  },
  recoverBackup():SaveWrite{
   if(!observed||observed.result.status!=='recoverable'||!observed.backup)return {status:'error',reason:'recovery_required'};
   return commit(observed.result.value,observed.backup,observed.backup.sequence+1);
  },
  reset():SaveWrite{
   if(!observed)return {status:'error',reason:'not_loaded'};
   try{const storage=options.storage();if(storage.getItem(options.key)!==observed.raw)return {status:'error',reason:'conflict'};storage.removeItem(options.key);observed=decode(null);return {status:'reset'};}catch(error){return {status:'error',reason:writeError(error)};}
  },
  exportRaw:()=>observed?.raw??null,
 };
}
