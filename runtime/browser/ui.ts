export type ScreenContext<K extends string>={from:K|null;to:K;signal:AbortSignal};
export type Screen<K extends string>={element:HTMLElement;focus?:HTMLElement;enter?:(context:ScreenContext<K>)=>void|(()=>void)};

/** Presentation lifecycle only. Game state, loading policy, and navigation decisions stay with the game. */
export function mountScreens<K extends string>(root:HTMLElement,options:{initial:K;screens:Record<K,Screen<K>>;changed?:(current:K)=>void}){
 const entries=Object.entries(options.screens) as [K,Screen<K>][];
 if(!entries.length||!Object.hasOwn(options.screens,options.initial))throw Error('Unknown initial screen');
 const elements=entries.map(([,s])=>s.element);
 if(elements.some(e=>e===root||!root.contains(e))||new Set(elements).size!==elements.length||elements.some(e=>elements.some(other=>e!==other&&e.contains(other))))throw Error('Screens must be distinct, non-nested descendants');
 if(entries.some(([,s])=>s.focus&&!s.element.contains(s.focus)))throw Error('Screen focus must belong to that screen');
 const previous=entries.map(([,s])=>({element:s.element,hidden:s.element.hidden,inert:s.element.inert,tabindex:s.element.getAttribute('tabindex')}));
 const previousFocus=root.ownerDocument.activeElement as HTMLElement|null;
 let current:K|null=null,abort:AbortController|undefined,cleanup:(()=>void)|undefined,disposed=false,transitioning=false;
 function hide(){for(const [,s] of entries){s.element.hidden=true;s.element.inert=true;}}
 function leave(){const stop=cleanup;cleanup=undefined;const controller=abort;abort=undefined;current=null;controller?.abort();stop?.();}
 function show(id:K){
  if(disposed)throw Error('Screen flow disposed');
  if(!Object.hasOwn(options.screens,id))throw Error('Unknown screen');
  if(transitioning)throw Error('Reentrant screen transition');
  if(current===id)return;
  transitioning=true;const from=current;
  try{
   leave();hide();const screen=options.screens[id];screen.element.hidden=false;screen.element.inert=false;abort=new AbortController();
   cleanup=screen.enter?.({from,to:id,signal:abort.signal})||undefined;current=id;
   const focus=screen.focus??screen.element.querySelector<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??screen.element;
   if(focus===screen.element&&!focus.hasAttribute('tabindex'))focus.setAttribute('tabindex','-1');
   focus.focus({preventScroll:true});options.changed?.(id);
  }catch(error){try{leave();}finally{hide();}throw error;}
  finally{transitioning=false;}
 }
 function dispose(){
  if(disposed)return;if(transitioning)throw Error('Cannot dispose during screen transition');disposed=true;
  try{leave();}finally{
   for(const p of previous){p.element.hidden=p.hidden;p.element.inert=p.inert;if(p.tabindex===null)p.element.removeAttribute('tabindex');else p.element.setAttribute('tabindex',p.tabindex);}
   if(previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]'))previousFocus.focus({preventScroll:true});
  }
 }
 try{show(options.initial);}catch(error){dispose();throw error;}
 return {show,current:()=>current,dispose};
}

/** Native modal focus containment/Escape with one synchronous open/close lifecycle. */
export function mountDialog(element:HTMLDialogElement,options:{focus?:HTMLElement;returnFocus?:HTMLElement;changed?:(open:boolean)=>void}={}){
 if(element.open||!element.isConnected)throw Error('Dialog must be connected and closed');
 if(options.focus&&!element.contains(options.focus))throw Error('Dialog focus must belong to the dialog');
 const abort=new AbortController();let disposed=false,opened=false,previousFocus:HTMLElement|null=null;
 function finish(){if(!opened)return;opened=false;try{options.changed?.(false);}finally{if(previousFocus?.isConnected&&!previousFocus.closest('[hidden],[inert]'))previousFocus.focus({preventScroll:true});}}
 function close(value=''){
  if(disposed)return;if(element.open)element.close(value);finish();
 }
 element.addEventListener('cancel',event=>{event.preventDefault();close();},{signal:abort.signal});
 element.addEventListener('close',()=>{if(!element.open)finish();},{signal:abort.signal});
 element.addEventListener('keydown',event=>{
  if(!opened||event.key!=='Tab')return;
  const targets=Array.from(element.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(e=>e.tabIndex>=0&&!e.matches(':disabled,[aria-disabled="true"]')&&!e.closest('[hidden],[inert]')&&e.getClientRects().length>0).sort((a,b)=>(a.tabIndex||Infinity)-(b.tabIndex||Infinity));
  const active=element.ownerDocument.activeElement,index=targets.findIndex(e=>e===active);
  if(!targets.length){event.preventDefault();element.focus();}
  else if(event.shiftKey&&index<=0){event.preventDefault();targets.at(-1)!.focus();}
  else if(!event.shiftKey&&(index===targets.length-1||index<0)){event.preventDefault();targets[0].focus();}
 },{signal:abort.signal});
 return {
  open(){
   if(disposed)throw Error('Dialog disposed');if(opened)return;
   previousFocus=options.returnFocus??element.ownerDocument.activeElement as HTMLElement|null;
   element.showModal();opened=true;
   try{options.changed?.(true);options.focus?.focus({preventScroll:true});}
   catch(error){close();throw error;}
  },close,isOpen:()=>opened,
  dispose(){if(disposed)return;try{close();}finally{disposed=true;abort.abort();}},
 };
}
