'use client';
import {useMemo} from 'react';
import {createHoldInput} from '@thedivineparadox/game-engine/runtime/browser/hold-input';
import {GameSurface,type GamePresentation} from '@thedivineparadox/game-engine/runtime/react';
import {rules,type State,type Action} from './rules';
function presentation():GamePresentation<State,Action>{return {
 rules,width:360,height:480,
 input:createHoldInput(),
 draw(context,snapshot){
  const {state}=snapshot;
  context.fillStyle='#f5f3ec';context.fillRect(0,0,360,480);
  context.fillStyle='#242824';context.font='20px system-ui';context.textAlign='center';context.fillText('ENGINE EXERCISE',180,80);
  context.font='15px system-ui';context.fillText('Hold, then release',180,120);
  context.strokeStyle='#242824';context.lineWidth=2;context.strokeRect(80,190,200,100);
  context.fillStyle='#98bb63';context.fillRect(80,290-Math.min(100,state.charge/state.target*100),200,Math.min(100,state.charge/state.target*100));
  context.fillStyle='#242824';context.fillText(`Score: ${state.score}`,180,350);
 },
};}
export default function Game({locale='ko',preview=false}:{locale?:string;preview?:boolean}){const game=useMemo(presentation,[]);return <GameSurface game={game} locale={locale} preview={preview}/>;}
