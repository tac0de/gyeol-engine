/** Asset specification drafts, not image generation, native production or visual approval. */
import fs from 'node:fs';
export type AssetKind='image'|'animation'|'ui-frame';
type Size={width:number|null;height:number|null};
type Point={x:number|null;y:number|null};
export interface AssetBrief {
 version:1;kind:AssetKind;game:string|null;id:string|null;purpose:string|null;visualBrief:string|null;
 canvas:Size;
 source:{imagegen:string|null;aseprite:string|null;references:string[]};
 output:{prefix:string|null;scale:number|null;palette:string[]|'preserve'|null;alpha:'binary'|'preserve'|null};
 animation?:{pivot:Point;frames:{id:string;durationMs:number}[];clips:Record<string,{from:string;to:string;loop:boolean}>};
 uiFrame?:{resize:'fixed'|'nine-slice'|null;insets:{left:number|null;top:number|null;right:number|null;bottom:number|null};regions:{id:string;x:number;y:number;width:number;height:number}[];targetSizes:Size[]};
}
const kinds:AssetKind[]=['image','animation','ui-frame'];
export function assetBriefTemplate(kind:AssetKind):AssetBrief{
 if(!kinds.includes(kind))throw Error('Asset kind must be image, animation or ui-frame');
 // Resolve from the shipped dist/tools entry, never from the consumer working directory.
 return JSON.parse(fs.readFileSync(new URL(`../../templates/asset-production/${kind}.json`,import.meta.url),'utf8'));
}
export function reviewAssetBrief(value:unknown){
 const issues:string[]=[];
 const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const shape=(v:unknown,keys:string[],at:string):Record<string,any>=>{
  if(!object(v)){issues.push(`${at}: object required`);return {};}
  for(const key of Object.keys(v))if(!keys.includes(key))issues.push(`${at}.${key}: unknown field`);
  for(const key of keys)if(!(key in v))issues.push(`${at}.${key}: missing field`);
  return v;
 };
 const text=(v:unknown,at:string)=>{if(typeof v!=='string'||!v.trim()||v.length>8192)issues.push(`${at}: specify text`);};
 const integer=(v:unknown,min:number,max:number,at:string):v is number=>{
  const valid=typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
  if(!valid)issues.push(`${at}: integer ${min}..${max} required`);return valid;
 };
 const id=(v:unknown,at:string)=>{if(typeof v!=='string'||!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(v)||v.length>64)issues.push(`${at}: specify a lowercase asset identifier`);};
 const relative=(v:unknown,at:string)=>{
  if(typeof v!=='string'||!v||v.includes('\\')||/[:\u0000-\u001f]/.test(v)||v.split('/').some(p=>!p||p==='.'||p==='..'))issues.push(`${at}: canonical project-relative path required`);
 };
 if(!object(value))return {status:'incomplete' as const,issues:['brief: object required'],scope:'specification_only' as const,visualReview:'unverified' as const};
 const kind=value.kind;
 const keys=['version','kind','game','id','purpose','visualBrief','canvas','source','output'];
 if(kind==='animation')keys.push('animation');if(kind==='ui-frame')keys.push('uiFrame');
 const p=shape(value,keys,'brief');
 if(p.version!==1)issues.push('version: expected 1');
 if(!kinds.includes(kind))issues.push('kind: expected image, animation or ui-frame');
 id(p.game,'game');id(p.id,'id');text(p.purpose,'purpose');text(p.visualBrief,'visualBrief');
 const canvas=shape(p.canvas,['width','height'],'canvas');
 const width=integer(canvas.width,1,4096,'canvas.width')?canvas.width:0;
 const height=integer(canvas.height,1,4096,'canvas.height')?canvas.height:0;
 const source=shape(p.source,['imagegen','aseprite','references'],'source');
 relative(source.imagegen,'source.imagegen');relative(source.aseprite,'source.aseprite');
 if(typeof source.aseprite==='string'&&!source.aseprite.endsWith('.aseprite'))issues.push('source.aseprite: .aseprite source required');
 if(source.imagegen===source.aseprite&&source.imagegen!=null)issues.push('source: generated and editable source paths must differ');
 if(!Array.isArray(source.references)||source.references.length>64)issues.push('source.references: array of at most 64 paths required');
 else source.references.forEach((v:unknown,i:number)=>relative(v,`source.references[${i}]`));
 const out=shape(p.output,['prefix','scale','palette','alpha'],'output');
 if(typeof out.prefix!=='string'||typeof p.game!=='string'||!out.prefix.startsWith(`/assets/${p.game}/`)||!/^[a-zA-Z0-9_/-]+$/.test(out.prefix)||out.prefix.split('/').slice(1).some((v:string)=>!v||v==='.'||v==='..'))issues.push('output.prefix: extensionless /assets/GAME/... prefix required');
 integer(out.scale,1,64,'output.scale');
 if(out.palette!=='preserve'&&(!Array.isArray(out.palette)||out.palette.length<1||out.palette.length>256||out.palette.some((v:unknown)=>typeof v!=='string'||!/^#[a-f0-9]{6}$/i.test(v))||new Set(out.palette.map((v:unknown)=>String(v).toLowerCase())).size!==out.palette.length))issues.push('output.palette: specify preserve or 1..256 unique #RRGGBB colors');
 if(!['binary','preserve'].includes(out.alpha))issues.push('output.alpha: specify binary or preserve');
 if(kind==='animation'){
  const a=shape(p.animation,['pivot','frames','clips'],'animation');
  const pivot=shape(a.pivot,['x','y'],'animation.pivot');integer(pivot.x,0,width,'animation.pivot.x');integer(pivot.y,0,height,'animation.pivot.y');
  const frames=Array.isArray(a.frames)?a.frames:[];
  if(!frames.length||frames.length>4096)issues.push('animation.frames: specify 1..4096 frames');
  const ids:string[]=[];
  for(const [i,f] of frames.entries()){
   const frame=shape(f,['id','durationMs'],`animation.frames[${i}]`);id(frame.id,`animation.frames[${i}].id`);integer(frame.durationMs,1,65535,`animation.frames[${i}].durationMs`);
   if(typeof frame.id==='string'){if(ids.includes(frame.id))issues.push('animation.frames: duplicate frame id');ids.push(frame.id);}
  }
  const clips=object(a.clips)?a.clips:{};const covered=new Set<number>();
  if(!Object.keys(clips).length||Object.keys(clips).length>4096)issues.push('animation.clips: specify 1..4096 named clips');
  for(const [name,v] of Object.entries(clips)){
   id(name,'animation.clips key');const clip=shape(v,['from','to','loop'],`animation.clips.${name}`);
   const from=ids.indexOf(clip.from),to=ids.indexOf(clip.to);
   if(from<0||to<from){issues.push(`animation.clips.${name}: invalid frame range`);continue;}
   if(typeof clip.loop!=='boolean')issues.push(`animation.clips.${name}.loop: boolean required`);
   for(let i=from;i<=to;i++){if(covered.has(i))issues.push('animation.clips: overlapping ranges');covered.add(i);}
  }
  if(covered.size!==ids.length)issues.push('animation.clips: every frame must belong to one clip');
 }
 if(kind==='ui-frame'){
  const f=shape(p.uiFrame,['resize','insets','regions','targetSizes'],'uiFrame');
  if(!['fixed','nine-slice'].includes(f.resize))issues.push('uiFrame.resize: specify fixed or nine-slice');
  const insets=shape(f.insets,['left','top','right','bottom'],'uiFrame.insets');
  let horizontal=0,vertical=0;
  if(f.resize==='nine-slice'){
   for(const key of ['left','right','top','bottom'])integer(insets[key],0,key==='left'||key==='right'?width:height,`uiFrame.insets.${key}`);
   horizontal=(insets.left??0)+(insets.right??0);vertical=(insets.top??0)+(insets.bottom??0);
   if(horizontal>=width||vertical>=height)issues.push('uiFrame.insets: preserve a nonempty center');
  }else if(Object.values(insets).some(v=>v!==null))issues.push('uiFrame.insets: use null for fixed-size frames');
  const regions=Array.isArray(f.regions)?f.regions:[];const names=new Set<string>();
  if(!regions.length||regions.length>64)issues.push('uiFrame.regions: specify 1..64 portrait/text/content safe regions');
  for(const [i,v] of regions.entries()){
   const r=shape(v,['id','x','y','width','height'],`uiFrame.regions[${i}]`);id(r.id,`uiFrame.regions[${i}].id`);
   if(names.has(r.id))issues.push('uiFrame.regions: duplicate id');names.add(r.id);
   integer(r.x,0,width,`uiFrame.regions[${i}].x`);integer(r.y,0,height,`uiFrame.regions[${i}].y`);
   integer(r.width,1,width,`uiFrame.regions[${i}].width`);integer(r.height,1,height,`uiFrame.regions[${i}].height`);
   if(r.x+r.width>width||r.y+r.height>height)issues.push(`uiFrame.regions[${i}]: outside canvas`);
  }
  const sizes=Array.isArray(f.targetSizes)?f.targetSizes:[];
  if(!sizes.length||sizes.length>64)issues.push('uiFrame.targetSizes: specify 1..64 logical display sizes');
  for(const [i,v] of sizes.entries()){
   const size=shape(v,['width','height'],`uiFrame.targetSizes[${i}]`);integer(size.width,1,16384,`uiFrame.targetSizes[${i}].width`);integer(size.height,1,16384,`uiFrame.targetSizes[${i}].height`);
   if(f.resize==='nine-slice'&&(size.width<=horizontal||size.height<=vertical))issues.push(`uiFrame.targetSizes[${i}]: too small for nine-slice borders`);
   if(f.resize==='fixed'&&(size.width!==width||size.height!==height))issues.push(`uiFrame.targetSizes[${i}]: fixed frame must retain its logical canvas size; use output.scale for integer display scale`);
  }
 }
 return {status:issues.length?'incomplete' as const:'specified' as const,issues,scope:'specification_only' as const,visualReview:'unverified' as const};
}
