#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { WebSocket } = require('ws');

const ports = [33101, 33102];
const processes = [];
const clientHeaders = {
  'x-lila-client-product': 'client-wx',
  'x-lila-client-version': '9.9.9.9',
};

function isRunning(child) {
  return child.exitCode == null && child.signalCode == null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function residentBytes(child) {
  const status = fs.readFileSync(`/proc/${child.pid}/status`, 'utf8');
  const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  if (!match) throw new Error(`VmRSS absent pour pid=${child.pid}`);
  return Number(match[1]) * 1024;
}

function runMultiInstanceLoad(backends) {
  const before = backends.map(residentBytes);
  const result = spawnSync(process.execPath, ['tools/room-load-real.cjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ROOM_LOAD_BASE_HTTP_URLS: ports
        .map((port) => `http://127.0.0.1:${port}`)
        .join(','),
      ROOM_LOAD_BASE_WS_URLS: ports
        .map((port) => `ws://127.0.0.1:${port}`)
        .join(','),
      ROOM_LOAD_ROOMS: '3',
      ROOM_LOAD_EXTRA_PLAYERS: '1',
      ROOM_LOAD_SPECTATORS: '1',
      ROOM_LOAD_CONCURRENCY: '6',
      ROOM_LOAD_SOAK_ROUNDS: '3',
      ROOM_LOAD_REPORT_PATH: path.join(
        process.cwd(),
        'logs/room-load-real.json',
      ),
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Charge multi-instance échouée');
  const after = backends.map(residentBytes);
  const growth = after.map((value, index) => value - before[index]);
  if (growth.some((value) => value >= 256 * 1024 * 1024)) {
    throw new Error(`Croissance RSS non bornée: ${growth.join(', ')}`);
  }
  return growth;
}

function dockerCompose(args) {
  const result = spawnSync(
    'docker',
    ['compose', '-f', 'tools/real-integration.compose.yml', ...args],
    { cwd: process.cwd(), stdio: 'inherit' },
  );
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')} a échoué`);
  }
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
    env: {
      ...process.env,
      PORT: String(port),
      LOG_FILES_ENABLED: 'false',
      AUTH_REQUEST_RATE_LIMIT_COUNT: '1000',
      WS_RATE_LIMIT_COUNT: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));
  child.output = output;
  processes.push(child);
  return child;
}

async function stopBackendsGracefully(timeoutMs = 8_000) {
  const running = processes.filter(isRunning);
  for (const child of running) child.kill('SIGTERM');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (running.every((child) => !isRunning(child))) return;
    await sleep(50);
  }
  for (const child of running) {
    if (isRunning(child)) child.kill('SIGKILL');
  }
  throw new Error('Graceful shutdown incomplet après SIGTERM');
}

class ApiClient {
  constructor(port) {
    this.url = `ws://127.0.0.1:${port}/ws/api`;
    this.messages = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url, { headers: clientHeaders });
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

