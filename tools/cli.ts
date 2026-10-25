#!/usr/bin/env node
import {createStandaloneProject} from './standalone.ts';
const [command,destination,...args]=process.argv.slice(2);
try{
 if(command==='--help'||command==='help')console.log('gyeol create ABS_OR_REL_NEW_DIRECTORY [--title TITLE]\ngyeol profile PROJECT GAME_ID --scenario JSON_FILE [--samples 3..100]\nNo automatic install, server, or publication.');
 else if(command==='profile'){
  const [id,...flags]=args;
  if(!destination||!id||!(flags.length===2||flags.length===4)||flags[0]!=='--scenario'||!flags[1]||(flags.length===4&&(flags[2]!=='--samples'||!/^\d+$/.test(flags[3]))))throw Error('Usage: gyeol profile PROJECT GAME_ID --scenario JSON_FILE [--samples 3..100]');
  const {readFile}=await import('node:fs/promises'),{loadRules}=await import('./game.ts'),{profileScenario}=await import('./profile.ts');
  const text=await readFile(flags[1],'utf8');if(Buffer.byteLength(text)>1_000_000)throw Error('Scenario too large');
  console.log(JSON.stringify(profileScenario(await loadRules(destination,id),JSON.parse(text),{samples:flags.length===4?Number(flags[3]):undefined}),null,2));
 }else{
  if(command!=='create'||!destination||!(args.length===0||(args.length===2&&args[0]==='--title')))throw Error('Usage: gyeol create NEW_DIRECTORY [--title TITLE]');
  console.log(JSON.stringify(await createStandaloneProject(destination,{title:args[1]}),null,2));
 }
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
