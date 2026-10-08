import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const executable = process.argv[2];
assert(executable, 'Pass the production WinHTTP probe executable');
const payload = JSON.stringify({ schemaVersion: 2, test: 'network-recovery' });
const counts = new Map(), recovered = new Set(), sockets = new Set();
const temporaryRoot = await realpath(tmpdir());
const temporary = await mkdtemp(join(temporaryRoot, 'lila-update-network-'));
const server = http.createServer((req, res) => {
  const mode = req.url.slice(1);
  const count = (counts.get(mode) ?? 0) + 1;
  counts.set(mode, count);
  if (!recovered.has(mode)) {
    const failing = mode.endsWith('always') || count <= (mode.startsWith('timeout') ? 1 : 2);
    if (failing) {
      if (mode.startsWith('timeout')) return;
      if (mode.startsWith('slow')) {
        res.writeHead(200, { 'Transfer-Encoding': 'chunked' });
        const interval = setInterval(() => res.write(' '), 200);
        res.on('close', () => clearInterval(interval));
        return;
      }
      if (mode.startsWith('502')) { res.writeHead(502); res.end(); return; }
      if (mode.startsWith('empty')) { res.end(count % 2 ? '' : ' \t\r\n'); return; }
      if (mode.startsWith('truncated') || mode.startsWith('package')) {
        // Even syntactically valid JSON is incomplete if the declared length differs.
        res.writeHead(200, { 'Content-Length': payload.length + 100, Connection: 'close' });
        res.end(payload); return;
      }
      if (mode.startsWith('malformed')) {
        res.writeHead(200, { 'Transfer-Encoding': 'chunked' });
        res.end(payload.slice(0, 10)); return;
      }
      if (mode.startsWith('oversized')) {
        res.writeHead(200, { 'Content-Length': '4294967296', Connection: 'close' });
        res.end(); return;
      }
    }
  }
  res.writeHead(200, { 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
});
server.on('connection', socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function probe(url, extra = []) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(executable, [url, ...extra], { windowsHide: true });
    let stdout = '', stderr = '';
    const deadline = setTimeout(() => child.kill(), 60_000);
    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);
    child.on('error', error => { clearTimeout(deadline); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(deadline);
      resolve({ code, signal, stdout, stderr, seconds: (Date.now() - start) / 1000 });
    });
  });
}

async function scenario(mode, errorPattern) {
  const first = await probe(`${base}/${mode}`);
  assert.equal(first.signal, null, `${mode}: probe must finish without termination`);
  assert.equal(counts.get(mode), mode === 'timeout-recover' ? 2 : 3, `${mode}: retry count`);
  if (mode.endsWith('always')) {
    assert.equal(first.code, 1, `${mode}: incomplete responses must fail`);
    assert.match(first.stderr, errorPattern);
    assert.equal(first.stdout, '', `${mode}: never publish a partial response`);
  } else {
    assert.equal(first.code, 0, `${mode}: ${first.stderr}`);
    assert.equal(first.stdout, payload);
  }
  if (mode.startsWith('timeout')) assert(first.seconds < 25, 'Manifest timeout must not block for 96 seconds');
  if (mode.startsWith('slow')) assert(first.seconds < 45, 'A trickling body must have a finite total budget');
  recovered.add(mode);
  const after = await probe(`${base}/${mode}`);
  assert.equal(after.code, 0, after.stderr);
  assert.equal(after.stdout, payload, `${mode}: recovery must return the complete response`);
  console.log(`PASS ${mode}: ${first.seconds.toFixed(2)}s; subsequent recovery OK`);
}

async function packages() {
  const retryDestination = join(temporary, 'package-retry');
  const retry = await probe(`${base}/package-retry`, [retryDestination, String(payload.length)]);
  assert.equal(retry.code, 0, retry.stderr);
  assert.equal(counts.get('package-retry'), 3);
  assert.equal(await readFile(retryDestination, 'utf8'), payload);
  await assert.rejects(access(`${retryDestination}.partial`));
  console.log('PASS package-retry: only the complete third response is committed');
  for (const mode of ['package-recover', 'package-always']) {
    const destination = join(temporary, mode);
    await writeFile(destination, 'existing installed download');
    const result = await probe(`${base}/${mode}`, [destination, String(payload.length + 100)]);
    // Both responses have the wrong size for this manifest. No attempt may replace the file.
    assert.equal(result.code, 1);
    assert.equal(await readFile(destination, 'utf8'), 'existing installed download');
    await assert.rejects(access(`${destination}.partial`));
    recovered.add(mode);
    const success = await probe(`${base}/${mode}`, [destination, String(payload.length)]);
    assert.equal(success.code, 0, success.stderr);
    assert.equal(await readFile(destination, 'utf8'), payload);
    console.log(`PASS ${mode}: failed download preserves destination; clean retry succeeds`);
  }
}

try {
  const modes = [
    ['502', /HTTP status 502/], ['empty', /empty manifest/],
    ['truncated', /truncated|interrupted/], ['malformed', /invalid JSON manifest/],
    ['timeout', /12002/], ['oversized', /exceeds its declared limit/],
  ];
  const jobs = modes.flatMap(([mode, pattern]) => ['recover', 'always'].map(
    suffix => scenario(`${mode}-${suffix}`, pattern)));
  jobs.push(scenario('slow-always', /time limit|12002/), packages());
  if (process.argv.includes('--dns')) jobs.push((async () => {
    const result = await probe(`https://lila-network-${Date.now()}.invalid/manifest`);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /12007/);
    const success = await probe(`${base}/healthy-after-dns`);
    assert.equal(success.stdout, payload);
    console.log(`PASS DNS 12007: ${result.seconds.toFixed(2)}s; subsequent healthy endpoint OK`);
  })());
  const results = await Promise.allSettled(jobs);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
  assert.equal(dirname(await realpath(temporary)), temporaryRoot);
  await rm(temporary, { recursive: true, force: true });
}