  async request(type, payload, timeoutMs = 15_000) {
    const requestId = `${type}-${Date.now()}-${Math.random()}`;
    this.socket.send(JSON.stringify({ requestId, type, payload }));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = this.messages.findIndex(
        (row) => row.requestId === requestId,
      );
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

async function exerciseRedisOutage(client, refreshToken, username, password) {
  if (process.env.INTEGRATION_REDIS_COMPOSE !== 'true') return 'skipped-native';
  dockerCompose(['stop', 'redis']);
  let rejectedDuringOutage = false;
  try {
    try {
      await client.request('auth.refresh', { refreshToken }, 3_000);
    } catch {
      rejectedDuringOutage = true;
    }
  } finally {
    dockerCompose(['start', 'redis']);
  }
  if (!rejectedDuringOutage) {
    throw new Error('La mutation Redis a réussi pendant la coupure');
  }
  await Promise.all(
    ports.map((port) =>
      waitForHttp(`http://127.0.0.1:${port}/health/ready`, 30_000),
    ),
  );
  const recovered = new ApiClient(ports[1]);
  await recovered.connect();
  try {
    const login = await recovered.request('auth.login', { username, password });
    if (typeof login.payload?.token !== 'string') {
      throw new Error('Login absent après reconnexion Redis');
    }
  } finally {
    recovered.close();
  }
  return 'passed';
}

async function exerciseMysqlOutage(client, username, password) {
  dockerCompose(['pause', 'mysql']);
  let rejectedDuringOutage = false;
  try {
    try {
      await client.request(
        'auth.register',
        {
          username: `mysql_outage_${Date.now()}`,
          email: `mysql-outage-${Date.now()}@example.test`,
          password,
        },
        3_000,
      );
    } catch {
      rejectedDuringOutage = true;
    }
  } finally {
    dockerCompose(['unpause', 'mysql']);
  }
  if (!rejectedDuringOutage) {
    throw new Error('La mutation MySQL a réussi pendant la coupure');
  }
  await Promise.all(
    ports.map((port) =>
      waitForHttp(`http://127.0.0.1:${port}/health/ready`, 45_000),
    ),
  );
  const recovered = new ApiClient(ports[0]);
  await recovered.connect();
  try {
    const login = await recovered.request('auth.login', { username, password });
    if (typeof login.payload?.token !== 'string') {
      throw new Error('Login absent après reconnexion MySQL');
    }
  } finally {
    recovered.close();
  }
  return 'passed';
}

class RoomClient {
  constructor(port, token, ticket, roomId) {
    this.url = `ws://127.0.0.1:${port}/ws`;
    this.roomId = roomId;
    this.headers = {
      ...clientHeaders,
      Authorization: `Bearer ${token}`,
      'x-lila-ws-ticket': ticket,
    };
    this.messages = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url, { headers: this.headers });
    this.socket.on('message', (raw) => {
      try {
        this.messages.push(JSON.parse(raw.toString('utf8')));
      } catch {}
    });
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', reject);
    });
    // The HTTP upgrade precedes asynchronous room authentication. Probe the
    // non-mutating ping intent before sending the first room command.
    const deadline = Date.now() + 15_000;
    while (!this.messages.some((message) => message.type === 'room.pong')) {
      if (this.socket.readyState !== WebSocket.OPEN || Date.now() >= deadline) {
        throw new Error(`Room connection not ready: ${this.url}`);
      }
      this.send('room.ping');
      await sleep(50);
    }
    if (this.roomId > 0) this.send('room.join', { roomId: this.roomId });
  }

  send(type, payload = {}) {
    this.socket.send(
      JSON.stringify({
        type: 'room.intent.execute',
        payload: { intentId: type, data: payload },
      }),
    );
  }

  async waitFor(predicate, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const error = this.messages.find((message) => message.type === 'error');
      if (error)
        throw new Error(`Room WS rejected: ${JSON.stringify(error.payload)}`);
      const index = this.messages.findIndex(predicate);
      if (index >= 0) return this.messages.splice(index, 1)[0];
      await sleep(20);
    }
    throw new Error(`Timeout room WS sur ${this.url}`);
  }

  close() {
    this.socket?.close();
  }
}

