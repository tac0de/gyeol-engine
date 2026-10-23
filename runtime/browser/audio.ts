/** Scoped, gesture-unlocked sound. Buffer sources are owned and stopped on mute. */
export function createAudioScope(options?:{gameId:string;clips:Record<string,string>}){
 let context:AudioContext|undefined,muted=true,desired=false,disposed=false,generation=0;const abort=new AbortController(),buffers=new Map<string,AudioBuffer>(),sources=new Map<AudioScheduledSourceNode,GainNode>();let loading:Promise<void>|undefined;
 function stop(){for(const [source,gain] of sources){try{source.stop();}catch{/* Already ended. */}source.disconnect();gain.disconnect();}sources.clear();}
 function own(source:AudioScheduledSourceNode,gain:GainNode){if(sources.size>=8){source.disconnect();gain.disconnect();return false;}sources.set(source,gain);source.onended=()=>{sources.delete(source);source.disconnect();gain.disconnect();};return true;}
 async function load(){
  if(!options)return;await Promise.all(Object.entries(options.clips).map(async([id,path])=>{if(buffers.has(id))return;const url=new URL(path,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/assets/'+options.gameId+'/'))throw Error('Sound must belong to this game');
   const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw Error('Sound unavailable: '+response.status);const bytes=await response.arrayBuffer();if(bytes.byteLength>1_000_000)throw Error('Sound byte budget exceeded');const buffer=await context!.decodeAudioData(bytes);if(disposed)throw new DOMException('Sound scope disposed','AbortError');if(buffer.duration>8||buffer.numberOfChannels>2)throw Error('Unsupported sound clip');buffers.set(id,buffer);
  }));
 }
 return {
  async enable(){if(disposed)return false;const version=++generation;desired=true;context??=new AudioContext();await context.resume();try{loading??=load().catch(error=>{loading=undefined;throw error;});await loading;}catch(error){if(!disposed&&generation===version){desired=false;muted=true;stop();if(context.state==='running')await context.suspend();}throw error;}
   if(disposed||generation!==version){if(!disposed&&!desired&&context.state==='running')await context.suspend();return false;}muted=false;return true;},
  mute(){generation++;desired=false;muted=true;stop();void context?.suspend().catch(()=>{});},
  play(id:string){if(disposed||muted||!context||context.state!=='running')return;const buffer=buffers.get(id);if(!buffer)return;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(context.destination);if(own(source,gain))source.start();},
  tone(frequency=440,duration=.08){
   if(disposed||muted||!context||context.state!=='running')return;const oscillator=context.createOscillator(),gain=context.createGain();oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.04,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+duration);oscillator.connect(gain);gain.connect(context.destination);if(own(oscillator,gain)){oscillator.start();oscillator.stop(context.currentTime+duration);}
  },
  async dispose(){if(disposed)return;disposed=true;generation++;desired=false;muted=true;abort.abort();stop();buffers.clear();if(context&&context.state!=='closed')await context.close();if(loading)await Promise.allSettled([loading]);},
 };
}
