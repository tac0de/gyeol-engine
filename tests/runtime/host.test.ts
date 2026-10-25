import test from 'node:test';import assert from 'node:assert/strict';import {mountBrowserGame} from '../../runtime/browser/host.ts';import type {GameRules} from '../../runtime/core/index.ts';
test('on-change skips idle high-refresh draws while preserving state, recording, inputs and resize',()=>{
 const old={window:globalThis.window,document:globalThis.document,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,resize:globalThis.ResizeObserver};
 class Element extends EventTarget{dataset:Record<string,string>={};focus(){}hasPointerCapture(){return false;}releasePointerCapture(){}}
 let resized=()=>{};class Resize{constructor(fn:()=>void){resized=fn;}observe(){}disconnect(){}}
 globalThis.window=Object.assign(new EventTarget(),{devicePixelRatio:1}) as unknown as Window&typeof globalThis;
 globalThis.document=Object.assign(new EventTarget(),{hidden:false}) as unknown as Document;globalThis.ResizeObserver=Resize as unknown as typeof ResizeObserver;
 let id=0;const pending=new Map<number,FrameRequestCallback>();globalThis.requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};globalThis.cancelAnimationFrame=key=>{pending.delete(key);};
 const rules:GameRules<{n:number},number>={id:'probe',version:'1',create:()=>({n:0}),validState:(v):v is {n:number}=>!!v&&typeof v==='object',validAction:(v):v is number=>typeof v==='number',reduce:(s,a)=>({n:s.n+a}),update:s=>({n:s.n+1}),finished:()=>false};
 function run(mode?:'on-change'){
  let draws=0;const host=mountBrowserGame(new Element() as unknown as HTMLElement,{rules,width:100,height:100,renderMode:mode,input:()=>undefined,render(){draws++;}});host.command({type:'start'});draws=0;
  for(let i=0;i<=240;i++){const entry=pending.entries().next().value!;pending.delete(entry[0]);entry[1](i*1000/120);}
  const rendered=draws,snapshot=host.inspect(),recording=host.exportRecording();resized();assert.equal(draws,rendered+1);host.command({type:'action',action:2});assert.equal(draws,rendered+2);host.dispose();assert.equal(pending.size,0);return {rendered,snapshot,recording};
 }
 try{const all=run(),changed=run('on-change');assert.deepEqual(changed.snapshot,all.snapshot);assert.deepEqual(changed.recording,all.recording);assert.equal(all.rendered,241);assert.ok(changed.rendered<all.rendered*.6);console.log(JSON.stringify({all:all.rendered,onChange:changed.rendered,tick:changed.snapshot.tick,scope:'controlled 120Hz trace; not device FPS'}));}
 finally{Object.assign(globalThis,{window:old.window,document:old.document,requestAnimationFrame:old.raf,cancelAnimationFrame:old.cancel,ResizeObserver:old.resize});}
});
