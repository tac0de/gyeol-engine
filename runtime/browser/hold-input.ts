import type {GameInput} from './host.ts';
export type HoldAction={type:'hold';held:boolean}|{type:'cancel'};
/** One adapter per mounted game. Mixed input serves only after the last release;
 * interruption cancels the gesture, including any other source still held. */
export function createHoldInput(){
 const held=new Set<'pointer'|'key'>();
 return (event:GameInput):HoldAction|undefined=>{
  if(event.type==='key'&&event.key!==' ')return;
  if(event.type==='pointer'&&event.phase==='move')return;
  if(event.type==='pointer'&&event.phase==='cancel'||event.type==='key'&&event.cancelled){
   const active=held.size>0;held.clear();return active?{type:'cancel'}:undefined;
  }
  const source=event.type==='pointer'?'pointer':'key',pressed=event.type==='pointer'?event.phase==='down':event.pressed;
  const before=held.size>0;
  if(pressed)held.add(source);else held.delete(source);
  const after=held.size>0;return before===after?undefined:{type:'hold',held:after};
 };
}
