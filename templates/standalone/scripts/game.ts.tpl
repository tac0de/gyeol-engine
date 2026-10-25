import {readFileSync,writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createSession,replay} from '@thedivineparadox/game-engine/runtime';
import {rules,solution} from '../src/rules.ts';
const [mode,...args]=process.argv.slice(2);
try{
 if(mode==='inspect'){if(args.length)throw Error('inspect takes no arguments');console.log(JSON.stringify(createSession(rules).inspect(),null,2));}
 else if(mode==='scenario'){
  if(args.length!==2||args[0]!=='--out'||!isAbsolute(args[1]))throw Error('scenario --out ABS_NEW_JSON');
  const session=createSession(rules,17);session.command({type:'start'});
  for(const action of solution()){session.command({type:'advance',ticks:6});session.command({type:'action',action});}
  writeFileSync(args[1],JSON.stringify(session.exportRecording(),null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({recording:args[1],snapshot:session.inspect()}));
 }else if(mode==='replay'){
  if(args.length!==1)throw Error('replay RECORDING_JSON');const text=readFileSync(args[0],'utf8');if(text.length>1_000_000)throw Error('Recording too large');
  const session=replay(rules,JSON.parse(text));console.log(JSON.stringify(session.inspect(),null,2));session.dispose();
 }else throw Error('Use inspect | scenario --out ABS_NEW_JSON | replay FILE');
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
