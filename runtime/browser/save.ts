import {createSaveSlot,type SaveOptions,type StoragePort,type Json} from '../core/index.ts';
/** Access is lazy: importing or creating this adapter never probes or writes localStorage. */
export function createBrowserSaveSlot<T extends Json>(options:SaveOptions<T>&{storage?:()=>StoragePort}){
 return createSaveSlot({...options,storage:options.storage??(()=>window.localStorage)});
}
