#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');
const mysql = require('mysql2/promise');

function loadEnv(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nowMs() {
  return Date.now();
}

function toJsonSafe(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

function withClientVersion(url, version = '9.9.9.9') {
  const u = new URL(url);
  if (!u.searchParams.get('v')) u.searchParams.set('v', version);
  return u.toString();
}

function phaseMs(start) {
  return nowMs() - start;
}

class WsClient {
  constructor(url, label) {
    this.url = url;
    this.label = label;
    this.ws = null;
    this.messages = [];
    this.closedCode = null;
    this.closedReason = '';
  }

  async connect(timeoutMs = 10000) {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`WS connect timeout [${this.label}] ${this.url}`));
      }, timeoutMs);

      ws.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.ws = ws;
        ws.on('message', (raw) => {
          const parsed = toJsonSafe(raw.toString('utf8'));
          if (parsed) this.messages.push(parsed);
        });
        resolve();
      });

      ws.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(err);
      });

      ws.on('close', (code, reason) => {
        this.closedCode = code;
        this.closedReason = String(reason || '');
      });
    });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WS not open [${this.label}]`);
    }
    this.ws.send(JSON.stringify(payload));
  }

  async waitFor(predicate, timeoutMs = 15000, label = 'waitFor') {
    const start = nowMs();
    while (nowMs() - start < timeoutMs) {
      for (let i = 0; i < this.messages.length; i += 1) {
        const msg = this.messages[i];
        if (predicate(msg)) {
          this.messages.splice(i, 1);
          return msg;
        }
      }
      await sleep(20);
    }
    const recent = this.messages.slice(-5);
    throw new Error(
      `Timeout [${this.label}] ${label} (${timeoutMs}ms), recent=${JSON.stringify(recent)}`,
    );
  }

  popAll() {
    const all = [...this.messages];
    this.messages.length = 0;
    return all;
  }

  async close() {
    if (!this.ws) return;
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise((resolve) => {
      const ws = this.ws;
      ws.once('close', () => resolve());
      try {
        ws.close();
      } catch {
        resolve();
      }
      setTimeout(resolve, 1000);
    });
  }
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, ok: res.ok, body };
}

async function queryOne(conn, sql, params) {
  const [rows] = await conn.execute(sql, params);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const size = Math.max(1, Math.floor(limit));
  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: size }, () => consume()));
  return out;
}

async function registerAndLoginOverApiWs(baseWsUrl, user, password) {
  const api = new WsClient(withClientVersion(`${baseWsUrl}/ws/api`), `api:${user.username}`);
  await api.connect();
  try {
    const regRequestId = `reg-${user.username}`;
    api.send({
      requestId: regRequestId,
      type: 'auth.register',
      payload: {
        email: user.email,
        username: user.username,
        password,
      },
    });
    const reg = await api.waitFor(
      (m) =>
        m &&
        m.requestId === regRequestId &&
        (m.type === 'auth.register.ok' || m.type === 'error'),
      20000,
      'auth.register',
    );
    if (reg.type === 'error') {
      throw new Error(
        `auth.register failed [${user.username}]: ${reg?.payload?.message ?? 'unknown'}`,
      );
    }

    const loginRequestId = `login-${user.username}`;
    api.send({
      requestId: loginRequestId,
      type: 'auth.login',
      payload: {
        username: user.username,
        password,
      },
    });
    const login = await api.waitFor(
      (m) =>
        m &&
        m.requestId === loginRequestId &&
        (m.type === 'auth.login.ok' || m.type === 'error'),
      20000,
      'auth.login',
    );
    if (login.type === 'error') {
      throw new Error(
        `auth.login failed [${user.username}]: ${login?.payload?.message ?? 'unknown'}`,
      );
    }
    const token = String(login?.payload?.token || '').trim();
    assert(token.length > 20, `Invalid token for ${user.username}`);
    return token;
  } finally {
    await api.close();
  }
}

async function issueRoomTicket(baseHttpUrl, token) {
  const res = await fetchJson(`${baseHttpUrl}/api/ws/ticket?scope=room`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.ok, `ws/ticket failed: ${res.status}`);
  const ticket = String(res?.body?.ticket || '').trim();
  assert(ticket.length > 20, 'Missing room ticket');
  return ticket;
}

function buildUsers(runId, roomsCount, extraPlayersPerRoom, spectatorsPerRoom) {
  const users = [];
  for (let roomIndex = 0; roomIndex < roomsCount; roomIndex += 1) {
    users.push({
      role: 'owner',
      roomIndex,
      username: `rldow_${roomIndex}_${runId}`,
      email: `rldow.${roomIndex}.${runId}@example.test`,
    });
    for (let i = 0; i < extraPlayersPerRoom; i += 1) {
      users.push({
        role: 'player',
        roomIndex,
        username: `rldpl_${roomIndex}_${i}_${runId}`,
        email: `rldpl.${roomIndex}.${i}.${runId}@example.test`,
      });
    }
    for (let i = 0; i < spectatorsPerRoom; i += 1) {
      users.push({
        role: 'spectator',
        roomIndex,
        username: `rldsp_${roomIndex}_${i}_${runId}`,
        email: `rldsp.${roomIndex}.${i}.${runId}@example.test`,
      });
    }
  }
  return users;
}

function groupByRoom(users, roomsCount) {
  const rooms = Array.from({ length: roomsCount }, (_, index) => ({
    roomIndex: index,
    owner: null,
    players: [],
    spectators: [],
  }));
  for (const user of users) {
    const room = rooms[user.roomIndex];
    if (user.role === 'owner') room.owner = user;
    if (user.role === 'player') room.players.push(user);
    if (user.role === 'spectator') room.spectators.push(user);
  }
  return rooms;
}

async function main() {
  const backendRoot = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendRoot, '.env'));

  const baseHttpUrl = process.env.E2E_BASE_HTTP_URL || 'http://127.0.0.1:3001';
  const baseWsUrl = process.env.E2E_BASE_WS_URL || 'ws://127.0.0.1:3001';
  const roomsCount = Number(process.env.ROOM_LOAD_ROOMS || 5);
  const extraPlayersPerRoom = Number(process.env.ROOM_LOAD_EXTRA_PLAYERS || 2);
  const spectatorsPerRoom = Number(process.env.ROOM_LOAD_SPECTATORS || 1);
  const poolSize = Number(process.env.ROOM_LOAD_CONCURRENCY || 8);
  const password = process.env.ROOM_LOAD_PASSWORD || 'Passw0rd!Load';
  const runId = `${Date.now().toString(36)}${Math.floor(
    Math.random() * 1_000_000,
  )
    .toString(36)
    .padStart(4, '0')}`;

  assert(roomsCount >= 1, 'ROOM_LOAD_ROOMS must be >= 1');
  assert(extraPlayersPerRoom >= 1, 'ROOM_LOAD_EXTRA_PLAYERS must be >= 1');
  assert(spectatorsPerRoom >= 0, 'ROOM_LOAD_SPECTATORS must be >= 0');

  const users = buildUsers(
    runId,
    roomsCount,
    extraPlayersPerRoom,
    spectatorsPerRoom,
  );
  const rooms = groupByRoom(users, roomsCount);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || env.DB_PORT || 3306),
    user: process.env.DB_USER || env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || env.DB_PASSWORD || '',
    database: process.env.DB_NAME || env.DB_NAME || 'le_monde_de_lila',
  });

  const allSockets = [];
  const createdRoomIds = [];
  const summary = {
    roomsCount,
    extraPlayersPerRoom,
    spectatorsPerRoom,
    totalUsers: users.length,
    timingsMs: {},
  };

  try {
    const health = await fetchJson(`${baseHttpUrl}/health`, { method: 'GET' });
    assert(health.ok, `Health check failed: ${health.status}`);

    const authStart = nowMs();
    await runPool(users, poolSize, async (user) => {
      user.token = await registerAndLoginOverApiWs(baseWsUrl, user, password);
      user.ticket = await issueRoomTicket(baseHttpUrl, user.token);
      return user;
    });
    summary.timingsMs.authAndTickets = phaseMs(authStart);

    const createStart = nowMs();
    await runPool(rooms, poolSize, async (room) => {
      const owner = room.owner;
      assert(owner, `Missing owner for room index ${room.roomIndex}`);

      const ws = new WsClient(
        withClientVersion(
          `${baseWsUrl}/ws?token=${encodeURIComponent(owner.token)}&ticket=${encodeURIComponent(owner.ticket)}`,
        ),
        `owner:${owner.username}`,
      );
      owner.ws = ws;
      allSockets.push(ws);
      await ws.connect();
      await sleep(250);
      ws.send({
        type: 'room.create',
        payload: {
          gameType: 'lama',
          name: `ROOM-LOAD-${room.roomIndex}-${runId}`,
          maxPlayers: 6,
          isPrivate: false,
        },
      });

      const createdOrUpdated = await ws.waitFor(
        (m) =>
          m &&
          ((m.type === 'room.created' && Number(m.roomId) > 0) ||
            (m.type === 'room.updated' &&
              Number(m?.payload?.room?.id || 0) > 0)),
        25000,
        'room.create',
      );

      const roomId =
        createdOrUpdated.type === 'room.created'
          ? Number(createdOrUpdated.roomId)
          : Number(createdOrUpdated?.payload?.room?.id || 0);
      assert(roomId > 0, `Invalid roomId for owner ${owner.username}`);
      room.roomId = roomId;
      createdRoomIds.push(roomId);
    });
    summary.timingsMs.createRooms = phaseMs(createStart);

    const joinStart = nowMs();
    const joinWork = [];
    for (const room of rooms) {
      for (const user of room.players) {
        joinWork.push({ user, roomId: room.roomId, spectator: false });
      }
      for (const user of room.spectators) {
        joinWork.push({ user, roomId: room.roomId, spectator: true });
      }
    }
    await runPool(joinWork, poolSize, async (job) => {
      const ws = new WsClient(
        withClientVersion(
          `${baseWsUrl}/ws?token=${encodeURIComponent(job.user.token)}&ticket=${encodeURIComponent(job.user.ticket)}&room=${job.roomId}${job.spectator ? '&spectator=true' : ''}`,
        ),
        `${job.spectator ? 'spectator' : 'player'}:${job.user.username}`,
      );
      job.user.ws = ws;
      allSockets.push(ws);
      await ws.connect();
      await ws.waitFor(
        (m) =>
          m &&
          m.type === 'room.updated' &&
          Number(m.roomId) === Number(job.roomId),
        25000,
        'room.join state',
      );
    });
    summary.timingsMs.joinUsers = phaseMs(joinStart);

    const startStart = nowMs();
    await runPool(rooms, poolSize, async (room) => {
      const owner = room.owner;
      owner.ws.send({
        type: 'room.start',
        payload: { _trace: { id: `load-start-${room.roomIndex}`, sentAtMs: nowMs() } },
      });
      await owner.ws.waitFor(
        (m) =>
          m &&
          m.type === 'room.ack' &&
          Number(m.roomId) === Number(room.roomId) &&
          m?.payload?.action === 'room.start',
        25000,
        'room.start ack',
      );
      await owner.ws.waitFor(
        (m) =>
          m &&
          m.type === 'room.updated' &&
          Number(m.roomId) === Number(room.roomId) &&
          String(m?.payload?.room?.status || '').toLowerCase() === 'started',
        25000,
        'room.start updated',
      );
    });
    summary.timingsMs.startRooms = phaseMs(startStart);

    const dbValidateStart = nowMs();
    for (const room of rooms) {
      const row = await queryOne(
        db,
        'SELECT status, started_at, run_id FROM rooms WHERE id = ?',
        [room.roomId],
      );
      assert(row, `Missing room in DB id=${room.roomId}`);
      assert(
        String(row.status).toLowerCase() === 'started',
        `Room not started in DB id=${room.roomId}`,
      );
      assert(row.started_at != null, `started_at null in DB id=${room.roomId}`);
      assert(Number(row.run_id) >= 1, `run_id not incremented id=${room.roomId}`);
    }
    summary.timingsMs.validateDbStarted = phaseMs(dbValidateStart);

    const chatStart = nowMs();
    const chatWork = [];
    for (const room of rooms) {
      chatWork.push({ user: room.owner, roomId: room.roomId, kind: 'owner' });
      for (const user of room.players) {
        chatWork.push({ user, roomId: room.roomId, kind: 'player' });
      }
      for (const user of room.spectators) {
        chatWork.push({ user, roomId: room.roomId, kind: 'spectator' });
      }
    }

    await runPool(chatWork, poolSize, async (job, index) => {
      const msg = `load-chat-${job.roomId}-${job.kind}-${index}-${runId}`;
      job.user._sentMessage = msg;
      job.user.ws.send({
        type: 'room.chat.send',
        payload: { message: msg },
      });
    });

    for (const room of rooms) {
      const owner = room.owner;
      owner.ws.send({ type: 'room.chat.history', payload: {} });
      const history = await owner.ws.waitFor(
        (m) =>
          m &&
          m.type === 'room.chat.history' &&
          Number(m.roomId) === Number(room.roomId),
        25000,
        'chat.history',
      );
      const minExpected =
        1 + room.players.length + room.spectators.length;
      const count = Array.isArray(history?.payload?.messages)
        ? history.payload.messages.length
        : 0;
      assert(
        count >= minExpected,
        `chat.history too short room=${room.roomId} count=${count} expected>=${minExpected}`,
      );
    }
    summary.timingsMs.chatAndHistory = phaseMs(chatStart);

    const participantsStart = nowMs();
    for (const room of rooms) {
      const row = await queryOne(
        db,
        'SELECT COUNT(*) AS c FROM room_participants WHERE room_id = ? AND left_at IS NULL',
        [room.roomId],
      );
      const expectedParticipants = 1 + room.players.length;
      assert(
        Number(row?.c || 0) === expectedParticipants,
        `participants mismatch room=${room.roomId} got=${Number(row?.c || 0)} expected=${expectedParticipants}`,
      );
    }
    summary.timingsMs.validateParticipants = phaseMs(participantsStart);

    console.log('ROOM LOAD TEST REPORT');
    console.log(
      `- Config: rooms=${roomsCount}, extraPlayersPerRoom=${extraPlayersPerRoom}, spectatorsPerRoom=${spectatorsPerRoom}, users=${users.length}, pool=${poolSize}`,
    );
    console.log(`- Phase auth+tickets: ${summary.timingsMs.authAndTickets}ms`);
    console.log(`- Phase create rooms: ${summary.timingsMs.createRooms}ms`);
    console.log(`- Phase join users: ${summary.timingsMs.joinUsers}ms`);
    console.log(`- Phase start rooms: ${summary.timingsMs.startRooms}ms`);
    console.log(
      `- Phase validate DB started: ${summary.timingsMs.validateDbStarted}ms`,
    );
    console.log(`- Phase chat+history: ${summary.timingsMs.chatAndHistory}ms`);
    console.log(
      `- Phase validate participants: ${summary.timingsMs.validateParticipants}ms`,
    );
    console.log(`- Rooms created: ${createdRoomIds.length}`);
    console.log('RESULT: PASS');
  } finally {
    for (const ws of allSockets.reverse()) {
      try {
        await ws.close();
      } catch {
        // best effort
      }
    }

    try {
      if (createdRoomIds.length > 0) {
        const placeholders = createdRoomIds.map(() => '?').join(',');
        await db.execute(
          `DELETE FROM rooms WHERE id IN (${placeholders})`,
          createdRoomIds,
        );
      }
    } catch {
      // best effort
    }

    try {
      if (users.length > 0) {
        const usernames = users.map((u) => String(u.username));
        const placeholders = usernames.map(() => '?').join(',');
        await db.execute(
          `DELETE FROM users WHERE username IN (${placeholders})`,
          usernames,
        );
      }
    } catch {
      // best effort
    }

    try {
      await db.end();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('ROOM LOAD TEST RESULT: FAIL');
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
