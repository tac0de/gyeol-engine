import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioScope} from '../../runtime/browser/audio.ts';
test('audio is lazy and a late unlock cannot undo mute or disposal',async()=>{
 const original=globalThis.AudioContext;let creations=0,release:()=>void=()=>{};
 class FakeAudio{
  state='suspended';constructor(){creations++;}
  resume(){return new Promise<void>(resolve=>{release=()=>{if(this.state!=='closed')this.state='running';resolve();};});}
  async suspend(){this.state='suspended';}async close(){this.state='closed';}
 }
 globalThis.AudioContext=FakeAudio as unknown as typeof AudioContext;
 try{
  const audio=createAudioScope();assert.equal(creations,0);
  const unlocking=audio.enable();assert.equal(creations,1);audio.mute();release();assert.equal(await unlocking,false);
  const again=audio.enable();await audio.dispose();release();assert.equal(await again,false);assert.equal(await audio.enable(),false);
 }finally{if(original)globalThis.AudioContext=original;else delete (globalThis as {AudioContext?:typeof AudioContext}).AudioContext;}
});

test('overlapping sound unlocks cannot let an older request suspend the latest one',async()=>{
 const originalAudio=globalThis.AudioContext,originalFetch=globalThis.fetch,originalLocation=globalThis.location;let release:()=>void=()=>{},state='suspended',starts=0,stops=0;
 class FakeAudio{
  get state(){return state;}destination={};currentTime=0;
  async resume(){state='running';}async suspend(){state='suspended';}async close(){state='closed';}
  decodeAudioData(){return new Promise<AudioBuffer>(resolve=>{release=()=>resolve({duration:.2,numberOfChannels:1} as AudioBuffer);});}
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
  createBufferSource(){return {buffer:null,onended:null,connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}
 }
 globalThis.AudioContext=FakeAudio as unknown as typeof AudioContext;globalThis.fetch=(async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(100)})) as unknown as typeof fetch;Object.defineProperty(globalThis,'location',{value:{origin:'https://example.test'},configurable:true});
 try{const audio=createAudioScope({gameId:'demo',clips:{hit:'/assets/demo/r1/hit.wav'}});const first=audio.enable(),second=audio.enable();await new Promise(resolve=>setTimeout(resolve,0));release();assert.deepEqual(await Promise.all([first,second]),[false,true]);assert.equal(state,'running');audio.play('hit');assert.equal(starts,1);audio.mute();assert.equal(stops,1);audio.play('hit');assert.equal(starts,1);await audio.dispose();assert.equal(state,'closed');}
 finally{globalThis.AudioContext=originalAudio;globalThis.fetch=originalFetch;if(originalLocation)Object.defineProperty(globalThis,'location',{value:originalLocation,configurable:true});else Reflect.deleteProperty(globalThis,'location');}
});
