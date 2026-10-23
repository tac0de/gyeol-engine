import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,replay} from '@thedivineparadox/game-engine/runtime/core';
import {rules} from './rules.ts';
test('same rules run without browser and replay accepted input',()=>{
 const game=createSession(rules,42);game.command({type:'start'});
 game.command({type:'action',action:{type:'hold',held:true}});game.command({type:'advance',ticks:30});
 game.command({type:'action',action:{type:'hold',held:false}});
 assert.equal(game.inspect().phase,'finished');assert.equal(game.inspect().state.score,1);
 assert.deepEqual(replay(rules,game.exportRecording()).inspect(),game.inspect());
});
