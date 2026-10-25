import test from 'node:test';import assert from 'node:assert/strict';
import {createSaveSlot,type StoragePort} from '../../runtime/core/index.ts';
const valid=(v:unknown):v is {n:number}=>!!v&&typeof v==='object'&&Object.keys(v).join(',')==='n'&&Number.isSafeInteger((v as {n:number}).n);
function memory(){const data=new Map<string,string>();let writeFailure='',readFailure=false,removeFailure=false,writes=0;const storage:StoragePort={getItem:k=>{if(readFailure)throw Object.assign(Error(),{name:'SecurityError'});return data.get(k)??null;},setItem(k,v){if(writeFailure)throw Object.assign(Error(),{name:writeFailure});data.set(k,v);writes++;},removeItem(k){if(removeFailure)throw Error('remove failed');data.delete(k);}};return {data,storage,get writes(){return writes;},failWrite(name=''){writeFailure=name;},failRead(value:boolean){readFailure=value;},failRemove(value:boolean){removeFailure=value;}};}
const options={key:'slot',gameId:'game',version:2,validate:valid,migrations:{1:(v:any)=>({n:v.n+1})}};
test('read-only migration commits only explicitly and retains the old valid generation',()=>{
 const m=memory(),legacy=createSaveSlot({...options,version:1,storage:()=>m.storage});legacy.load();assert.equal(legacy.save({n:2}).status,'saved');const original=m.data.get('slot'),writes=m.writes;
 const current=createSaveSlot({...options,storage:()=>m.storage}),loaded=current.load();assert.equal(loaded.status,'ready');if(loaded.status!=='ready')throw Error();assert.deepEqual(loaded.value,{n:3});assert.equal(loaded.migrated,true);assert.equal(m.data.get('slot'),original);assert.equal(m.writes,writes);
 assert.equal(current.save(loaded.value).status,'saved');const envelope=JSON.parse(m.data.get('slot')!);assert.equal(envelope.current.version,2);assert.equal(envelope.backup.version,1);assert.equal(envelope.backup.payload.n,2);
 loaded.value.n=500;assert.equal(current.load().status,'ready');assert.equal(JSON.parse(m.data.get('slot')!).current.payload.n,3);
});
test('corrupt current recovers a checked backup only on explicit promotion',()=>{
 const m=memory(),slot=createSaveSlot({...options,storage:()=>m.storage});slot.load();slot.save({n:1});slot.save({n:2});const corrupt=JSON.parse(m.data.get('slot')!);corrupt.current.payload.n=999;m.data.set('slot',JSON.stringify(corrupt));const raw=m.data.get('slot');const loaded=slot.load();assert.equal(loaded.status,'recoverable');if(loaded.status!=='recoverable')throw Error();assert.deepEqual(loaded.value,{n:1});assert.equal(m.data.get('slot'),raw);
 assert.deepEqual(slot.save({n:20}),{status:'error',reason:'recovery_required'});assert.equal(m.data.get('slot'),raw);assert.equal(slot.recoverBackup().status,'saved');assert.equal(slot.load().status,'ready');assert.equal(JSON.parse(m.data.get('slot')!).current.payload.n,1);
});
test('future versions, missing or throwing migrations are preserved rather than downgraded',()=>{
 const m=memory(),future=createSaveSlot({...options,version:3,storage:()=>m.storage});future.load();future.save({n:10});const raw=m.data.get('slot');const current=createSaveSlot({...options,storage:()=>m.storage});assert.deepEqual(current.load(),{status:'error',reason:'future_version'});assert.deepEqual(current.save({n:0}),{status:'error',reason:'future_version'});assert.equal(m.data.get('slot'),raw);
 const legacy=createSaveSlot({...options,version:1,storage:()=>m.storage});m.data.delete('slot');legacy.load();legacy.save({n:4});const before=m.data.get('slot');
 assert.deepEqual(createSaveSlot({...options,migrations:{},storage:()=>m.storage}).load(),{status:'error',reason:'migration_missing'});
 assert.deepEqual(createSaveSlot({...options,migrations:{1:()=>{throw Error('bad migration');}},storage:()=>m.storage}).load(),{status:'error',reason:'migration_failed'});assert.equal(m.data.get('slot'),before);
});
test('quota/read/removal failures preserve data and a retry can commit the in-memory value',()=>{
 const m=memory(),slot=createSaveSlot({...options,storage:()=>m.storage});slot.load();slot.save({n:1});const before=m.data.get('slot');m.failWrite('QuotaExceededError');assert.deepEqual(slot.save({n:2}),{status:'error',reason:'quota_exceeded'});assert.equal(m.data.get('slot'),before);m.failWrite();assert.equal(slot.save({n:2}).status,'saved');
 const latest=m.data.get('slot');m.failRead(true);assert.deepEqual(slot.load(),{status:'error',reason:'unavailable'});assert.deepEqual(slot.save({n:9}),{status:'error',reason:'not_loaded'});m.failRead(false);slot.load();m.failRemove(true);assert.deepEqual(slot.reset(),{status:'error',reason:'write_failed'});assert.equal(m.data.get('slot'),latest);m.failRemove(false);assert.equal(slot.reset().status,'reset');assert.equal(slot.load().status,'empty');
 const denied=createSaveSlot({...options,storage:()=>{throw Error('getter denied');}});assert.deepEqual(denied.load(),{status:'error',reason:'unavailable'});
});
test('observed cross-tab changes reject stale save and reset without silently reloading',()=>{
 const m=memory(),a=createSaveSlot({...options,storage:()=>m.storage}),b=createSaveSlot({...options,storage:()=>m.storage});a.load();b.load();a.save({n:1});const raw=m.data.get('slot');assert.deepEqual(b.save({n:2}),{status:'error',reason:'conflict'});assert.deepEqual(b.reset(),{status:'error',reason:'conflict'});assert.equal(m.data.get('slot'),raw);b.load();assert.equal(b.save({n:2}).status,'saved');
});
test('whole-file corruption, invalid state and UTF-8 size limits fail without writes',()=>{
 const m=memory(),slot=createSaveSlot({...options,storage:()=>m.storage});m.data.set('slot','{broken');assert.equal(slot.load().status,'error');assert.equal(slot.exportRaw(),'{broken');assert.deepEqual(slot.save({n:0}),{status:'error',reason:'corrupt'});assert.equal(m.data.get('slot'),'{broken');assert.equal(slot.reset().status,'reset');
 slot.load();assert.deepEqual(slot.save({n:NaN}),{status:'error',reason:'invalid_value'});assert.equal(m.data.has('slot'),false);
 const text=createSaveSlot({key:'text',gameId:'game',version:1,maxBytes:400,validate:(v):v is {text:string}=>!!v&&typeof v==='object'&&typeof (v as {text:string}).text==='string',storage:()=>m.storage});text.load();assert.deepEqual(text.save({text:'🙂'.repeat(100)}),{status:'error',reason:'too_large'});assert.equal(m.data.has('text'),false);
});
