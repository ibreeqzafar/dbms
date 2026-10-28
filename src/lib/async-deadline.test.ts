import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withDeadline} from './async-deadline.ts';
test('a stalled authentication or network promise cannot wait forever',async()=>{let signal:AbortSignal|undefined;await assert.rejects(withDeadline(s=>{signal=s;return new Promise(()=>{})},new AbortController().signal,15),/AGENT_TIMEOUT/);assert.equal(signal?.aborted,true)});
test('stop waiting aborts even a request that ignores its signal',async()=>{const parent=new AbortController();const result=withDeadline(()=>new Promise(()=>{}),parent.signal,1000);parent.abort();await assert.rejects(result,/ABORTED/)});
test('successful requests resolve normally and do not abort their parent',async()=>{const parent=new AbortController();assert.equal(await withDeadline(async()=>42,parent.signal,1000),42);assert.equal(parent.signal.aborted,false)});
