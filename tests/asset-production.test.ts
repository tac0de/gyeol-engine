import test from 'node:test';
import assert from 'node:assert/strict';
import {assetBriefTemplate,reviewAssetBrief,type AssetBrief,type AssetKind} from '@thedivineparadox/game-engine/tools/asset-production';
function specified(kind:AssetKind):AssetBrief{
 const p=assetBriefTemplate(kind);
 Object.assign(p,{game:'fixture',id:'portrait',purpose:'Technical fixture only',visualBrief:'Preserve the supplied fixture silhouette; no production art decision',canvas:{width:64,height:96},source:{imagegen:'art/original.png',aseprite:'art/refined.aseprite',references:[]},output:{prefix:'/assets/fixture/r1/portrait',scale:2,palette:['#112233','#f0e0d0'],alpha:'binary'}});
 if(p.animation)p.animation={pivot:{x:32,y:95},frames:[{id:'idle-0',durationMs:100},{id:'idle-1',durationMs:150}],clips:{idle:{from:'idle-0',to:'idle-1',loop:true}}};
 if(p.uiFrame)p.uiFrame={resize:'nine-slice',insets:{left:8,top:8,right:8,bottom:8},regions:[{id:'portrait',x:8,y:8,width:48,height:56},{id:'title',x:8,y:68,width:48,height:20}],targetSizes:[{width:64,height:96},{width:96,height:128}]};
 return p;
}
test('shipped drafts preserve undecided art, dimensions and timing; each request returns an independent copy',()=>{
 for(const kind of ['image','animation','ui-frame'] as const){
  const draft=assetBriefTemplate(kind);assert.equal(draft.canvas.width,null);assert.equal(draft.visualBrief,null);
  const result=reviewAssetBrief(draft);assert.equal(result.status,'incomplete');assert.ok(result.issues.some(x=>x.includes('canvas.width')));assert.equal(result.visualReview,'unverified');
  draft.canvas.width=999;assert.equal(assetBriefTemplate(kind).canvas.width,null);
 }
 assert.throws(()=>assetBriefTemplate('unknown' as AssetKind),/kind/);
});
test('specified image briefs remain specifications; malformed input and mismatched output paths are diagnosed',()=>{
 const p=specified('image');assert.deepEqual(reviewAssetBrief(p),{status:'specified',issues:[],scope:'specification_only',visualReview:'unverified'});
 p.source.imagegen='../outside.png';p.output.prefix='/assets/another-game/portrait';p.output.palette=['#ffffff','#FFFFFF'];
 const result=reviewAssetBrief(p);assert.equal(result.status,'incomplete');for(const key of ['source.imagegen','output.prefix','output.palette'])assert.ok(result.issues.some(x=>x.includes(key)));
 for(const value of [null,[],42,{version:1,kind:'image'},Object.assign(specified('image'),{canvas:'bad',output:null,source:[],animation:{}})])assert.equal(reviewAssetBrief(value).status,'incomplete');
});
test('animation specifications diagnose invalid timing, missing poses, overlapping clips and pivot drift',()=>{
 const p=specified('animation');assert.equal(reviewAssetBrief(p).status,'specified');
 p.animation!.frames[1].durationMs=0;p.animation!.pivot.x=65;p.animation!.clips={idle:{from:'idle-0',to:'idle-0',loop:true}};
 const issues=reviewAssetBrief(p).issues;for(const key of ['durationMs','pivot.x','every frame'])assert.ok(issues.some(x=>x.includes(key)));
 p.animation!.clips.extra={from:'idle-0',to:'idle-1',loop:false};assert.ok(reviewAssetBrief(p).issues.some(x=>x.includes('overlapping')));
 p.animation!.frames[1].id='idle-0';assert.ok(reviewAssetBrief(p).issues.some(x=>x.includes('duplicate')));
});
test('UI framing retains portrait/text safe regions and rejects impossible borders or target dimensions',()=>{
 const p=specified('ui-frame');assert.equal(reviewAssetBrief(p).status,'specified');
 p.uiFrame!.regions[0].width=64;p.uiFrame!.targetSizes=[{width:16,height:96}];
 const issues=reviewAssetBrief(p).issues;assert.ok(issues.some(x=>x.includes('outside canvas')));assert.ok(issues.some(x=>x.includes('too small')));
 p.uiFrame!.insets.left=64;assert.ok(reviewAssetBrief(p).issues.some(x=>x.includes('nonempty center')));
 const fixed=specified('ui-frame');fixed.uiFrame!.resize='fixed';fixed.uiFrame!.insets={left:null,top:null,right:null,bottom:null};fixed.uiFrame!.targetSizes=[{width:64,height:96}];
 assert.equal(reviewAssetBrief(fixed).status,'specified');fixed.uiFrame!.targetSizes[0].width=128;assert.ok(reviewAssetBrief(fixed).issues.some(x=>x.includes('retain its logical')));
});
