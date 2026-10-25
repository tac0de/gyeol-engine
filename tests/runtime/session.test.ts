import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,replay,createFixedClock,createFrameClock,type GameRules} from '../../runtime/core/index.ts';
const rules:GameRules<{value:number;target:number},{add:number}>={id:'test',version:'1',create:c=>({value:0,target:Math.floor(c.random()*100)}),validState:(v):v is {value:number;target:number}=>!!v&&Number.isFinite((v as {value:number}).value),validAction:(v):v is {add:number}=>!!v&&Number.isFinite((v as {add:number}).add),reduce:(s,a)=>({...s,value:s.value+a.add}),update:s=>({...s,value:s.value+1}),finished:s=>s.value>=20};
test('fixed game time, immutable inspection, independent pauses, finish and replay',()=>{
 const game=createSession(rules,72);game.command({type:'action',action:{add:5}});assert.equal(game.inspect().state.value,0);
 game.command({type:'start'});game.command({type:'advance',ticks:4});
 game.command({type:'pause',reason:'manual',paused:true});game.command({type:'pause',reason:'hidden',paused:true});
 game.command({type:'pause',reason:'hidden',paused:false});game.command({type:'advance',ticks:60});assert.equal(game.inspect().tick,4);
 game.command({type:'pause',reason:'manual',paused:false});game.command({type:'action',action:{add:16}});assert.equal(game.inspect().phase,'finished');
 const snapshot=game.inspect();snapshot.state.value=999;assert.equal(game.inspect().state.value,20);
 assert.deepEqual(replay(rules,game.exportRecording()).inspect(),game.inspect());
 game.command({type:'pause',reason:'hidden',paused:true});game.command({type:'restart'});game.command({type:'start'});assert.equal(game.inspect().phase,'paused');assert.equal(game.inspect().tick,0);
 game.dispose();assert.throws(()=>game.command({type:'start'}),/disposed/);
});
test('bad input and throwing reducers preserve state, RNG and recording',()=>{
 const broken={...rules,reduce:(s:{value:number;target:number},a:{add:number},c:{random:()=>number})=>{s.value=500;c.random();throw Error('broken');}};
 const game=createSession(broken,1);game.command({type:'start'});const before=game.inspect(),log=game.exportRecording();
 assert.throws(()=>game.command({type:'action',action:{add:1}}),/broken/);assert.deepEqual(game.inspect(),before);assert.deepEqual(game.exportRecording(),log);
 assert.throws(()=>game.command({type:'advance',ticks:Infinity}));assert.throws(()=>game.command({type:'action',action:{add:NaN}}));
 assert.throws(()=>replay(rules,{...log,version:'other'}),/Incompatible/);
});
test('clock partitions, dropped time and first-frame reset are explicit',()=>{
 const a=createFixedClock(),b=createFixedClock();let steps=0;for(let i=0;i<10;i++)steps+=a.frame(10000).steps;
 assert.equal(steps,b.frame(100000).steps);assert.equal(b.frame(1_000_000).droppedTicks,52);
 const clock=createFrameClock();assert.equal(clock.frame(100),0);assert.equal(clock.frame(200),100);clock.reset();assert.equal(clock.frame(10000),0);
});

test('a full recording can restart and preserve pause reasons in a new replayable epoch',()=>{
 const game=createSession(rules,72);game.command({type:'start'});game.command({type:'pause',reason:'hidden',paused:true});
 for(let i=0;i<9998;i++)game.command({type:'action',action:{add:0}});
 assert.throws(()=>game.command({type:'action',action:{add:0}}),/Recording full/);
 game.command({type:'restart'});assert.equal(game.inspect().tick,0);assert.deepEqual(game.inspect().pauseReasons,['hidden']);
 assert.ok(game.exportRecording().commands.length<10);assert.deepEqual(replay(rules,game.exportRecording()).inspect(),game.inspect());
 game.command({type:'start'});assert.equal(game.inspect().phase,'paused');game.command({type:'pause',reason:'hidden',paused:false});assert.equal(game.inspect().phase,'playing');
});

test('failed restart retains the current run and recording',()=>{
 let creates=0;const game=createSession({...rules,create:c=>{if(creates++)throw Error('reset failed');return rules.create(c);}},42);game.command({type:'start'});game.command({type:'advance',ticks:3});const before=game.inspect(),recording=game.exportRecording();assert.throws(()=>game.command({type:'restart'}),/reset failed/);assert.deepEqual(game.inspect(),before);assert.deepEqual(game.exportRecording(),recording);
});

test('durable checkpoint restores state/tick/RNG without history or environmental pauses',async()=>{
 const {restoreSession,isCheckpoint}=await import('../../runtime/core/index.ts');
 const randomRules={...rules,update:(s:{value:number;target:number},c:{random:()=>number})=>({...s,value:s.value+1,target:Math.floor(c.random()*10000)})};
 const original=createSession(randomRules,31);original.command({type:'start'});original.command({type:'advance',ticks:7});original.command({type:'pause',reason:'hidden',paused:true});const checkpoint=original.exportCheckpoint();assert.equal(isCheckpoint(randomRules,checkpoint),true);assert.equal(Object.hasOwn(checkpoint,'commands'),false);
 const restored=restoreSession(randomRules,checkpoint);assert.deepEqual(restored.inspect().state,original.inspect().state);assert.equal(restored.inspect().tick,7);assert.equal(restored.inspect().phase,'playing');assert.deepEqual(restored.inspect().pauseReasons,[]);assert.equal(restored.exportRecording().commands.length,0);assert.equal(restored.exportRecording().format,2);
 original.command({type:'pause',reason:'hidden',paused:false});for(const game of [original,restored])game.command({type:'advance',ticks:4});assert.deepEqual(restored.inspect(),original.inspect());assert.deepEqual(replay(randomRules,restored.exportRecording()).inspect(),restored.inspect());
 checkpoint.state.value=500;assert.notEqual(restored.inspect().state.value,500);assert.throws(()=>restoreSession(randomRules,{...checkpoint,tick:-1}));assert.throws(()=>restoreSession(randomRules,{...checkpoint,version:'future'}));assert.throws(()=>replay(randomRules,{...restored.exportRecording(),seed:32}));
 restored.command({type:'restart'});assert.equal(restored.exportRecording().format,1);assert.deepEqual(replay(randomRules,restored.exportRecording()).inspect(),restored.inspect());restored.dispose();assert.throws(()=>restored.exportCheckpoint(),/disposed/);
});

test('checkpoint-origin failed restart preserves baseline, state, and replay',async()=>{
 const {restoreSession}=await import('../../runtime/core/index.ts');const original=createSession(rules,3);original.command({type:'start'});original.command({type:'advance',ticks:2});
 const broken={...rules,create:()=>{throw Error('reset broken');}},game=restoreSession(broken,original.exportCheckpoint());const before=game.inspect(),recording=game.exportRecording();assert.throws(()=>game.command({type:'restart'}));assert.deepEqual(game.inspect(),before);assert.deepEqual(game.exportRecording(),recording);assert.deepEqual(replay(broken,recording).inspect(),before);
});
