import {app,BrowserWindow,session} from 'electron';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
const smoke=process.argv.includes('--gyeol-smoke'),report=process.env.GYEOL_SMOKE_REPORT;
const root=join(__dirname,'dist');let window:BrowserWindow|undefined;
if(smoke&&process.platform==='darwin')app.setActivationPolicy('prohibited');
const inside=(path:string)=>{const r=relative(root,path);return r===''||(!r.startsWith('..')&&!isAbsolute(r));};
app.enableSandbox();
app.whenReady().then(async()=>{
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
  let allowed=false;try{allowed=details.url.startsWith('file:')&&inside(fileURLToPath(details.url));}catch{/* Deny malformed or remote URLs. */}
  callback({cancel:!allowed});
 });
 window=new BrowserWindow({title:__TITLE_JSON__,width:1120,height:850,minWidth:640,minHeight:680,show:!smoke,backgroundColor:'#111a1a',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 window.removeMenu();window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',event=>event.preventDefault());
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 await window.loadFile(join(root,'index.html'));
 if(smoke){
  if(!report||!isAbsolute(report))throw Error('Absolute GYEOL_SMOKE_REPORT required');
  const route=JSON.parse(process.env.GYEOL_SMOKE_ROUTE??'null');if(!Array.isArray(route)||route.length>256||route.some(x=>!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(x)))throw Error('Invalid smoke route');
  const result=await window.webContents.executeJavaScript(`(async()=>{
   const board=document.querySelector('#board');document.querySelector('#start').click();
   for(const key of ${JSON.stringify(route)}){board.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));board.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));}
   const won=board.dataset.won==='true';document.querySelector('#replay').click();
   const until=Date.now()+15000;while(board.dataset.replayVerified!=='true'&&Date.now()<until)await new Promise(r=>setTimeout(r,50));
   return {won,replayVerified:board.dataset.replayVerified==='true',nodeExposed:typeof window.require!=='undefined'||typeof window.process!=='undefined',title:document.title,overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  const prefs=window.webContents.getLastWebPreferences();
  const output={...result,packaged:app.isPackaged,appPath:app.getAppPath(),sandbox:prefs.sandbox,contextIsolation:prefs.contextIsolation,nodeIntegration:prefs.nodeIntegration};
  writeFileSync(report,JSON.stringify(output,null,2),{flag:'wx'});writeFileSync(report+'.png',(await window.webContents.capturePage()).toPNG(),{flag:'wx'});
  app.exit(result.won&&result.replayVerified&&!result.nodeExposed&&!result.overflow&&prefs.sandbox&&prefs.contextIsolation&&!prefs.nodeIntegration?0:1);
 }
}).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
