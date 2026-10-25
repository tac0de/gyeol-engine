#!/usr/bin/env node
import {createStandaloneProject} from './standalone.ts';
const [command,destination,...args]=process.argv.slice(2);
try{
 if(command==='--help'||command==='help')console.log('gyeol create ABS_OR_REL_NEW_DIRECTORY [--title TITLE]\nCreates a standalone 2D project. No automatic install, server, or publication.');
 else{
  if(command!=='create'||!destination||!(args.length===0||(args.length===2&&args[0]==='--title')))throw Error('Usage: gyeol create NEW_DIRECTORY [--title TITLE]');
  console.log(JSON.stringify(await createStandaloneProject(destination,{title:args[1]}),null,2));
 }
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
