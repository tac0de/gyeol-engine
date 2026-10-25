import {lstat,realpath,mkdir,readdir,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const packageRoot=fileURLToPath(new URL('../../',import.meta.url));
async function rejectSymlinks(path:string){
 for(let current=resolve(path);;current=dirname(current)){
  try{if((await lstat(current)).isSymbolicLink())throw Error('Symlink destination rejected');}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(dirname(current)===current)break;
 }
}
/** Explicit, exclusive creation. Does not install dependencies, start a server, or publish. */
export async function createStandaloneProject(destination:string,options:{title?:string}={}){
 const target=resolve(destination),id=basename(target),title=options.title??'Signal Garden';
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(id))throw Error('Destination name must be a lowercase project id');
 if(!title.trim()||title.length>100||/[\u0000-\u001f\u007f]/.test(title))throw Error('Invalid title');
 await rejectSymlinks(target);await realpath(dirname(target));
 await mkdir(target); // Never adopt an existing directory, even an empty one.
 try{
  const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const tokens:Record<string,string>={__PROJECT_ID__:id,__TITLE_HTML__:escapeHtml(title),__TITLE_JSON__:JSON.stringify(title)};
  async function copy(source:string,dest:string){
   for(const item of await readdir(source,{withFileTypes:true})){
    if(item.isSymbolicLink())throw Error('Symlink template rejected');
    const from=join(source,item.name),to=join(dest,item.name.replace(/\.tpl$/,''));
    if(item.isDirectory()){await mkdir(to);await copy(from,to);}
    else if(item.name.endsWith('.tpl'))await writeFile(to,(await readFile(from,'utf8')).replace(/__PROJECT_ID__|__TITLE_HTML__|__TITLE_JSON__/g,t=>tokens[t]),{flag:'wx'});
    else await copyFile(from,to);
   }
  }
  await copy(join(packageRoot,'templates/standalone'),target);
  await mkdir(join(target,'vendor'));
  // Package the installed engine, not a sibling checkout or an unpublished registry version.
  const packed=spawnSync('npm',['pack','--ignore-scripts','--json','--pack-destination',join(target,'vendor')],{cwd:packageRoot,encoding:'utf8',timeout:120000,env:{...process.env,NODE_TEST_CONTEXT:undefined}});
  if(packed.status!==0)throw Error('Engine pack failed: '+packed.stderr);
  const [{filename}]=JSON.parse(packed.stdout) as {filename:string}[];
  if(basename(filename)!==filename)throw Error('Invalid pack filename');
  await copyFile(join(target,'vendor',filename),join(target,'vendor/gyeol-engine.tgz'));
  await rm(join(target,'vendor',filename));
  await copyFile(join(packageRoot,'LICENSE'),join(target,'LICENSE'));
  return {project:target,id,engine:'vendor/gyeol-engine.tgz',next:['npm install','npm run dev','npm run check','npm run scenario -- --out /absolute/run.json','npm run replay -- /absolute/run.json','npm run check:browser -- --evidence-dir /absolute/evidence','npm run desktop:package']};
 }catch(error){await rm(target,{recursive:true,force:true});throw error;}
}
