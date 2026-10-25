import {isCheckpoint,type Checkpoint} from '@thedivineparadox/game-engine/runtime';
import {createBrowserSaveSlot} from '@thedivineparadox/game-engine/runtime/browser/save';
import {rules,type State} from './rules.ts';
export const PROGRESS_KEY='gyeol:progress:'+rules.id;
export type Progress={checkpoint:Checkpoint<State>};
export function validProgress(value:unknown):value is Progress{return !!value&&typeof value==='object'&&Object.keys(value).join(',')==='checkpoint'&&isCheckpoint(rules,(value as Progress).checkpoint);}
export function createProgressSlot(){
 return createBrowserSaveSlot<Progress>({key:PROGRESS_KEY,gameId:rules.id,version:2,validate:validProgress,migrations:{
  1(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='run'||!isCheckpoint(rules,value.run))throw Error('Invalid legacy progress');return {checkpoint:value.run};},
 }});
}
