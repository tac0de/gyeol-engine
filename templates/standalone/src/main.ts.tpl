import './style.css';
import {mountBrowserGame,type GameInput} from '@thedivineparadox/game-engine/runtime/browser/host';
import {createSession,replay,type Snapshot,type Recording} from '@thedivineparadox/game-engine/runtime';
import {rules,WIDTH,HEIGHT,WALLS,NODES,EXIT,type State,type Action} from './rules.ts';
const board=document.querySelector<HTMLCanvasElement>('#board')!,ctx=board.getContext('2d')!;
const text=(id:string,value:string)=>{document.getElementById(id)!.textContent=value;};
const start=document.querySelector<HTMLButtonElement>('#start')!,play=document.querySelector<HTMLButtonElement>('#replay')!,save=document.querySelector<HTMLButtonElement>('#export')!,load=document.querySelector<HTMLInputElement>('#import')!;
let showingReplay=false,timer:ReturnType<typeof setTimeout>|undefined,recording:Recording<Action>|undefined,playback:ReturnType<typeof createSession<State,Action>>|undefined;
const directionKeys:Record<string,Action['direction']>={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
function render(s:Snapshot<State>){
 ctx.fillStyle='#172524';ctx.fillRect(0,0,720,400);
 const cell=64,ox=72,oy=40;
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const p=y*WIDTH+x,cx=ox+x*cell+32,cy=oy+y*cell+32;
  if(WALLS.includes(p)){ctx.fillStyle='#233630';ctx.fillRect(cx-2,cy-2,4,4);continue;}
  ctx.fillStyle='#1f3931';ctx.fillRect(cx-27,cy-27,54,54);
  ctx.strokeStyle='#345749';ctx.lineWidth=1;ctx.strokeRect(cx-27.5,cy-27.5,55,55);
  if(NODES.includes(p)){
   const lit=s.state.lit.includes(p);ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.strokeStyle=lit?'#ffe1a8':'#b7935c';ctx.fillStyle=lit?'#e9bb72':'#172524';ctx.lineWidth=2;ctx.fillRect(-9,-9,18,18);ctx.strokeRect(-9,-9,18,18);ctx.restore();
   if(lit){ctx.strokeStyle='#8d784f';ctx.strokeRect(cx-20,cy-20,40,40);}
  }
  if(p===EXIT){ctx.strokeStyle='#7bceaa';ctx.lineWidth=2;ctx.strokeRect(cx-17,cy-17,34,34);ctx.fillStyle='#7bceaa';ctx.font='14px monospace';ctx.textAlign='center';ctx.fillText('↗',cx,cy+5);}
  if(p===s.state.position){ctx.fillStyle='#edf0da';ctx.beginPath();ctx.arc(cx,cy,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#edf0da';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy,15,0,Math.PI*2);ctx.stroke();}
 }
 text('nodes',s.state.lit.length+' / 3');text('moves',String(s.state.moves).padStart(2,'0'));text('phase',showingReplay?'Replaying trail':s.state.won?'Circuit complete':s.phase==='ready'?'Ready to connect':s.phase==='paused'?'Paused · return to the field':'Signal active');
 board.dataset.phase=s.phase;board.dataset.position=String(s.state.position);board.dataset.won=String(s.state.won);board.dataset.mode=showingReplay?'replay':'live';
}
function input(e:GameInput):Action|undefined{
 if(showingReplay)return;
 if(e.type==='key'&&e.pressed&&directionKeys[e.key])return {direction:directionKeys[e.key]};
 if(e.type==='pointer'&&e.phase==='up'){
  const x=Math.floor((e.x-72)/64),y=Math.floor((e.y-40)/64);if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return;
  const p=host.inspect().state.position,d=x+y*WIDTH-p;
  if(Math.abs(x-p%WIDTH)+Math.abs(y-Math.floor(p/WIDTH))===1)return {direction:d===1?'right':d===-1?'left':d===WIDTH?'down':'up'};
 }
}
const host=mountBrowserGame(board,{rules,seed:17,width:720,height:400,input,render:s=>{if(!showingReplay)render(s);},changed:s=>{
 if(s.state.moves>0){save.disabled=false;play.disabled=false;}
 if(s.state.won&&!showingReplay)text('message',`All three nodes are awake. Connected in ${s.state.moves} moves. Keep your trail or start a new circuit.`);
},failed:error=>text('message','Could not continue: '+String(error))});
function stopPlayback(){if(timer)clearTimeout(timer);timer=undefined;playback?.dispose();playback=undefined;showingReplay=false;}
start.addEventListener('click',()=>{stopPlayback();delete board.dataset.replayVerified;recording=undefined;host.command({type:'restart'});host.pause(false);host.command({type:'start'});board.focus();start.innerHTML='Restart circuit <span>↗</span>';save.disabled=true;play.disabled=true;text('message','Use the arrow keys, or click a neighbouring tile. Light all three nodes before heading home.');});
function currentRecording(){return recording??host.exportRecording();}
play.addEventListener('click',()=>{
 const data=currentRecording();const verified=replay(rules,data);const expected=JSON.stringify(verified.inspect());verified.dispose();stopPlayback();delete board.dataset.replayVerified;recording=data;host.pause(true);showingReplay=true;playback=createSession(rules,data.seed);let index=0;play.disabled=true;
 function step(){
  if(!playback)return;
  // Advance and environmental commands belong to the same recording, but only actions need a visual beat.
  while(index<data.commands.length){const c=data.commands[index++];playback.command(c);render(playback.inspect());if(c.type==='action'){timer=setTimeout(step,130);return;}}
  const equal=JSON.stringify(playback.inspect())===expected;text('message',equal?'Trail replayed exactly. Every move and node matches.':'Replay mismatch.');play.disabled=false;board.dataset.replayVerified=String(equal);text('phase','Trail complete');
 }step();
});
save.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(currentRecording(),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='__PROJECT_ID__-trail.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);});
load.addEventListener('change',async()=>{
 try{const file=load.files?.[0];if(!file)return;if(file.size>1_000_000)throw Error('Trail exceeds 1 MB');const data=JSON.parse(await file.text()),verified=replay(rules,data);stopPlayback();host.pause(true);recording=data;showingReplay=true;playback=verified;render(verified.inspect());save.disabled=false;play.disabled=false;text('message','Trail imported and verified. Replay it to follow the route.');}
 catch(error){text('message','Could not import trail: '+(error instanceof Error?error.message:String(error)));}finally{load.value='';}
});
window.addEventListener('pagehide',()=>{stopPlayback();host.dispose();},{once:true});
