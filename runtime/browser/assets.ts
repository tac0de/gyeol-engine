/** Same-game owned images. Cache lifetime is the scope; concurrency bounds work, not total decoded bytes. */
export function createAssetScope(gameId:string,options:{concurrency?:number}={}){
 if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(gameId))throw Error('Invalid asset game id');
 const limit=options.concurrency??4;if(!Number.isSafeInteger(limit)||limit<1||limit>32)throw Error('Invalid asset concurrency');
 const abort=new AbortController(),images=new Set<ImageBitmap>(),elements=new Set<HTMLImageElement>();
 const bitmaps=new Map<string,Promise<ImageBitmap>>(),dom=new Map<string,Promise<HTMLImageElement>>(),pending=new Set<Promise<unknown>>();
 const queue:{start:()=>void;reject:(error:unknown)=>void}[]=[];let active=0,disposed=false,disposal:Promise<void>|undefined;
 const stopped=()=>new DOMException('Asset scope disposed','AbortError');
 function url(path:string){const value=new URL(path,location.origin);if(value.origin!==location.origin||!value.pathname.startsWith(`/assets/${gameId}/`)||/%2f|%5c/i.test(value.pathname))throw Error('Asset must belong to this game');return value.href;}
 function pump(){while(!disposed&&active<limit&&queue.length)queue.shift()!.start();}
 function schedule<T>(work:()=>Promise<T>):Promise<T>{return new Promise<T>((resolve,reject)=>{queue.push({reject,start(){active++;void work().then(resolve,reject).finally(()=>{active--;pump();});}});pump();});}
 function cached<T>(map:Map<string,Promise<T>>,path:string,load:(url:string)=>Promise<T>):Promise<T>{
  if(disposed)return Promise.reject(stopped());let key:string;try{key=url(path);}catch(error){return Promise.reject(error);}
  const existing=map.get(key);if(existing)return existing;
  const work=schedule(()=>load(key));map.set(key,work);pending.add(work);
  void work.then(()=>pending.delete(work),()=>{pending.delete(work);if(map.get(key)===work)map.delete(key);});return work;
 }
 return {
  loadImage(path:string){return cached(bitmaps,path,async key=>{
   const response=await fetch(key,{signal:abort.signal});if(!response.ok)throw Error(`Image unavailable: ${response.status}`);
   const image=await createImageBitmap(await response.blob());
   if(disposed){image.close();throw stopped();}images.add(image);return image;
  });},
  /** Warm DOM/CSS image resources without creating a second ImageBitmap copy. */
  loadElement(path:string){return cached(dom,path,key=>new Promise<HTMLImageElement>((resolve,reject)=>{
   const image=new Image();elements.add(image);image.decoding='async';let settled=false;
   function finish(error?:unknown){if(settled)return;settled=true;image.onload=null;image.onerror=null;abort.signal.removeEventListener('abort',cancel);if(error){elements.delete(image);image.removeAttribute('src');reject(error);}else resolve(image);}
   function cancel(){finish(stopped());}
   abort.signal.addEventListener('abort',cancel,{once:true});image.onerror=()=>finish(Error('Image unavailable'));
   image.onload=()=>{try{const decoding=typeof image.decode==='function'?image.decode():Promise.resolve();pending.add(decoding);void decoding.then(()=>{pending.delete(decoding);finish(disposed?stopped():undefined);},error=>{pending.delete(decoding);finish(error);});}catch(error){finish(error);}};image.src=key;
  }));},
  inspect(){return {active,queued:queue.length,bitmaps:bitmaps.size,elements:dom.size,disposed};},
  dispose(){
   if(disposal)return disposal;disposed=true;abort.abort();for(const job of queue.splice(0))job.reject(stopped());
   for(const image of images)image.close();images.clear();for(const image of elements)image.removeAttribute('src');elements.clear();
   bitmaps.clear();dom.clear();disposal=Promise.allSettled([...pending]).then(()=>{});return disposal;
  },
 };
}
