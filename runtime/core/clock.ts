// Adapted from archive fe7dcc6: core/frame.ts and core/simulation/clock.ts.
export function integer(value:number,min:number,max:number,label:string){
 if(!Number.isSafeInteger(value)||value<min||value>max)throw new RangeError(`Invalid ${label}`);
}
export function createFrameClock(maxElapsedMs=250){
 let previous:number|undefined;
 return {frame(now:number){
  if(!Number.isFinite(now))throw new RangeError('Invalid frame time');
  const elapsed=previous===undefined?0:Math.max(0,Math.min(maxElapsedMs,now-previous));previous=now;return elapsed;
 },reset(){previous=undefined;}};
}
export function createFixedClock(tickRate=60,maxStepsPerFrame=8){
 integer(tickRate,1,1000,'tick rate');integer(maxStepsPerFrame,1,600,'step limit');
 let remainder=0;
 return {frame(elapsedUs:number){
  integer(elapsedUs,0,1_000_000,'elapsed microseconds');
  const total=remainder+elapsedUs*tickRate,available=Math.floor(total/1_000_000);remainder=total%1_000_000;
  return {steps:Math.min(available,maxStepsPerFrame),droppedTicks:Math.max(0,available-maxStepsPerFrame)};
 },reset(){remainder=0;}};
}
