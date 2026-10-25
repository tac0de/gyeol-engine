import test from 'node:test';import assert from 'node:assert/strict';
import {settleAnimations} from '../../runtime/browser/animations.ts';
const root=(values:unknown[])=>({getAnimations:()=>values}) as unknown as Element;
function animation(endTime=760){let done!:()=>void,cancel!:()=>void;const finished=new Promise<void>((resolve,reject)=>{done=resolve;cancel=()=>reject(Error('cancelled'));});return {value:{effect:{getComputedTiming:()=>({endTime})},finished},done,cancel};}
test('finite animation batches wait for actual completion and distinguish cancellation',async()=>{
 const a=animation(),b=animation(),infinite=animation(Infinity);let resolved=false;
 const work=settleAnimations(root([a.value,b.value,infinite.value]),{timeoutMs:200}).then(x=>{resolved=true;return x;});
 a.done();await Promise.resolve();assert.equal(resolved,false);b.cancel();assert.deepEqual(await work,{status:'cancelled',count:2,ignored:1});
 assert.deepEqual(await settleAnimations(root([])),{status:'finished',count:0,ignored:0});
});
test('abort and timeout never report successful completion or cancel browser effects',async()=>{
 const a=animation(),abort=new AbortController();const work=settleAnimations(root([a.value]),{signal:abort.signal});abort.abort();assert.equal((await work).status,'aborted');
 assert.equal((await settleAnimations(root([a.value]),{timeoutMs:2})).status,'timeout');a.done();
 assert.equal((await settleAnimations(root([]),{signal:abort.signal})).status,'aborted');assert.throws(()=>settleAnimations(root([]),{timeoutMs:0}));
});
