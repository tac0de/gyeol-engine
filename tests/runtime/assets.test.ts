import test from 'node:test';import assert from 'node:assert/strict';
import {createAssetScope} from '../../runtime/browser/assets.ts';
test('same canonical URL shares one decode, failed loads retry, and scope disposal closes once',async()=>{
 const previous={fetch:globalThis.fetch,location:globalThis.location,decode:globalThis.createImageBitmap};let requests=0,decodes=0,closes=0,fail=true;
 globalThis.location={origin:'http://assets.test'} as Location;
 globalThis.fetch=(async()=>{requests++;return {ok:!fail,status:500,blob:async()=>new Blob()} as Response;}) as typeof fetch;
 globalThis.createImageBitmap=(async()=>{decodes++;return {close(){closes++;}} as ImageBitmap;}) as typeof createImageBitmap;
 try{const scope=createAssetScope('probe');await assert.rejects(scope.loadImage('/assets/probe/tile.png'));fail=false;
 const a=scope.loadImage('/assets/probe/tile.png'),b=scope.loadImage('http://assets.test/assets/probe/tile.png');assert.equal(a,b);assert.equal(await a,await b);assert.equal(requests,2);assert.equal(decodes,1);
 await assert.rejects(scope.loadImage('/assets/other/tile.png'));await assert.rejects(scope.loadImage('/assets/probe/%2f../other/tile.png'));assert.equal(requests,2);
 await scope.dispose();await scope.dispose();assert.equal(closes,1);await assert.rejects(scope.loadImage('/assets/probe/tile.png'));
 }finally{globalThis.fetch=previous.fetch;globalThis.location=previous.location;globalThis.createImageBitmap=previous.decode;}
});
test('queue limit and late decode disposal preserve owned lifetime',async()=>{
 const old={fetch:globalThis.fetch,location:globalThis.location,decode:globalThis.createImageBitmap};let requests=0,release!:()=>void,closed=0;
 globalThis.location={origin:'http://assets.test'} as Location;
 globalThis.fetch=(async()=>{requests++;return {ok:true,blob:async()=>new Blob()} as Response;}) as typeof fetch;
 globalThis.createImageBitmap=(()=>new Promise<ImageBitmap>(resolve=>{release=()=>resolve({close(){closed++;}} as ImageBitmap);})) as typeof createImageBitmap;
 try{const scope=createAssetScope('probe',{concurrency:1});const a=scope.loadImage('/assets/probe/a.png'),b=scope.loadImage('/assets/probe/b.png');const results=Promise.allSettled([a,b]);
 await new Promise(r=>setImmediate(r));assert.equal(requests,1);assert.equal(scope.inspect().queued,1);const disposal=scope.dispose();release();await disposal;assert.equal(closed,1);assert.equal(requests,1);assert.ok((await results).every(x=>x.status==='rejected'));assert.equal(scope.inspect().active,0);
 }finally{globalThis.fetch=old.fetch;globalThis.location=old.location;globalThis.createImageBitmap=old.decode;}
});
test('DOM decode is part of disposal barrier and does not revive an aborted element',async()=>{
 const oldImage=globalThis.Image,oldLocation=globalThis.location;let release!:()=>void,last:FakeImage;
 class FakeImage{decoding='';onload:(()=>void)|null=null;onerror:(()=>void)|null=null;value='';constructor(){last=this;}set src(value:string){this.value=value;queueMicrotask(()=>this.onload?.());}removeAttribute(){this.value='';}decode(){return new Promise<void>(resolve=>{release=resolve;});}}
 globalThis.Image=FakeImage as unknown as typeof Image;globalThis.location={origin:'http://assets.test'} as Location;
 try{const scope=createAssetScope('probe');const work=scope.loadElement('/assets/probe/dom.png'),observed=Promise.allSettled([work]);await new Promise(r=>setImmediate(r));let done=false;const disposal=scope.dispose().then(()=>{done=true;});await new Promise(r=>setImmediate(r));assert.equal(done,false);assert.equal(last!.value,'');release();await disposal;assert.equal((await observed)[0].status,'rejected');}
 finally{globalThis.Image=oldImage;globalThis.location=oldLocation;}
});
