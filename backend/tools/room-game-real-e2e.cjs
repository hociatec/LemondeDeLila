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
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      for (let i = 0; i < this.messages.length; i += 1) {
        const msg = this.messages[i];
        if (predicate(msg)) {
          this.messages.splice(i, 1);
          return msg;
        }
      }
      await sleep(20);
    }
    const recent = this.messages.slice(-6);
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
      setTimeout(resolve, 1200);
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
        `auth.register failed [${user.username}]: ${reg?.payload?.message ?? 'unknown error'}`,
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
        `auth.login failed [${user.username}]: ${login?.payload?.message ?? 'unknown error'}`,
      );
    }
    const token = String(login?.payload?.token || '').trim();
    assert(token.length > 20, `Invalid token for ${user.username}`);
    return token;
  } finally {
    await api.close();
  }
}

async function issueTicket(baseHttpUrl, token, scope) {
  const result = await fetchJson(`${baseHttpUrl}/api/ws/ticket?scope=${scope}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assert(result.ok, `Ticket HTTP failed scope=${scope} status=${result.status}`);
  const ticket = String(result?.body?.ticket || '').trim();
  assert(ticket.length > 20, `Missing ws ${scope} ticket`);
  return ticket;
}

function pickActionTypeFromState(gameStatePayload) {
  const actionsRaw = Array.isArray(gameStatePayload?.actions)
    ? gameStatePayload.actions
    : Array.isArray(gameStatePayload?.availableActions)
      ? gameStatePayload.availableActions
      : [];
  const types = actionsRaw
    .map((a) => {
      if (typeof a === 'string') return a.trim();
      if (a && typeof a === 'object' && typeof a.type === 'string') {
        return a.type.trim();
      }
      return '';
    })
    .filter((t) => t.length > 0);
  if (types.length === 0) return null;
  const preferred = ['draw', 'draw_card', 'pass', 'play', 'play_card'];
  for (const p of preferred) {
    const hit = types.find((t) => t.toLowerCase() === p);
    if (hit) return hit;
  }
  return types[0];
}

async function main() {
  const backendRoot = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendRoot, '.env'));
  const baseHttpUrl = process.env.E2E_BASE_HTTP_URL || 'http://127.0.0.1:3001';
  const baseWsUrl = process.env.E2E_BASE_WS_URL || 'ws://127.0.0.1:3001';
  const runId = `${Date.now().toString(36)}${Math.floor(
    Math.random() * 1_000_000,
  )
    .toString(36)
    .padStart(4, '0')}`;

  const users = [
    {
      key: 'owner',
      username: `gmeown_${runId}`,
      email: `gme.owner.${runId}@example.test`,
    },
    {
      key: 'player',
      username: `gmeply_${runId}`,
      email: `gme.player.${runId}@example.test`,
    },
    {
      key: 'spectator',
      username: `gmespc_${runId}`,
      email: `gme.spectator.${runId}@example.test`,
    },
  ];
  const password = 'Passw0rd!GameE2E';

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || env.DB_PORT || 3306),
    user: process.env.DB_USER || env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || env.DB_PASSWORD || '',
    database: process.env.DB_NAME || env.DB_NAME || 'le_monde_de_lila',
  });

  const report = [];
  const sockets = [];
  let roomId = 0;

  try {
    const health = await fetchJson(`${baseHttpUrl}/health`, { method: 'GET' });
    assert(health.ok, `Health endpoint failed: ${health.status}`);
    report.push('Health check: OK');

    for (const user of users) {
      user.token = await registerAndLoginOverApiWs(baseWsUrl, user, password);
      user.roomTicket = await issueTicket(baseHttpUrl, user.token, 'room');
      user.gameTicket = await issueTicket(baseHttpUrl, user.token, 'game');
    }
    report.push('Auth + ws tickets(room/game) x3: OK');

    const ownerUser = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ?',
      [users[0].username],
    );
    const playerUser = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ?',
      [users[1].username],
    );
    const spectatorUser = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ?',
      [users[2].username],
    );
    assert(ownerUser?.id && playerUser?.id && spectatorUser?.id, 'User ids not found');

    const ownerRoomWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(users[0].token)}&ticket=${encodeURIComponent(users[0].roomTicket)}`,
      ),
      'room-owner',
    );
    sockets.push(ownerRoomWs);
    await ownerRoomWs.connect();
    await sleep(250);

    ownerRoomWs.send({
      type: 'room.create',
      payload: {
        gameType: 'lama',
        name: `ROOM-GAME-E2E-${runId}`,
        maxPlayers: 4,
        isPrivate: false,
      },
    });
    const createdOrUpdated = await ownerRoomWs.waitFor(
      (m) =>
        m &&
        ((m.type === 'room.created' && Number(m.roomId) > 0) ||
          (m.type === 'room.updated' &&
            Number(m?.payload?.room?.id || 0) > 0)),
      25000,
      'room.create',
    );
    roomId =
      createdOrUpdated.type === 'room.created'
        ? Number(createdOrUpdated.roomId)
        : Number(createdOrUpdated?.payload?.room?.id || 0);
    assert(roomId > 0, 'Invalid roomId');
    report.push('Room created for game flow: OK');

    // The WX client opens gameplay while the room is still in setup so the
    // owner can answer server-driven configuration prompts before room.start.
    // This transition must remain valid independently from the started flow.
    const setupGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[0].token)}&ticket=${encodeURIComponent(users[0].gameTicket)}&roomId=${roomId}&gameType=lama`,
      ),
      'game-owner-setup',
    );
    sockets.push(setupGameWs);
    await setupGameWs.connect();
    const setupGameState = await setupGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.state' &&
        String(m?.payload?.system?.match?.status || '').toLowerCase() ===
          'setup',
      25000,
      'game.owner.setupState',
    );
    assert(
      Number(setupGameState?.payload?.runId || 0) === 1,
      'Setup game state must reserve room run 1',
    );
    await setupGameWs.close();
    users[0].gameTicket = await issueTicket(
      baseHttpUrl,
      users[0].token,
      'game',
    );
    report.push('Game ws join while room is in setup: OK');

    const playerRoomWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(users[1].token)}&ticket=${encodeURIComponent(users[1].roomTicket)}&room=${roomId}`,
      ),
      'room-player',
    );
    sockets.push(playerRoomWs);
    await playerRoomWs.connect();
    await playerRoomWs.waitFor(
      (m) => m && m.type === 'room.updated' && Number(m.roomId) === roomId,
      25000,
      'room.player.join',
    );

    ownerRoomWs.send({
      type: 'room.start',
      payload: { _trace: { id: `rg-start-${runId}`, sentAtMs: Date.now() } },
    });
    await ownerRoomWs.waitFor(
      (m) => m && m.type === 'room.ack' && m?.payload?.action === 'room.start',
      25000,
      'room.start ack',
    );
    await ownerRoomWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.updated' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.room?.status || '').toLowerCase() === 'started',
      25000,
      'room.updated started',
    );
    report.push('Room started before game join: OK');

    const spectatorRoomWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(users[2].token)}&ticket=${encodeURIComponent(users[2].roomTicket)}&room=${roomId}&spectator=true`,
      ),
      'room-spectator',
    );
    sockets.push(spectatorRoomWs);
    await spectatorRoomWs.connect();
    await spectatorRoomWs.waitFor(
      (m) => m && m.type === 'room.updated' && Number(m.roomId) === roomId,
      25000,
      'room.spectator.join',
    );

    const ownerGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[0].token)}&ticket=${encodeURIComponent(users[0].gameTicket)}&roomId=${roomId}&gameType=lama`,
      ),
      'game-owner',
    );
    sockets.push(ownerGameWs);
    await ownerGameWs.connect();
    const ownerGameInitialState = await ownerGameWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.owner.initialState',
    );

    const playerGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[1].token)}&ticket=${encodeURIComponent(users[1].gameTicket)}&roomId=${roomId}&gameType=lama`,
      ),
      'game-player',
    );
    sockets.push(playerGameWs);
    await playerGameWs.connect();
    await playerGameWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.player.initialState',
    );

    const spectatorGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[2].token)}&ticket=${encodeURIComponent(users[2].gameTicket)}&roomId=${roomId}&gameType=lama`,
      ),
      'game-spectator',
    );
    sockets.push(spectatorGameWs);
    await spectatorGameWs.connect();
    await spectatorGameWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.spectator.initialState',
    );
    report.push('Game ws join (owner/player/spectator) with initial state: OK');

    ownerGameWs.send({ type: 'game.rules', payload: { gameType: 'lama' } });
    const rules = await ownerGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.rules' &&
        String(m?.payload?.gameType || '').toLowerCase() === 'lama',
      25000,
      'game.rules',
    );
    assert(
      rules?.payload?.rules != null,
      'game.rules payload.rules missing',
    );

    ownerGameWs.send({ type: 'game.turn', payload: { roomId, gameType: 'lama' } });
    const turnInfo = await ownerGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.turn' &&
        Number(m?.payload?.roomId || 0) === roomId &&
        String(m?.payload?.gameType || '').toLowerCase() === 'lama',
      25000,
      'game.turn',
    );
    assert(
      typeof turnInfo?.payload?.status === 'string',
      'game.turn missing status',
    );

    ownerGameWs.send({ type: 'game.state', payload: { roomId, gameType: 'lama' } });
    const ownerState = await ownerGameWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.state owner',
    );
    playerGameWs.send({ type: 'game.state', payload: { roomId, gameType: 'lama' } });
    const playerState = await playerGameWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.state player',
    );
    report.push('Game rules/turn/state requests: OK');

    const currentPlayerId =
      typeof ownerState?.payload?.system?.turn?.currentPlayerId === 'number'
        ? ownerState.payload.system.turn.currentPlayerId
        : null;
    assert(currentPlayerId != null, 'currentPlayerId missing in game state');

    const actorWs =
      currentPlayerId === Number(ownerUser.id)
        ? ownerGameWs
        : currentPlayerId === Number(playerUser.id)
          ? playerGameWs
          : null;
    assert(actorWs, `Unexpected currentPlayerId=${currentPlayerId}, expected owner/player`);

    actorWs.send({ type: 'game.state', payload: { roomId, gameType: 'lama' } });
    const actorState = await actorWs.waitFor(
      (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
      25000,
      'game.state actor',
    );
    const actionType = pickActionTypeFromState(actorState.payload);
    assert(actionType, 'No available game action found in actor state');

    ownerGameWs.popAll();
    playerGameWs.popAll();
    actorWs.send({
      type: 'game.action',
      payload: {
        roomId,
        gameType: 'lama',
        actions: [{ type: actionType, payload: {} }],
        _trace: { id: `ga-${runId}`, sentAtMs: Date.now() },
      },
    });
    await actorWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.ack' &&
        ['game.action', 'game.actions'].includes(
          String(m?.payload?.action || ''),
        ),
      25000,
      'game.actions ack',
    );
    await ownerGameWs.waitFor(
      (m) =>
        m &&
        (m.type === 'game.state' || m.type === 'game.patch'),
      25000,
      'owner receives game state/patch after action',
    );
    await playerGameWs.waitFor(
      (m) =>
        m &&
        (m.type === 'game.state' || m.type === 'game.patch'),
      25000,
      'player receives game state/patch after action',
    );
    report.push(`Game action path validated (type=${actionType}): OK`);

    ownerGameWs.send({
      type: 'game.key',
      payload: {
        roomId,
        gameType: 'lama',
        key: 'X',
        _trace: { id: `gk-reset-${runId}`, sentAtMs: Date.now() },
      },
    });
    await ownerGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.ack' &&
        String(m?.payload?.action || '') === 'game.key' &&
        String(m?.payload?.roomOp || '') === 'reset',
      25000,
      'game.key reset ack',
    );
    const afterResetDb = await queryOne(
      db,
      'SELECT status, started_at FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(
      afterResetDb &&
        String(afterResetDb.status).toLowerCase() === 'setup' &&
        afterResetDb.started_at == null,
      'Room DB should be setup after game.key X',
    );

    ownerGameWs.send({
      type: 'game.key',
      payload: {
        roomId,
        gameType: 'lama',
        key: 'ENTER',
        _trace: { id: `gk-start-${runId}`, sentAtMs: Date.now() },
      },
    });
    await ownerGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'game.ack' &&
        String(m?.payload?.action || '') === 'game.key' &&
        String(m?.payload?.roomOp || '') === 'start',
      25000,
      'game.key start ack',
    );
    const afterStartDb = await queryOne(
      db,
      'SELECT status, started_at, run_id FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(
      afterStartDb &&
        String(afterStartDb.status).toLowerCase() === 'started' &&
        afterStartDb.started_at != null &&
        Number(afterStartDb.run_id) >= 2,
      'Room DB should be started after game.key ENTER',
    );
    report.push('Game key flow (X reset / ENTER start) bridged to room service: OK');

    ownerRoomWs.send({ type: 'room.toggle-privacy', payload: {} });
    await ownerRoomWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.privacy' &&
        Number(m.roomId) === roomId &&
        m?.payload?.isPrivate === true,
      25000,
      'room.toggle-privacy private',
    );

    spectatorGameWs.send({
      type: 'game.state',
      payload: { roomId, gameType: 'lama' },
    });
    await spectatorGameWs.waitFor(
      (m) =>
        m &&
        m.type === 'error' &&
        String(m?.context || '') === 'game.state' &&
        String(m?.payload?.message || '').toLowerCase().includes('accès non autorisé'),
      25000,
      'spectator game.state denied on private room',
    );
    report.push('Private room read access enforced on game.state for spectator: OK');

    console.log('ROOM->GAME REAL E2E REPORT');
    for (const line of report) {
      console.log(`- ${line}`);
    }
    console.log('RESULT: PASS');
  } finally {
    for (const ws of sockets.reverse()) {
      try {
        await ws.close();
      } catch {
        // ignore
      }
    }

    try {
      if (roomId > 0) {
        await db.execute('DELETE FROM rooms WHERE id = ?', [roomId]);
      }
    } catch {
      // best effort
    }
    try {
      const usernames = users.map((u) => String(u.username || '').trim());
      if (usernames.length > 0) {
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
  console.error('RESULT: FAIL');
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
