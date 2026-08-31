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
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toJsonSafe(text) {
  try {
    return JSON.parse(String(text));
  } catch {
    return null;
  }
}

class WsClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messages = [];
  }

  async connect(timeoutMs = 8000) {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`WS connect timeout: ${this.url}`));
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

  send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WS not open');
    }
    this.ws.send(JSON.stringify(obj));
  }

  async waitFor(predicate, timeoutMs = 8000, label = 'waitFor') {
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
    const recent = this.messages.slice(-5);
    throw new Error(
      `Timeout ${label} (${timeoutMs}ms). recent=${JSON.stringify(recent)}`,
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
      const done = () => resolve();
      ws.once('close', done);
      try {
        ws.close();
      } catch {
        resolve();
      }
      setTimeout(resolve, 1000);
    });
  }
}

function withClientVersion(url, version = '9.9.9.9') {
  const u = new URL(url);
  if (!u.searchParams.get('v')) {
    u.searchParams.set('v', version);
  }
  return u.toString();
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

async function registerAndLoginOverApiWs(baseWsUrl, user, password) {
  const api = new WsClient(withClientVersion(`${baseWsUrl}/ws/api`));
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
      9000,
      `auth.register ${user.username}`,
    );
    if (reg.type === 'error') {
      throw new Error(
        `auth.register failed for ${user.username}: ${reg?.payload?.message ?? 'unknown error'}`,
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
      9000,
      `auth.login ${user.username}`,
    );
    if (login.type === 'error') {
      throw new Error(
        `auth.login failed for ${user.username}: ${login?.payload?.message ?? 'unknown error'}`,
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
  const result = await fetchJson(`${baseHttpUrl}/api/ws/ticket?scope=room`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assert(result.ok, `Ticket HTTP failed: ${result.status}`);
  const ticket = String(result?.body?.ticket || '').trim();
  assert(ticket.length > 20, 'Missing ws room ticket');
  return ticket;
}

async function queryOne(conn, sql, params) {
  const [rows] = await conn.execute(sql, params);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0];
}

function historyHasMessage(historyPayload, expectedText) {
  const messages = historyPayload?.messages;
  if (!Array.isArray(messages)) return false;
  return messages.some(
    (m) => String(m?.message || '').trim() === String(expectedText).trim(),
  );
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
  const password = 'Passw0rd!E2E';

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || env.DB_PORT || 3306),
    user: process.env.DB_USER || env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || env.DB_PASSWORD || '',
    database: process.env.DB_NAME || env.DB_NAME || 'le_monde_de_lila',
  });

  const users = [
    {
      username: `e2eown_${runId}`,
      email: `e2e.owner.${runId}@example.test`,
    },
    {
      username: `e2eply_${runId}`,
      email: `e2e.player.${runId}@example.test`,
    },
    {
      username: `e2espc_${runId}`,
      email: `e2e.spectator.${runId}@example.test`,
    },
    {
      username: `e2eblk_${runId}`,
      email: `e2e.blocked.${runId}@example.test`,
    },
  ];

  const report = [];
  let ownerWs;
  let playerWs;
  let spectatorWs;
  let blockedWs;
  let roomId = 0;
  let ownerToken = '';
  let playerToken = '';
  let spectatorToken = '';
  let blockedToken = '';

  try {
    const health = await fetchJson(`${baseHttpUrl}/health`, { method: 'GET' });
    assert(health.ok, `Health endpoint failed: ${health.status}`);
    report.push('Health check: OK');

    ownerToken = await registerAndLoginOverApiWs(baseWsUrl, users[0], password);
    playerToken = await registerAndLoginOverApiWs(baseWsUrl, users[1], password);
    spectatorToken = await registerAndLoginOverApiWs(
      baseWsUrl,
      users[2],
      password,
    );
    blockedToken = await registerAndLoginOverApiWs(baseWsUrl, users[3], password);
    report.push('WS API auth.register/auth.login x4: OK');

    const ownerTicket = await issueRoomTicket(baseHttpUrl, ownerToken);
    const playerTicket = await issueRoomTicket(baseHttpUrl, playerToken);
    const spectatorTicket = await issueRoomTicket(baseHttpUrl, spectatorToken);
    const blockedTicket = await issueRoomTicket(baseHttpUrl, blockedToken);
    report.push('HTTP /api/ws/ticket scope=room x4: OK');

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
    assert(ownerUser?.id, 'owner user id missing');
    assert(playerUser?.id, 'player user id missing');
    assert(spectatorUser?.id, 'spectator user id missing');

    ownerWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(ownerToken)}&ticket=${encodeURIComponent(ownerTicket)}`,
      ),
    );
    await ownerWs.connect();
    // RoomGateway may still be finishing async connection setup right after WS open.
    await sleep(300);

    const createPayload = {
      type: 'room.create',
      payload: {
        gameType: 'lama',
        name: `E2E Room ${runId}`,
        maxPlayers: 4,
        isPrivate: false,
      },
    };
    ownerWs.send(createPayload);
    let createdOrUpdated;
    try {
      createdOrUpdated = await ownerWs.waitFor(
        (m) =>
          m &&
          ((m.type === 'room.created' && Number(m.roomId) > 0) ||
            (m.type === 'room.updated' &&
              Number(m?.payload?.room?.id || 0) > 0)),
        20000,
        'room.created|room.updated',
      );
    } catch {
      // Retry once for transient first-message races.
      ownerWs.send(createPayload);
      createdOrUpdated = await ownerWs.waitFor(
        (m) =>
          m &&
          ((m.type === 'room.created' && Number(m.roomId) > 0) ||
            (m.type === 'room.updated' &&
              Number(m?.payload?.room?.id || 0) > 0)),
        20000,
        'room.created|room.updated retry',
      );
    }
    roomId =
      createdOrUpdated.type === 'room.created'
        ? Number(createdOrUpdated.roomId)
        : Number(createdOrUpdated?.payload?.room?.id || 0);
    assert(roomId > 0, 'roomId invalide');

    const roomDb = await queryOne(
      db,
      'SELECT id, status, game_type, is_private, started_at, run_id FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(roomDb && Number(roomDb.id) === roomId, 'Room not persisted in DB');
    assert(String(roomDb.status).toLowerCase() === 'setup', 'Room status expected setup');
    report.push('Scenario 1 - room.create persisted in MySQL: OK');

    const startWizardIntent = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.intent' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.type || '') === 'start-wizard',
      20000,
      'room.intent start-wizard',
    );
    assert(
      Number(startWizardIntent?.payload?.payload?.ownerId || 0) ===
        Number(ownerUser.id),
      'start-wizard ownerId mismatch',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.intent' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.type || '') === 'announcement' &&
        String(m?.payload?.payload?.message || '').toLowerCase().includes('table'),
      20000,
      'room.intent announcement on create',
    );
    report.push('Scenario 2 - room start-wizard + create announcement intents: OK');

    playerWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(playerToken)}&ticket=${encodeURIComponent(playerTicket)}&room=${roomId}`,
      ),
    );
    await playerWs.connect();
    await playerWs.waitFor(
      (m) => m && m.type === 'room.updated' && Number(m.roomId) === roomId,
      20000,
      'player room.updated after connect',
    );

    const participantsAfterJoin = await queryOne(
      db,
      'SELECT COUNT(*) AS c FROM room_participants WHERE room_id = ? AND left_at IS NULL',
      [roomId],
    );
    assert(Number(participantsAfterJoin.c) === 2, 'Expected 2 active participants');
    report.push('Scenario 3 - second player joins and DB participants=2: OK');

    ownerWs.popAll();
    playerWs.popAll();

    const addBotTraceId = `bot-add-${runId}`;
    ownerWs.send({
      type: 'bot.add',
      payload: { _trace: { id: addBotTraceId, sentAtMs: Date.now() } },
    });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.ack' &&
        m?.payload?.action === 'bot.add' &&
        m?.payload?.traceId === addBotTraceId,
      20000,
      'owner bot.add ack',
    );
    const botAdded = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'bot.added' &&
        Number(m.roomId) === roomId &&
        Number(m?.payload?.bot?.id || 0) > 0,
      20000,
      'owner bot.added',
    );
    const botId = Number(botAdded.payload.bot.id);
    const roomWithBot = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.updated' &&
        Number(m.roomId) === roomId &&
        Array.isArray(m?.payload?.room?.bots) &&
        m.payload.room.bots.some((bot) => Number(bot?.id) === botId),
      20000,
      'owner room.updated after bot.add',
    );
    assert(
      roomWithBot.payload.room.allowedActions.includes('bot.remove'),
      'bot.remove must be allowed after bot.add',
    );
    const persistedBot = await queryOne(
      db,
      'SELECT id, room_id, name FROM room_bots WHERE id = ? AND room_id = ?',
      [botId, roomId],
    );
    assert(persistedBot, 'Added bot not persisted in DB');

    ownerWs.popAll();
    playerWs.popAll();
    const removeBotTraceId = `bot-remove-${runId}`;
    ownerWs.send({
      type: 'bot.remove',
      payload: { _trace: { id: removeBotTraceId, sentAtMs: Date.now() } },
    });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.ack' &&
        m?.payload?.action === 'bot.remove' &&
        m?.payload?.traceId === removeBotTraceId,
      20000,
      'owner bot.remove ack',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'bot.removed' &&
        Number(m.roomId) === roomId &&
        Number(m?.payload?.botId || 0) === botId,
      20000,
      'owner bot.removed',
    );
    const roomWithoutBot = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.updated' &&
        Number(m.roomId) === roomId &&
        Array.isArray(m?.payload?.room?.bots) &&
        !m.payload.room.bots.some((bot) => Number(bot?.id) === botId),
      20000,
      'owner room.updated after bot.remove',
    );
    assert(
      roomWithoutBot.payload.room.allowedActions.includes('bot.add'),
      'bot.add must be allowed after bot.remove',
    );
    const removedBot = await queryOne(
      db,
      'SELECT id FROM room_bots WHERE id = ? AND room_id = ?',
      [botId, roomId],
    );
    assert(!removedBot, 'Removed bot still persisted in DB');

    const pingSentAtMs = Date.now();
    ownerWs.send({ type: 'room.ping', payload: { clientSentAtMs: pingSentAtMs } });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.pong' &&
        Number(m.roomId) === roomId &&
        Number(m?.payload?.clientSentAtMs) === pingSentAtMs,
      20000,
      'owner room.pong after bot add/remove',
    );
    assert(
      ownerWs.ws?.readyState === WebSocket.OPEN && ownerWs.closedCode == null,
      `Owner WS closed after bot add/remove: ${ownerWs.closedCode || 'unknown'}`,
    );
    report.push(
      'Scenario 4 - bot.add/B + bot.remove/Maj+B + DB + socket still connected: OK',
    );

    const ownerChatMessage = `chat-owner-${runId}`;
    ownerWs.send({ type: 'room.chat.send', payload: { message: ownerChatMessage } });
    const ownerChatEcho = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.chat.message' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.message || '') === ownerChatMessage,
      20000,
      'owner chat echo',
    );
    assert(
      String(ownerChatEcho?.payload?.username || '') === users[0].username,
      'owner chat username mismatch',
    );
    const playerChatReceive = await playerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.chat.message' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.message || '') === ownerChatMessage,
      20000,
      'player receives owner chat',
    );
    assert(
      Number(playerChatReceive?.payload?.userId || 0) === Number(ownerUser.id),
      'player chat sender id mismatch',
    );

    ownerWs.send({ type: 'room.chat.send', payload: { message: `chat-fast-${runId}` } });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'error' &&
        String(m?.payload?.message || '').toLowerCase().includes('trop rapide'),
      20000,
      'chat cooldown error',
    );

    await sleep(450);
    const playerChatMessage = `chat-player-${runId}`;
    playerWs.send({ type: 'room.chat.send', payload: { message: playerChatMessage } });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.chat.message' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.message || '') === playerChatMessage,
      20000,
      'owner receives player chat',
    );

    playerWs.send({ type: 'room.chat.history', payload: {} });
    const playerHistory = await playerWs.waitFor(
      (m) => m && m.type === 'room.chat.history' && Number(m.roomId) === roomId,
      20000,
      'player chat history',
    );
    assert(
      historyHasMessage(playerHistory.payload, ownerChatMessage) &&
        historyHasMessage(playerHistory.payload, playerChatMessage),
      'player history missing expected chat messages',
    );

    ownerWs.send({
      type: 'room.intent.execute',
      payload: {
        intentId: 'room.chat.history',
        payload: {},
      },
    });
    const ownerHistoryViaIntent = await ownerWs.waitFor(
      (m) => m && m.type === 'room.chat.history' && Number(m.roomId) === roomId,
      20000,
      'owner chat history via intent',
    );
    assert(
      historyHasMessage(ownerHistoryViaIntent.payload, ownerChatMessage),
      'owner history via intent missing owner message',
    );

    ownerWs.send({
      type: 'room.intent.execute',
      payload: {
        intentId: 'room.info',
        payload: {},
      },
    });
    const infoViaIntent = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.info' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.message || '').toLowerCase().includes('table'),
      20000,
      'room.info via intent',
    );
    assert(
      String(infoViaIntent?.payload?.message || '').length > 0,
      'room.info empty message',
    );
    report.push(
      'Scenario 5 - chat send/receive/history + cooldown + intent.execute(room.chat.history/room.info): OK',
    );

    ownerWs.popAll();
    playerWs.popAll();

    playerWs.send({ type: 'room.start', payload: {} });
    const startDenied = await playerWs.waitFor(
      (m) =>
        m &&
        m.type === 'error' &&
        typeof m?.payload?.message === 'string' &&
        m.payload.message.toLowerCase().includes('propriétaire'),
      20000,
      'non-owner room.start denied',
    );
    assert(
      String(startDenied.payload.message).length > 0,
      'Expected error payload for non-owner start',
    );
    const roomStillSetup = await queryOne(
      db,
      'SELECT status, started_at FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(
      roomStillSetup && String(roomStillSetup.status).toLowerCase() === 'setup',
      'Room should remain setup after non-owner start',
    );
    report.push('Scenario 6 - non-owner room.start rejected, DB unchanged: OK');

    ownerWs.send({
      type: 'room.start',
      payload: { _trace: { id: `trace-${runId}`, sentAtMs: Date.now() } },
    });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.ack' &&
        m?.payload?.action === 'room.start',
      20000,
      'owner room.start ack',
    );
    const startedUpdate = await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.updated' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.room?.status || '').toLowerCase() === 'started',
      20000,
      'owner room.updated started',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.focus' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.reason || '') === 'room.started',
      20000,
      'owner room.focus room.started',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.intent' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.type || '') === 'focus' &&
        String(m?.payload?.payload?.reason || '') === 'room.started',
      20000,
      'owner room.intent focus room.started',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.intent' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.type || '') === 'announcement' &&
        String(m?.payload?.payload?.message || '').trim().length > 0,
      20000,
      'owner start announcement intent',
    );
    await playerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.focus' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.reason || '') === 'room.started',
      20000,
      'player room.focus room.started',
    );
    assert(
      startedUpdate?.payload?.room?.startedAt,
      'Expected startedAt in room.updated after start',
    );

    const roomStartedDb = await queryOne(
      db,
      'SELECT status, started_at, run_id FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(
      roomStartedDb && String(roomStartedDb.status).toLowerCase() === 'started',
      'DB status should be started',
    );
    assert(roomStartedDb.started_at != null, 'DB started_at should not be null');
    assert(Number(roomStartedDb.run_id) >= 1, 'DB run_id should be incremented');
    report.push(
      'Scenario 7 - owner room.start launches game + focus/intents emitted + DB started_at/run_id set: OK',
    );

    spectatorWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(spectatorToken)}&ticket=${encodeURIComponent(spectatorTicket)}&room=${roomId}`,
      ),
    );
    await spectatorWs.connect();
    const spectatorState = await spectatorWs.waitFor(
      (m) => m && m.type === 'room.updated' && Number(m.roomId) === roomId,
      20000,
      'spectator fallback room.updated',
    );
    const spectators = spectatorState?.payload?.room?.spectators || [];
    const hasSpectator = Array.isArray(spectators)
      ? spectators.some((s) => String(s?.username || '') === users[2].username)
      : false;
    assert(hasSpectator, 'Expected connected third user in spectators');
    const spectatorAutoHistory = await spectatorWs.waitFor(
      (m) => m && m.type === 'room.chat.history' && Number(m.roomId) === roomId,
      20000,
      'spectator auto chat history on connect',
    );
    assert(
      historyHasMessage(spectatorAutoHistory.payload, ownerChatMessage) &&
        historyHasMessage(spectatorAutoHistory.payload, playerChatMessage),
      'spectator auto history missing prior messages',
    );

    const activeParticipantsAfterSpectatorConnect = await queryOne(
      db,
      'SELECT COUNT(*) AS c FROM room_participants WHERE room_id = ? AND left_at IS NULL',
      [roomId],
    );
    assert(
      Number(activeParticipantsAfterSpectatorConnect.c) === 2,
      'Started room fallback should not add spectator as participant in DB',
    );
    const spectatorChatMessage = `chat-spectator-${runId}`;
    spectatorWs.send({
      type: 'room.chat.send',
      payload: { message: spectatorChatMessage },
    });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.chat.message' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.message || '') === spectatorChatMessage &&
        Number(m?.payload?.userId || 0) === Number(spectatorUser.id),
      20000,
      'owner receives spectator chat message',
    );
    spectatorWs.send({ type: 'room.chat.history', payload: {} });
    const spectatorHistory = await spectatorWs.waitFor(
      (m) => m && m.type === 'room.chat.history' && Number(m.roomId) === roomId,
      20000,
      'spectator chat history',
    );
    assert(
      historyHasMessage(spectatorHistory.payload, spectatorChatMessage),
      'spectator chat history missing spectator message',
    );
    report.push(
      'Scenario 8 - started room spectator fallback + auto history + spectator chat/history: OK',
    );

    ownerWs.popAll();
    playerWs.popAll();
    spectatorWs.popAll();

    ownerWs.send({
      type: 'room.reset',
      payload: { _trace: { id: `trace-reset-${runId}`, sentAtMs: Date.now() } },
    });
    await ownerWs.waitFor(
      (m) => m && m.type === 'room.ack' && m?.payload?.action === 'room.reset',
      20000,
      'owner room.reset ack',
    );
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.updated' &&
        Number(m.roomId) === roomId &&
        String(m?.payload?.room?.status || '').toLowerCase() === 'setup',
      20000,
      'owner room.updated after reset',
    );
    await spectatorWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.role' &&
        Number(m.roomId) === roomId &&
        m?.payload?.spectator === false,
      20000,
      'spectator promoted to participant after reset',
    );

    const roomAfterResetDb = await queryOne(
      db,
      'SELECT status, started_at FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(
      roomAfterResetDb &&
        String(roomAfterResetDb.status).toLowerCase() === 'setup' &&
        roomAfterResetDb.started_at == null,
      'DB room should be setup with null started_at after reset',
    );
    const participantsAfterReset = await queryOne(
      db,
      'SELECT COUNT(*) AS c FROM room_participants WHERE room_id = ? AND left_at IS NULL',
      [roomId],
    );
    assert(
      Number(participantsAfterReset.c) === 3,
      'Expected 3 active participants after reset spectator promotion',
    );
    report.push(
      'Scenario 9 - room.reset transitions game->setup and promotes connected spectators to participants: OK',
    );

    ownerWs.send({ type: 'room.toggle-privacy', payload: {} });
    await ownerWs.waitFor(
      (m) =>
        m &&
        m.type === 'room.privacy' &&
        Number(m.roomId) === roomId &&
        m?.payload?.isPrivate === true,
      20000,
      'room.toggle-privacy => private',
    );
    const roomPrivateDb = await queryOne(
      db,
      'SELECT is_private FROM rooms WHERE id = ?',
      [roomId],
    );
    assert(Number(roomPrivateDb.is_private) === 1, 'DB is_private should be true');
    report.push('Scenario 10 - room.toggle-privacy updates WS + MySQL: OK');

    blockedWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(blockedToken)}&ticket=${encodeURIComponent(blockedTicket)}&room=${roomId}&spectator=true`,
      ),
    );
    await blockedWs.connect();
    await sleep(2000);
    assert(
      blockedWs.closedCode === 4003,
      `Expected blocked spectator close code 4003, got ${blockedWs.closedCode ?? 'none'}`,
    );
    report.push(
      'Scenario 11 - private room rejects non-invited spectator (WS close 4003): OK',
    );
  } finally {
    try {
      if (blockedWs) await blockedWs.close();
    } catch {}
    try {
      if (spectatorWs) await spectatorWs.close();
    } catch {}
    try {
      if (playerWs) await playerWs.close();
    } catch {}
    try {
      if (ownerWs) await ownerWs.close();
    } catch {}

    try {
      if (roomId > 0) {
        await db.execute('DELETE FROM rooms WHERE id = ?', [roomId]);
      }
    } catch {
      // best effort cleanup
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
      // best effort cleanup
    }
    try {
      await db.end();
    } catch {}
  }

  console.log('ROOM REAL E2E REPORT');
  for (const line of report) {
    console.log(`- ${line}`);
  }
  console.log('RESULT: PASS');
}

main().catch((err) => {
  console.error('RESULT: FAIL');
  console.error(err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
