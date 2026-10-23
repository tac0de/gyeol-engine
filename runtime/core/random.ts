import {integer} from './clock.ts';
// Reused LCG32 from archive fe7dcc6: engine/survivor/simulation.ts.
// Reproducible gameplay randomness, not cryptographic randomness.
export function createRandom(seed:number){
 integer(seed,0,0xffffffff,'seed');let current=seed;
 return {next(){current=(Math.imul(current,1664525)+1013904223)>>>0;return current/4294967296;},read:()=>current};
}
