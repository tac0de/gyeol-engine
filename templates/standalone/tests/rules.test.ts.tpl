import test from 'node:test';import assert from 'node:assert/strict';
import {createSession,replay} from '@thedivineparadox/game-engine/runtime';import {rules,solution,START} from '../src/rules.ts';
test('actual engine route wins and a JSON roundtrip reproduces the full snapshot',()=>{
 const s=createSession(rules,17);s.command({type:'start'});
 for(const action of solution()){s.command({type:'advance',ticks:6});s.command({type:'action',action});}
 assert.equal(s.inspect().phase,'finished');assert.equal(s.inspect().state.lit.length,3);
 const restored=replay(rules,JSON.parse(JSON.stringify(s.exportRecording())));assert.deepEqual(restored.inspect(),s.inspect());
});
test('wall collision, pause, incompatible recording, and restart preserve real boundaries',()=>{
 const s=createSession(rules);s.command({type:'start'});s.command({type:'action',action:{direction:'left'}});assert.equal(s.inspect().state.position,START);
 s.command({type:'pause',reason:'manual',paused:true});s.command({type:'action',action:{direction:'right'}});assert.equal(s.inspect().state.moves,0);
 assert.throws(()=>replay(rules,{...s.exportRecording(),version:'future'}));
 s.command({type:'restart'});assert.equal(s.inspect().state.moves,0);assert.equal(s.inspect().tick,0);assert.deepEqual(replay(rules,s.exportRecording()).inspect(),s.inspect());
});