async function issueRoomTicket(port, token) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/ws/ticket?scope=room`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = await response.json();
  if (!response.ok || typeof body.ticket !== 'string') {
    throw new Error(`Ticket room invalide sur instance ${port}`);
  }
  return body.ticket;
}

async function waitForDatabase(predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(30);
  }
  throw new Error('État MySQL attendu non atteint');
}

async function main() {
  const firstProcess = startBackend(ports[0]);
  const secondProcess = startBackend(ports[1]);
  await Promise.all(
    ports.map((port) => waitForHttp(`http://127.0.0.1:${port}/health/ready`)),
  );
  if (!isRunning(firstProcess) || !isRunning(secondProcess)) {
    throw new Error('Une instance backend s’est arrêtée pendant le bootstrap');
  }

  const first = new ApiClient(ports[0]);
  const second = new ApiClient(ports[1]);
  await Promise.all([first.connect(), second.connect()]);
  const suffix = `${process.pid}-${Date.now()}`;
  const username = `multi_${suffix}`;
  const email = `${username}@integration.test`;
  const password = 'Shared-backend-42!';
  let roomId = 0;
  let firstRoom;
  let secondRoom;
  try {
    await first.request('auth.register', { email, username, password });
    const login = await first.request('auth.login', { username, password });
    const refreshToken = login.payload?.refreshToken;
    if (typeof refreshToken !== 'string')
      throw new Error('Refresh token absent');

    const refreshed = await second.request('auth.refresh', { refreshToken });
    if (typeof refreshed.payload?.token !== 'string') {
      throw new Error('Refresh inter-instance non partagé');
    }
    const secondLogin = await second.request('auth.login', {
      username,
      password,
    });
    if (secondLogin.payload?.userId !== login.payload?.userId) {
      throw new Error('Identité MySQL différente entre instances');
    }

    const firstTicket = await issueRoomTicket(ports[0], login.payload.token);
    firstRoom = new RoomClient(ports[0], login.payload.token, firstTicket, 0);
    await firstRoom.connect();
    firstRoom.send('room.create', {
      gameType: 'lama',
      name: `Multi-instance ${suffix}`,
      maxPlayers: 4,
      isPrivate: false,
    });
    const created = await firstRoom.waitFor(
      (message) =>
        message?.type === 'room.created' && Number(message.roomId) > 0,
    );
    roomId = Number(created.roomId);

    const secondTicket = await issueRoomTicket(ports[1], login.payload.token);
    secondRoom = new RoomClient(
      ports[1],
      login.payload.token,
      secondTicket,
      roomId,
    );
    await secondRoom.connect();
    await secondRoom.waitFor(
      (message) =>
        message?.type === 'room.updated' &&
        Number(message?.payload?.room?.id) === roomId,
    );

    firstRoom.send('room.toggle-privacy', {
      _trace: { id: `first-${suffix}` },
    });
    secondRoom.send('room.toggle-privacy', {
      _trace: { id: `second-${suffix}` },
    });
    await Promise.all([
      firstRoom.waitFor(
        (message) =>
          message?.type === 'room.privacy' && Number(message.roomId) === roomId,
      ),
      secondRoom.waitFor(
        (message) =>
          message?.type === 'room.privacy' && Number(message.roomId) === roomId,
      ),
    ]);
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    await waitForDatabase(async () => {
      const [rows] = await db.execute(
        'SELECT is_private AS isPrivate FROM rooms WHERE id = ?',
        [roomId],
      );
      return Number(rows[0]?.isPrivate) === 0;
    });
    await db.end();
    const rssGrowthBytes = runMultiInstanceLoad([firstProcess, secondProcess]);
    const redisOutage = await exerciseRedisOutage(
      first,
      refreshed.payload?.refreshToken ?? refreshToken,
      username,
      password,
    );
    const mysqlOutage = await exerciseMysqlOutage(first, username, password);
    firstRoom.close();
    secondRoom.close();
    first.close();
    second.close();
    await stopBackendsGracefully();
    console.log(
      `two-instance-real-e2e: OK (DB/session partagées, commandes concurrentes, charge multi-Room, coupure Redis=${redisOutage}, coupure MySQL=${mysqlOutage}; croissance RSS=${rssGrowthBytes.join('/')})`,
    );
  } finally {
    firstRoom?.close();
    secondRoom?.close();
    first.close();
    second.close();
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    if (roomId > 0) {
      await db.execute('DELETE FROM room_participants WHERE room_id = ?', [
        roomId,
      ]);
      await db.execute('DELETE FROM rooms WHERE id = ?', [roomId]);
    }
    await db.execute('DELETE FROM users WHERE email = ?', [email]);
    await db.end();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    for (const child of processes)
      console.error(child.output.slice(-20).join(''));
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const child of processes) if (isRunning(child)) child.kill('SIGTERM');
    await sleep(500);
    for (const child of processes) if (isRunning(child)) child.kill('SIGKILL');
  });
