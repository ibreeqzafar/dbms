import assert from 'node:assert/strict';

// Public, unauthenticated probes only: no customer session, message or worker key.
const base='https://zhehksxuzyxnurmhwylw.supabase.co/functions/v1/';
const origin='https://essyra-home.vercel.app';
const options=await fetch(base+'support-agent',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST'},signal:AbortSignal.timeout(20000)});
assert.equal(options.status,200,'customer CORS preflight');
assert.equal(options.headers.get('access-control-allow-origin'),origin);
const unsigned=await fetch(base+'support-agent',{method:'POST',headers:{Origin:origin,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
assert.equal(unsigned.status,401,'unsigned customer request must be denied');
assert.equal((await unsigned.json()).error,'AUTH_REQUIRED');
const foreign=await fetch(base+'support-agent',{method:'POST',headers:{Origin:'https://invalid.example','content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
assert.equal(foreign.status,403,'foreign browser origin must be denied');
const worker=await fetch(base+'support-worker',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"lease"}',signal:AbortSignal.timeout(20000)});
assert([401,503].includes(worker.status),'worker must deny requests without its private key');
const payload=await worker.json();
assert(['UNAUTHORIZED','WORKER_NOT_CONFIGURED'].includes(payload.error));
console.log('Passed: live customer session requirement, allowed-origin preflight, foreign-origin denial and private worker-key requirement. No customer data, jobs, emails or orders created.');
