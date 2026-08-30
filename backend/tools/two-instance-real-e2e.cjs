#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const { WebSocket } = require('ws');

const ports = [33101, 33102];
const processes = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Backend indisponible: ${url}`);
}

function startBackend(port) {
  const output = [];
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), LOG_FILES_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  child.output = output;
  processes.push(child);
  return child;
}

class ApiClient {
  constructor(port) {
    this.url = `ws://127.0.0.1:${port}/ws/api?v=9.9.9.9`;
    this.messages = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.on('message', (raw) => {
      try {
        this.messages.push(JSON.parse(raw.toString('utf8')));
      } catch {}
    });
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
  }

  async request(type, payload) {
    const requestId = `${type}-${Date.now()}-${Math.random()}`;
    this.socket.send(JSON.stringify({ requestId, type, payload }));
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex((row) => row.requestId === requestId);
      if (index >= 0) {
        const [response] = this.messages.splice(index, 1);
        if (response.type === 'error') {
          throw new Error(`WS ${type}: ${JSON.stringify(response.payload)}`);
        }
        return response;
      }
      await sleep(20);
    }
    throw new Error(`Timeout WS ${type} sur ${this.url}`);
  }

  close() {
    this.socket?.close();
  }
}

async function main() {
  const firstProcess = startBackend(ports[0]);
  const secondProcess = startBackend(ports[1]);
  await Promise.all(ports.map((port) => waitForHttp(`http://127.0.0.1:${port}/health/ready`)));
  if (firstProcess.exitCode != null || secondProcess.exitCode != null) {
    throw new Error('Une instance backend s’est arrêtée pendant le bootstrap');
  }

  const first = new ApiClient(ports[0]);
  const second = new ApiClient(ports[1]);
  await Promise.all([first.connect(), second.connect()]);
  const suffix = `${process.pid}-${Date.now()}`;
  const username = `multi_${suffix}`;
  const email = `${username}@integration.test`;
  const password = 'Shared-backend-42!';
  try {
    await first.request('auth.register', { email, username, password });
    const login = await first.request('auth.login', { username, password });
    const refreshToken = login.payload?.refreshToken;
    if (typeof refreshToken !== 'string') throw new Error('Refresh token absent');

    const refreshed = await second.request('auth.refresh', { refreshToken });
    if (typeof refreshed.payload?.token !== 'string') {
      throw new Error('Refresh inter-instance non partagé');
    }
    const secondLogin = await second.request('auth.login', { username, password });
    if (secondLogin.payload?.userId !== login.payload?.userId) {
      throw new Error('Identité MySQL différente entre instances');
    }
    console.log('two-instance-real-e2e: OK (DB et session Redis partagées via WebSocket)');
  } finally {
    first.close();
    second.close();
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    await db.execute('DELETE FROM users WHERE email = ?', [email]);
    await db.end();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    for (const child of processes) console.error(child.output.slice(-20).join(''));
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of processes) child.kill('SIGTERM');
    await sleep(500);
    for (const child of processes) if (child.exitCode == null) child.kill('SIGKILL');
  });
