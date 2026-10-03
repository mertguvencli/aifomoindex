import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {annotateCorpus} from '../scripts/semantic-corpus.mjs';
import {QUESTIONS} from '../scripts/semantic/jev.mjs';
const item={id:'a',title:'New AI model',publishedAt:'2026-09-30T00:00:00Z'};
function response(){return {model:'typesafe/jev-1.13-20260917',answers:{relevance:{type:'choice',choice:'relevant',confidence:1,probabilities:{relevant:1,unrelated:0,insufficient:0}},concreteChange:{type:'choice',choice:'reported',confidence:1,probabilities:{reported:1,commentary:0,insufficient:0}},specificity:{type:'score',score:1,confidence:1,probabilities:{0:0,1:1,2:0},legend:Object.fromEntries(QUESTIONS.specificity.criteria.map((x,i)=>[i,x]))}},usage:{input_tokens:100,output_tokens:10,cost:0.001}};}
test('checkpoint survives failure; resume skips exact inputs and reannotates changed headlines',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jev-corpus-'));let calls=0;
 const items=[item,{...item,id:'b'}];
 const options={items,directory,execute:true,apiKey:'test',concurrency:1};
 try{
  await assert.rejects(annotateCorpus({...options,evaluator:async()=>{if(++calls===2)throw new Error('HTTP 429');return {raw:response()};}}),/429/);
  assert.equal(JSON.parse(await readFile(join(directory,'summary.json'),'utf8')).annotated,1);
  const evaluator=async()=>{calls++;return {raw:response()};};
  assert.equal((await annotateCorpus({...options,evaluator})).annotated,2);
  assert.equal(calls,3);
  await annotateCorpus({...options,evaluator});assert.equal(calls,3);
  await annotateCorpus({...options,items:[{...item,title:'Changed headline'},items[1]],evaluator});assert.equal(calls,4);
  assert.equal((await readFile(join(directory,'annotations.jsonl'),'utf8')).trim().split('\n').length,3);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('bounded concurrent workers persist each record once and retain rejected provider responses',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'jev-workers-'));let active=0,peak=0;
 try{
  const items=Array.from({length:12},(_,i)=>({...item,id:String(i)}));
  const result=await annotateCorpus({items,directory,execute:true,apiKey:'test',concurrency:3,evaluator:async()=>{
   peak=Math.max(peak,++active);await new Promise(resolve=>setTimeout(resolve,2));active--;return {raw:response()};
  }});
  assert.equal(result.annotated,12);assert.equal(peak,3);
  const rows=(await readFile(join(directory,'annotations.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(new Set(rows.map(r=>r.id)).size,12);
  const bad=response();bad.answers.concreteChange.choice='commentary';
  const error=Object.assign(new Error('Invalid choice'),{rawResponse:bad});
  await assert.rejects(annotateCorpus({items:[{...item,id:'bad'}],directory,execute:true,apiKey:'test',concurrency:1,evaluator:async()=>{throw error;}}),/Invalid choice/);
  const failure=JSON.parse((await readFile(join(directory,'failures.jsonl'),'utf8')).trim());
  assert.deepEqual(failure.response,bad);
 }finally{await rm(directory,{recursive:true,force:true});}
});
