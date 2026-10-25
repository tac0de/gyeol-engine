export type AnimationSettlement={status:'finished'|'cancelled'|'aborted'|'timeout';count:number;ignored:number};
/** Observe the current finite batch only. Never cancel unrelated browser animations. */
export function settleAnimations(root:Element,options:{signal?:AbortSignal;timeoutMs?:number}={}):Promise<AnimationSettlement>{
 const timeout=options.timeoutMs??5000;
 if(!Number.isFinite(timeout)||timeout<1||timeout>60000)throw Error('Invalid animation deadline');
 const all=root.getAnimations({subtree:true}),animations=all.filter(animation=>Number.isFinite(animation.effect?.getComputedTiming().endTime));
 const base={count:animations.length,ignored:all.length-animations.length};
 if(options.signal?.aborted)return Promise.resolve({...base,status:'aborted'});
 if(!animations.length)return Promise.resolve({...base,status:'finished'});
 return new Promise(resolve=>{
  let settled=false;const timer=setTimeout(()=>finish('timeout'),timeout);
  const aborted=()=>finish('aborted');
  function finish(status:AnimationSettlement['status']){if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',aborted);resolve({...base,status});}
  options.signal?.addEventListener('abort',aborted,{once:true});
  void Promise.allSettled(animations.map(animation=>animation.finished)).then(results=>finish(results.some(result=>result.status==='rejected')?'cancelled':'finished'));
 });
}
