import {createSession,restoreSession,createFrameClock,createFixedClock,type GameRules,type Json,type Command,type Snapshot} from '../core/index.ts';
export type GameInput={type:'pointer';phase:'down'|'move'|'up'|'cancel';x:number;y:number}|{type:'key';key:string;pressed:boolean;cancelled?:boolean};
export type Viewport={width:number;height:number;dpr:number};
export function mountBrowserGame<S extends Json,A extends Json>(element:HTMLElement,options:{
 rules:GameRules<S,A>;seed?:number;width:number;height:number;
 input:(event:GameInput)=>A|undefined;
 render:(snapshot:Snapshot<S>,viewport:Viewport)=>void;
 changed?:(snapshot:Snapshot<S>)=>void;failed?:(error:unknown)=>void;
 renderMode?:'every-frame'|'on-change';
}){
 const {width,height}=options;
 if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)throw Error('Invalid logical viewport');
 if(options.renderMode!==undefined&&!['every-frame','on-change'].includes(options.renderMode))throw Error('Invalid render mode');
 let session=createSession(options.rules,options.seed);const frame=createFrameClock(),clock=createFixedClock();
 const abort=new AbortController();let raf=0,disposed=false,pointer:number|null=null,last={x:0,y:0},lastPhase:Snapshot<S>['phase']='ready';
 const keys=new Set<string>();
 function draw(snapshot=session.inspect()){options.render(snapshot,{width,height,dpr:Math.min(window.devicePixelRatio||1,2)});}
 function notify(snapshot=session.inspect()){lastPhase=snapshot.phase;element.dataset.phase=snapshot.phase;element.dataset.tick=String(snapshot.tick);options.changed?.(snapshot);draw(snapshot);}
 function fail(error:unknown){dispose();options.failed?.(error);}
 function schedule(){if(!disposed&&!raf&&lastPhase==='playing')raf=requestAnimationFrame(loop);}
 function loop(now:number){
  raf=0;if(disposed)return;
  try{const steps=clock.frame(Math.round(frame.frame(now)*1000)).steps;if(steps)notify(session.command({type:'advance',ticks:steps}));else if(options.renderMode!=='on-change')notify();schedule();}catch(error){fail(error);}
 }
 function command(c:Command<A>){
  if(disposed)throw Error('Host disposed');
  try{const result=session.command(c);frame.reset();clock.reset();if(raf)cancelAnimationFrame(raf);raf=0;notify(result);schedule();return result;}catch(error){fail(error);throw error;}
 }
 function input(event:GameInput){const action=options.input(event);return action===undefined?undefined:session.command({type:'action',action});}
 function clearInput(dispatch=true){
  const cancel=(event:GameInput)=>dispatch?input(event):options.input(event);
  if(pointer!==null){const id=pointer;pointer=null;cancel({type:'pointer',phase:'cancel',...last});if(element.hasPointerCapture(id))element.releasePointerCapture(id);}
  for(const key of keys)cancel({type:'key',key,pressed:false,cancelled:true});keys.clear();
 }
 function paused(reason:string,value:boolean){if(disposed)return;try{if(value)clearInput();command({type:'pause',reason,paused:value});}catch(error){if(!disposed)fail(error);}}
 function point(event:PointerEvent){const rect=element.getBoundingClientRect();return {x:Math.max(0,Math.min(width,(event.clientX-rect.left)*width/(rect.width||1))),y:Math.max(0,Math.min(height,(event.clientY-rect.top)*height/(rect.height||1)))};}
 const listen={signal:abort.signal};
 for(const phase of ['down','move','up','cancel'] as const)element.addEventListener(`pointer${phase}`,raw=>{
  const event=raw as PointerEvent;if(disposed)return;
  try{
  if(phase==='down'){if(pointer!==null||lastPhase!=='playing'||event.button!==0)return;pointer=event.pointerId;element.focus({preventScroll:true});element.setPointerCapture(pointer);}
  if(pointer!==event.pointerId)return;
  event.preventDefault();last=point(event);
  const snapshot=input({type:'pointer',phase,...last});if(phase==='up'||phase==='cancel'){pointer=null;if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);}notify(snapshot);schedule();}catch(error){fail(error);}
 },listen);
 element.addEventListener('lostpointercapture',()=>{if(pointer!==null){try{clearInput();notify();}catch(error){fail(error);}}},listen);
 for(const type of ['keydown','keyup'] as const)element.addEventListener(type,event=>{
  if(event.key!==' '&&!event.key.startsWith('Arrow'))return;
  event.preventDefault();if(event.repeat)return;
  if(type==='keydown'){if(lastPhase!=='playing'||keys.has(event.key))return;keys.add(event.key);}else if(!keys.delete(event.key))return;
  try{notify(input({type:'key',key:event.key,pressed:type==='keydown'}));schedule();}catch(error){fail(error);}
 },listen);
 window.addEventListener('blur',()=>paused('focus',true),listen);
 window.addEventListener('focus',()=>paused('focus',false),listen);
 document.addEventListener('visibilitychange',()=>paused('hidden',document.hidden),listen);
 element.addEventListener('blur',()=>{try{clearInput();notify();}catch(error){fail(error);}},listen);
 const resize=new ResizeObserver(()=>{if(!disposed)try{draw();}catch(error){fail(error);}});resize.observe(element);
 function dispose(){
  if(disposed)return;disposed=true;abort.abort();resize.disconnect();if(raf)cancelAnimationFrame(raf);raf=0;
  // Clear adapter-owned gesture state even after a fatal rule/render failure.
  // Do not dispatch actions into the failed or full core recording on cleanup.
  try{clearInput(false);}catch{/* Cleanup must still release the owned session. */}
  finally{pointer=null;keys.clear();session.dispose();element.dataset.phase='disposed';}
 }
 // Initial visibility is an independent reason, including a restart in a hidden tab.
 try{session.command({type:'pause',reason:'hidden',paused:document.hidden});notify();}catch(error){dispose();throw error;}
 return {command(c:Command<A>){if(c.type==='restart'){const result=command(c);clearInput();return result;}if(c.type==='pause'&&c.paused)clearInput();return command(c);},pause:(value:boolean)=>paused('manual',value),
  inspect:()=>session.inspect(),exportRecording:()=>session.exportRecording(),exportCheckpoint:()=>session.exportCheckpoint(),
  restoreCheckpoint(value:unknown){
   if(disposed)throw Error('Host disposed');const next=restoreSession(options.rules,value);
   try{for(const reason of session.inspect().pauseReasons)next.command({type:'pause',reason,paused:true});next.command({type:'pause',reason:'hidden',paused:document.hidden});clearInput(false);}
   catch(error){next.dispose();throw error;}
   const previous=session;session=next;previous.dispose();frame.reset();clock.reset();if(raf)cancelAnimationFrame(raf);raf=0;
   try{notify();schedule();return session.inspect();}catch(error){fail(error);throw error;}
  },dispose};
}
