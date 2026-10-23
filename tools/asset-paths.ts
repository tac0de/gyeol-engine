import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
export function assetRoot(project:string){if(!path.isAbsolute(project))throw Error('Absolute project required');return fs.realpathSync(project);}
export function assetPath(root:string,value:string){
 if(typeof value!=='string'||!value||path.isAbsolute(value)||value.includes('\\')||value.split('/').some(p=>!p||p==='.'||p==='..')||/[\u0000-\u001f]/.test(value))throw Error('Canonical project-relative asset path required');
 const file=path.join(root,value);
 for(let p=file;p!==root;p=path.dirname(p))try{if(fs.lstatSync(p).isSymbolicLink())throw Error('Asset symlink rejected');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 return file;
}
export function readAssetJson(root:string,file:string){const target=assetPath(root,file);if(fs.statSync(target).size>1024*1024)throw Error('Oversized asset JSON');return JSON.parse(fs.readFileSync(target,'utf8'));}
export function assetId(value:string){if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)||value.length>64)throw Error('Invalid asset id');return value;}
