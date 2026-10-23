import {readdir,readFile,writeFile,realpath,lstat,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
export interface GameManifest {id:string;status:'draft'|'published';title:{ko:string;en:string};description:{ko:string;en:string}}
export function gameId(value:string){if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)||value.length>48)throw Error('Invalid game id');return value;}
export async function gameDirectory(root:string,id:string){
 gameId(id);const base=await realpath(join(root,'portal/games')),directory=await realpath(join(base,id));
 if(directory!==join(base,id)||!directory.startsWith(base+sep)||(await lstat(join(base,id))).isSymbolicLink())throw Error('Game directory must not escape source or use a symlink');return directory;
}
export async function readManifest(root:string,id:string):Promise<GameManifest>{
 const directory=await gameDirectory(root,id),path=join(directory,'manifest.json');
 if((await lstat(path)).isSymbolicLink())throw Error('Symlink manifest rejected');
 const text=await readFile(path,'utf8');if(text.length>16000)throw Error('Manifest too large');
 const m=JSON.parse(text);
 if(!m||Object.keys(m).sort().join(',')!=='description,id,status,title'||m.id!==id||!['draft','published'].includes(m.status))throw Error('Invalid game manifest');
 for(const field of ['title','description'])if(!m[field]||Object.keys(m[field]).sort().join(',')!=='en,ko'||!['ko','en'].every(locale=>typeof m[field][locale]==='string'&&m[field][locale].trim()&&m[field][locale].length<=400))throw Error('Invalid localized game text');
 return m;
}
export async function manifests(root:string){
 const directory=join(root,'portal/games');let entries;
 try{entries=await readdir(directory,{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
 const result:GameManifest[]=[];
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.name.startsWith('.'))continue;
  if(!entry.isDirectory()||entry.isSymbolicLink())throw Error(`Unexpected game entry: ${entry.name}`);
  try{await lstat(join(directory,entry.name,'manifest.json'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  result.push(await readManifest(root,entry.name));
 }
 return result;
}
