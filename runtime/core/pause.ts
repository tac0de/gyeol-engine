// Reused from archive fe7dcc6: portal/engine/core/pause.ts.
/** Clearing one reason must never clear another independent pause. */
export function createPauseController(){
 const reasons=new Set<string>();
 return {set(reason:string,paused:boolean){if(paused)reasons.add(reason);else reasons.delete(reason);},
  isPaused:()=>reasons.size>0,getReasons:()=>[...reasons].sort()};
}
