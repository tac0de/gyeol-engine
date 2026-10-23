/// <reference path="../styles.d.ts" />
'use client';
import {useEffect,useRef,useState} from 'react';
import type {GameRules,Json,Snapshot} from '../core/index.ts';
import {mountBrowserGame,type GameInput} from '../browser/host.ts';
import {createAssetScope} from '../browser/assets.ts';
import {createAudioScope} from '../browser/audio.ts';
import './game-surface.css';
export interface GamePresentation<S extends Json,A extends Json>{
 rules:GameRules<S,A>;width:number;height:number;
 input:(event:GameInput)=>A|undefined;
 draw:(context:CanvasRenderingContext2D,snapshot:Snapshot<S>,images:Readonly<Record<string,ImageBitmap>>)=>void;
 assets?:{images:Record<string,string>;sounds:Record<string,string>};
 instruction?:string;
 result?:(state:S)=>string;
 statusLabels?:Record<string,string>;
 cue?:(previous:S,next:S)=>number|string|undefined;
}
/** Optional Canvas2D wrapper. The core/host also support custom DOM, SVG or WebGL views. */
export function GameSurface<S extends Json,A extends Json>({game,locale='ko',preview=false}:{game:GamePresentation<S,A>;locale?:string;preview?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),host=useRef<ReturnType<typeof mountBrowserGame<S,A>>|null>(null),audio=useRef<ReturnType<typeof createAudioScope>|null>(null);
 const [phase,setPhase]=useState('ready'),[error,setError]=useState(''),[sound,setSound]=useState(false),[result,setResult]=useState(''),[retry,setRetry]=useState(0),[loading,setLoading]=useState(!!game.assets),[soundError,setSoundError]=useState(false),[soundLoading,setSoundLoading]=useState(false);const ko=locale==='ko';
 useEffect(()=>{
  setError('');setResult('');setSound(false);setSoundError(false);setSoundLoading(false);setLoading(!!game.assets);let previous:S|undefined,active=true;const images:Record<string,ImageBitmap>={};const assets=createAssetScope(game.rules.id);
  const element=canvas.current!;let instance:ReturnType<typeof mountBrowserGame<S,A>>|null=null;
  const sounds=createAudioScope(game.assets?{gameId:game.rules.id,clips:game.assets.sounds}:undefined);audio.current=sounds;
  async function prepare(){try{
   if(game.assets)await Promise.all(Object.entries(game.assets.images).map(async([id,path])=>{images[id]=await assets.loadImage(path);}));
   if(!active)return;
   const context=element.getContext('2d');if(!context)throw Error('Canvas2D unavailable');
   instance=mountBrowserGame(element,{...game,render(snapshot,viewport){
    const w=Math.round(viewport.width*viewport.dpr),h=Math.round(viewport.height*viewport.dpr);
    if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
    context.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);context.clearRect(0,0,game.width,game.height);context.save();try{game.draw(context,snapshot,images);}finally{context.restore();}
   },changed(snapshot){setPhase(snapshot.phase);setResult(snapshot.phase==='finished'?game.result?.(snapshot.state)??'':'');if(previous&&(snapshot.phase==='playing'||snapshot.phase==='finished')){const cue=game.cue?.(previous,snapshot.state);if(typeof cue==='number')sounds.tone(cue);else if(cue)sounds.play(cue);}previous=snapshot.state;if(['ready','paused','disposed'].includes(snapshot.phase)){sounds.mute();setSound(false);}},failed(failure){void sounds.dispose().catch(()=>{});setError(failure instanceof Error?failure.message:'Game failed');}});
   host.current=instance;setLoading(false);
   if(preview)(element as HTMLCanvasElement&{tdpGame?:unknown}).tdpGame=instance;
  }catch(failure){if(active){void assets.dispose();void sounds.dispose().catch(()=>{});setLoading(false);setError(failure instanceof Error?failure.message:'Game failed');}}}
  void prepare();
  return()=>{active=false;instance?.dispose();void assets.dispose();host.current=null;audio.current=null;delete (element as HTMLCanvasElement&{tdpGame?:unknown}).tdpGame;void sounds.dispose().catch(()=>{});};
 },[game,preview,retry]);
 async function toggleSound(){
  const scope=audio.current;if(!scope)return;if(sound){scope.mute();setSound(false);return;}setSoundLoading(true);
  try{if(await scope.enable()){if(audio.current!==scope)return;if(game.assets){const first=Object.keys(game.assets.sounds)[0];if(first)scope.play(first);}else scope.tone();setSoundError(false);setSound(true);}}
  catch{if(audio.current===scope){setSound(false);setSoundError(true);}}
  finally{if(audio.current===scope)setSoundLoading(false);}
 }
 function start(){host.current?.command({type:'start'});canvas.current?.focus();}
 return <section className="game-surface" aria-label={ko?'게임':'Game'}>
  {preview&&<p className="game-preview-label">{ko?'개발용 초안 · 공개 게임이 아닙니다':'Development draft · not a published game'}</p>}
  {error&&<div><p role="alert">{ko?'게임을 실행하지 못했습니다.':'Game unavailable.'} {error}</p><div className="game-controls"><button onClick={()=>setRetry(value=>value+1)}>{ko?'다시 불러오기':'Reload game'}</button></div></div>}
  <div hidden={!!error}>
   <canvas ref={canvas} tabIndex={0} aria-label={game.instruction??(ko?'게임 화면. 스페이스 또는 터치로 조작합니다.':'Game surface. Use touch or Space.')} style={{aspectRatio:`${game.width}/${game.height}`}}/>
   {game.instruction&&<p className="arcade-instruction">{game.instruction}</p>}
   <div className="game-controls">
    {phase==='ready'?<button disabled={loading} onClick={start}>{loading?(ko?'그림 불러오는 중…':'Loading art…'):(ko?'시작':'Start')}</button>:phase==='finished'?<button onClick={()=>{host.current?.command({type:'restart'});start();}}>{ko?'다시 하기':'Restart'}</button>:<button onClick={()=>host.current?.pause(phase!=='paused')}>{ko?(phase==='paused'?'계속':'일시정지'):(phase==='paused'?'Resume':'Pause')}</button>}
    <button aria-pressed={sound} disabled={loading||soundLoading} onClick={toggleSound}>{ko?(sound?'소리 끄기':soundLoading?'소리 불러오는 중…':'소리 켜기'):(sound?'Mute':soundLoading?'Loading sound…':'Enable sound')}</button>
    {soundError&&<span role="status">{ko?'소리를 불러오지 못했습니다. 다시 눌러주세요.':'Sound unavailable. Try again.'}</span>}
    <output aria-live="polite" data-testid="game-status">{result||game.statusLabels?.[phase]||phase}</output>
   </div>
  </div>
 </section>;
}
