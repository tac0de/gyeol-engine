import test from 'node:test';
import assert from 'node:assert/strict';
import {createHoldInput} from '../../runtime/browser/hold-input.ts';
const pointer=(phase:'down'|'up'|'cancel'|'move')=>({type:'pointer' as const,phase,x:10,y:10});
const key=(pressed:boolean,cancelled=false)=>({type:'key' as const,key:' ',pressed,cancelled});
test('mixed sources release only once after the final source releases',()=>{
 const input=createHoldInput();assert.equal(input(key(false)),undefined);
 assert.deepEqual(input(pointer('down')),{type:'hold',held:true});assert.equal(input(key(true)),undefined);assert.equal(input(pointer('up')),undefined);assert.deepEqual(input(key(false)),{type:'hold',held:false});assert.equal(input(key(false)),undefined);
});
test('cancel clears a mixed gesture and cannot turn a later release into success',()=>{
 const input=createHoldInput();input(key(true));input(pointer('down'));assert.deepEqual(input(pointer('cancel')),{type:'cancel'});assert.equal(input(key(false)),undefined);assert.equal(input(pointer('up')),undefined);
 assert.deepEqual(input(key(true)),{type:'hold',held:true});assert.deepEqual(input(key(false,true)),{type:'cancel'});assert.equal(input(key(false)),undefined);
});
test('adapters belong to separate games and irrelevant inputs do not alter holds',()=>{
 const a=createHoldInput(),b=createHoldInput();a(pointer('down'));assert.equal(b(pointer('up')),undefined);assert.equal(a(pointer('move')),undefined);assert.equal(a({type:'key',key:'ArrowLeft',pressed:true}),undefined);assert.deepEqual(a(pointer('up')),{type:'hold',held:false});
});
