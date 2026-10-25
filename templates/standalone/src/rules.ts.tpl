import type {GameRules} from '@thedivineparadox/game-engine/runtime';
export const WIDTH=9,HEIGHT=5;
export const WALLS=[0,1,2,3,4,5,6,7,8,9,17,18,20,22,24,26,27,35,36,37,38,39,40,41,42,43,44];
export const NODES=[11,31,15],EXIT=34,START=28;
export type State={position:number;lit:number[];moves:number;won:boolean;elapsed:number};
export type Action={direction:'left'|'right'|'up'|'down'};
const directions={left:-1,right:1,up:-WIDTH,down:WIDTH};
export const rules:GameRules<State,Action>={
 id:'__PROJECT_ID__',version:'1',
 create:()=>({position:START,lit:[],moves:0,won:false,elapsed:0}),
 validState(v):v is State{
  if(!v||typeof v!=='object')return false;const s=v as State;
  return Object.keys(s).sort().join(',')==='elapsed,lit,moves,position,won'&&Number.isSafeInteger(s.position)&&s.position>=0&&s.position<WIDTH*HEIGHT&&!WALLS.includes(s.position)&&Array.isArray(s.lit)&&s.lit.every(x=>NODES.includes(x))&&new Set(s.lit).size===s.lit.length&&Number.isSafeInteger(s.moves)&&s.moves>=0&&Number.isSafeInteger(s.elapsed)&&s.elapsed>=0&&typeof s.won==='boolean'&&s.won===(s.position===EXIT&&s.lit.length===NODES.length);
 },
 validAction(v):v is Action{return !!v&&typeof v==='object'&&Object.keys(v).join(',')==='direction'&&Object.hasOwn(directions,(v as Action).direction);},
 reduce(s,a){
  const next=s.position+directions[a.direction];
  if(next<0||next>=WIDTH*HEIGHT||WALLS.includes(next)||Math.abs(next%WIDTH-s.position%WIDTH)+Math.abs(Math.floor(next/WIDTH)-Math.floor(s.position/WIDTH))!==1)return s;
  s.position=next;s.moves++;if(NODES.includes(next)&&!s.lit.includes(next))s.lit.push(next);
  s.won=next===EXIT&&s.lit.length===NODES.length;return s;
 },
 update(s){s.elapsed++;return s;},finished:s=>s.won,
};
/** A real route planner for this example; UI and CLI still dispatch ordinary engine actions. */
export function solution():Action[]{
 const queue=[{position:START,mask:0,path:[] as Action[]}],seen=new Set<string>();
 for(let i=0;i<queue.length;i++){
  const current=queue[i];if(current.position===EXIT&&current.mask===7)return current.path;
  for(const direction of Object.keys(directions) as Action['direction'][]){
   const position=current.position+directions[direction];if(position<0||position>=WIDTH*HEIGHT||WALLS.includes(position)||Math.abs(position%WIDTH-current.position%WIDTH)+Math.abs(Math.floor(position/WIDTH)-Math.floor(current.position/WIDTH))!==1)continue;
   const node=NODES.indexOf(position),mask=current.mask|(node<0?0:1<<node),key=position+':'+mask;
   if(seen.has(key))continue;seen.add(key);queue.push({position,mask,path:[...current.path,{direction}]});
  }
 }throw Error('No route');
}
