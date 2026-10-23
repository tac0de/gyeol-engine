import type {GameRules} from '@thedivineparadox/game-engine/runtime/core';
export type State={ticks:number;charge:number;held:boolean;score:number;target:number};
export type Action={type:'hold';held:boolean}|{type:'cancel'};
// Infrastructure exercise only. Replace these rules after choosing a real game.
export const rules:GameRules<State,Action>={
 id:__ID_JSON__,version:'1',
 create:context=>({ticks:0,charge:0,held:false,score:0,target:Math.floor(context.random()*10)+10}),
 validState:(value):value is State=>!!value&&typeof value==='object'&&Object.keys(value).sort().join(',')==='charge,held,score,target,ticks'&&['ticks','charge','score','target'].every(key=>Number.isSafeInteger((value as Record<string,unknown>)[key])&&Number((value as Record<string,unknown>)[key])>=0)&&typeof (value as State).held==='boolean',
 validAction:(value):value is Action=>!!value&&typeof value==='object'&&((Object.keys(value).join(',')==='type'&&(value as Action).type==='cancel')||(Object.keys(value).sort().join(',')==='held,type'&&(value as {type:string}).type==='hold'&&typeof (value as {held:boolean}).held==='boolean')),
 reduce:(state,action)=>action.type==='cancel'?{...state,held:false,charge:0}:{...state,held:action.held,score:!action.held&&state.held&&state.charge>=state.target?1:state.score},
 update:state=>({...state,ticks:state.ticks+1,charge:state.charge+(state.held?1:0)}),
 finished:state=>state.score===1||state.ticks>=600,
};
