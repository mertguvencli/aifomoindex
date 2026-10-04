/** Resumable, append-only headline annotations. No dependency on web build or index arithmetic. */
import { readFile, mkdir, appendFile, writeFile, rename, open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROTOCOL, RUBRIC_HASH, QUESTIONS, OPENROUTER_MODEL, requestFor, hash, validateResponse, responseWarnings, evaluate } from './semantic/jev.mjs';

export async function annotateCorpus({ items, directory, apiKey, execute = false, concurrency = 8, limit = Infinity, evaluator = evaluate }) {
  await mkdir(directory, { recursive: true });
  const lockPath = resolve(directory, '.lock');
  const lock = await open(lockPath, 'wx');
  try {
    const journal = resolve(directory, 'annotations.jsonl');
    let contents = '';
    try { contents = await readFile(journal, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    // A torn last write must be inspected, never silently discarded and re-billed.
    if (contents && !contents.endsWith('\n')) throw new Error('Incomplete journal line; inspect annotations.jsonl before resuming.');
    const saved = new Map();
    for (const line of contents.split('\n').filter(Boolean)) {
      const row = JSON.parse(line);
      saved.set(`${row.id}:${row.inputSha256}`, row);
    }
    const all = items.map(item => {
      const request = requestFor(item, OPENROUTER_MODEL);
      return { id: item.id, inputSha256: hash(request), request };
    });
    if (new Set(items.map(x => x.id)).size !== items.length) throw new Error('Duplicate corpus IDs');
    const pending = all.filter(record => {
      const prior = saved.get(`${record.id}:${record.inputSha256}`);
      if (!prior) return true;
      if (prior.protocol !== PROTOCOL || prior.rubricSha256 !== RUBRIC_HASH) throw new Error('Cached annotation provenance mismatch');
      validateResponse(prior.response, record.request);
      return false;
    });
    console.log(`Corpus ${all.length}; cached ${all.length - pending.length}; pending ${pending.length}.`);
    if (!execute) return { pending: pending.length };
    await mkdir(resolve(directory, 'protocols'), {recursive:true});
    await writeFile(resolve(directory, 'protocols', `${RUBRIC_HASH}.json`), JSON.stringify({protocol:PROTOCOL,model:OPENROUTER_MODEL,rubricSha256:RUBRIC_HASH,questions:QUESTIONS},null,2)+'\n');
    if (pending.length && !apiKey) throw new Error('OPENROUTER_KEY or OPENROUTER_API_KEY is required.');
    const queue = pending.slice(0, limit);
    let cursor = 0, completed = 0, failure;
    let writes = Promise.resolve();
    async function worker() {
      while (!failure && cursor < queue.length) {
        const record = queue[cursor++];
        try {
          const startedAt = new Date().toISOString();
          const { raw } = await evaluator(record.request, apiKey);
          validateResponse(raw, record.request);
          const row = { protocol: PROTOCOL, rubricSha256: RUBRIC_HASH, id: record.id, inputSha256: record.inputSha256, requestedModel: OPENROUTER_MODEL, warnings: responseWarnings(raw), startedAt, completedAt: new Date().toISOString(), response: raw };
          writes = writes.then(() => appendFile(journal, JSON.stringify(row) + '\n'));
          await writes;
          saved.set(`${record.id}:${record.inputSha256}`, row);
          completed++;
          if (completed % 250 === 0) console.log(`Saved ${completed}/${queue.length} new annotations.`);
        } catch (error) {
          failure ??= error;
          await appendFile(resolve(directory, 'failures.jsonl'), JSON.stringify({id:record.id,inputSha256:record.inputSha256,at:new Date().toISOString(),error:String(error),response:error.rawResponse})+'\n');
        }
      }
    }
    await Promise.all(Array.from({length:concurrency}, worker));
    const current = all.map(r => saved.get(`${r.id}:${r.inputSha256}`)).filter(Boolean);
    const counts = key => Object.fromEntries([...new Set(current.map(r => r.response.answers[key].choice))].sort().map(label => [label,current.filter(r=>r.response.answers[key].choice===label).length]));
    const summary = { protocol:PROTOCOL,rubricSha256:RUBRIC_HASH,datasetSha256:hash(items),updatedAt:new Date().toISOString(),total:all.length,annotated:current.length,missing:all.length-current.length,models:[...new Set(current.map(r=>r.response.model))].sort(),flagged:current.filter(r=>responseWarnings(r.response).length>0).length,relevance:counts('relevance'),concreteChange:counts('concreteChange'),recordedCostUsd:current.reduce((sum,r)=>sum+(r.response.usage.cost??0),0),note:'Retrospective headline annotations; no human accuracy benchmark; zero index weight. Cost excludes failed or unrecorded requests.' };
    const target=resolve(directory,'summary.json');
    await writeFile(target+'.tmp',JSON.stringify(summary,null,2)+'\n');
    await rename(target+'.tmp',target);
    console.log(JSON.stringify(summary));
    if (failure) throw failure;
    return summary;
  } finally { await lock.close(); await unlink(lockPath); }
}

async function main() {
  try { process.loadEnvFile('.env'); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const args=process.argv.slice(2);
  if(args.some(a=>! /^(--execute|--concurrency=\d+|--limit=\d+)$/.test(a))) throw new Error('Use --execute [--concurrency=8] [--limit=N]');
  const value=(key,fallback)=>Number(args.find(a=>a.startsWith(`--${key}=`))?.split('=')[1]??fallback);
  const concurrency=value('concurrency',8),limit=value('limit',Infinity);
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>16||limit<1) throw new Error('Concurrency must be 1–16 and limit positive.');
  await annotateCorpus({items:JSON.parse(await readFile('data/index.json','utf8')),directory:resolve('data/semantic'),apiKey:process.env.OPENROUTER_KEY||process.env.OPENROUTER_API_KEY,execute:args.includes('--execute'),concurrency,limit});
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
