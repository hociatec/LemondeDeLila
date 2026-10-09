// Real WinHTTP HTTP + WebSocket traffic against a delayed loopback server.
const http = require('node:http');
const { spawn } = require('node:child_process');
const { WebSocketServer } = require('../../backend/node_modules/ws');
const assert = require('node:assert/strict');
const delayMs = 80;
let tickets = 0, connections = 0, reads = 0;
const issued = new Set();
const server = http.createServer((req, res) => {
  if (req.url !== '/api/ws/ticket?scope=api') { res.writeHead(404).end(); return; }
  const ticket = `single-use-${++tickets}`;
  issued.add(ticket);
  setTimeout(() => res.end(JSON.stringify({ ticket })), delayMs);
});
const ws = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (!issued.delete(req.headers['x-lila-ws-ticket'])) { socket.destroy(); return; }
  ++connections;
  setTimeout(() => ws.handleUpgrade(req, socket, head, client => {
    client.on('message', data => {
      const request = JSON.parse(data);
      ++reads;
      setTimeout(() => client.send(JSON.stringify({ ...request, payload: { ok: true } })), delayMs);
    });
  }), delayMs);
});
server.listen(0, '127.0.0.1', () => {
  const child = spawn(process.argv[2], [`ws://127.0.0.1:${server.address().port}/ws/api`], { windowsHide: true });
  let stdout = '';
  child.stdout.on('data', data => stdout += data);
  child.stderr.pipe(process.stderr);
  const timeout = setTimeout(() => child.kill(), 30000);
  child.on('close', code => {
    clearTimeout(timeout);
    for (const client of ws.clients) client.terminate();
    ws.close(); server.close();
    assert.equal(code, 0);
    const timings = JSON.parse(stdout);
    console.log(JSON.stringify({ delayMs, tickets, connections, reads, timings }, null, 2));
    assert.equal(reads, 8);
    if (!process.argv.includes('--baseline')) {
      assert.equal(tickets, 1);
      assert.equal(connections, 1);
    }
  });
});
