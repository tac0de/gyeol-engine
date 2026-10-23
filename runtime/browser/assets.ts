/** Optional same-game image scope; late decode completion is also disposed. */
export function createAssetScope(gameId:string){
 if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(gameId))throw Error('Invalid asset game id');
 const abort=new AbortController(),images=new Set<ImageBitmap>(),pending=new Set<Promise<ImageBitmap>>();let disposed=false;
 return {
  loadImage(path:string){
   if(disposed)return Promise.reject(new Error('Asset scope disposed'));
   const url=new URL(path,location.origin);
   if(url.origin!==location.origin||!url.pathname.startsWith(`/assets/${gameId}/`))return Promise.reject(new Error('Asset must belong to this game'));
   const work=(async()=>{
    const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw Error(`Image unavailable: ${response.status}`);
    const image=await createImageBitmap(await response.blob());
    if(disposed){image.close();throw new DOMException('Asset scope disposed','AbortError');}
    images.add(image);return image;
   })();
   pending.add(work);void work.then(()=>pending.delete(work),()=>pending.delete(work));return work;
  },
  async dispose(){disposed=true;abort.abort();for(const image of images)image.close();images.clear();await Promise.allSettled([...pending]);},
 };
}
