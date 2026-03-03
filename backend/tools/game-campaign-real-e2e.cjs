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

  async connect(timeoutMs = 12000) {
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

  popAll() {
    const all = [...this.messages];
    this.messages.length = 0;
    return all;
  }

  async waitFor(predicate, timeoutMs = 20000, label = 'waitFor') {
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
      `Timeout [${this.label}] ${label} (${timeoutMs}ms) recent=${JSON.stringify(recent)}`,
    );
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
      25000,
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
      25000,
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
  const res = await fetchJson(`${baseHttpUrl}/api/ws/ticket?scope=${scope}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.ok, `ws/ticket failed scope=${scope}, status=${res.status}`);
  const ticket = String(res?.body?.ticket || '').trim();
  assert(ticket.length > 20, `Missing ${scope} ticket`);
  return ticket;
}

async function fetchCatalogGames(baseWsUrl) {
  const api = new WsClient(withClientVersion(`${baseWsUrl}/ws/api`), 'api:catalog');
  await api.connect();
  try {
    const requestId = `catalog-games-${Date.now()}`;
    api.send({
      requestId,
      type: 'catalog.games',
      payload: {},
    });
    const res = await api.waitFor(
      (m) => m && m.requestId === requestId && m.type === 'catalog.games',
      25000,
      'catalog.games',
    );
    const list = Array.isArray(res?.payload) ? res.payload : [];
    return list
      .map((g) => ({
        id: String(g?.id || '').trim(),
        name: String(g?.name || '').trim(),
        status: String(g?.status || '').trim().toLowerCase(),
        minPlayers: Number(g?.minPlayers || 2),
      }))
      .filter((g) => g.id.length > 0);
  } finally {
    await api.close();
  }
}

function toActionFromEntry(entry) {
  if (typeof entry === 'string' && entry.trim()) {
    return { type: entry.trim(), payload: {} };
  }
  if (!entry || typeof entry !== 'object') return null;
  const type =
    typeof entry.type === 'string' && entry.type.trim().length > 0
      ? entry.type.trim()
      : '';
  if (!type) return null;
  const rawPayload =
    entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
  const payload = { ...rawPayload };

  // Common config defaults required by some games during setup.
  if (type.toLowerCase() === 'cat_pattes_set_config') {
    if (
      typeof payload.goalPattes !== 'number' ||
      !Number.isFinite(payload.goalPattes)
    ) {
      payload.goalPattes = 1000;
    }
  }

  return { type, payload };
}

function pickActionFromState(gameStatePayload) {
  const list = Array.isArray(gameStatePayload?.actions)
    ? gameStatePayload.actions
    : Array.isArray(gameStatePayload?.availableActions)
      ? gameStatePayload.availableActions
      : [];
  const candidates = list.map(toActionFromEntry).filter(Boolean);
  if (candidates.length === 0) return null;

  const preferred = [
    'draw',
    'draw_card',
    'pass',
    'roll',
    'move',
    'play',
    'play_card',
  ];
  for (const p of preferred) {
    const hit = candidates.find((c) => c.type.toLowerCase() === p);
    if (hit) return hit;
  }
  return candidates[0];
}

function extractCurrentPlayerId(gameStatePayload) {
  const id = gameStatePayload?.turn?.currentPlayerId;
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
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
  const maxGamesRaw = Number(process.env.GAME_CAMPAIGN_MAX_GAMES || 0);
  const maxGames =
    Number.isFinite(maxGamesRaw) && maxGamesRaw > 0 ? Math.floor(maxGamesRaw) : 0;
  const password = 'Passw0rd!GameCampaign';

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || env.DB_PORT || 3306),
    user: process.env.DB_USER || env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || env.DB_PASSWORD || '',
    database: process.env.DB_NAME || env.DB_NAME || 'le_monde_de_lila',
  });

  const users = [
    {
      key: 'owner',
      username: `gcampow_${runId}`,
      email: `gcamp.owner.${runId}@example.test`,
    },
    {
      key: 'player',
      username: `gcamppy_${runId}`,
      email: `gcamp.player.${runId}@example.test`,
    },
  ];

  const sockets = [];
  const gameResults = [];

  let ownerId = 0;
  let playerId = 0;

  try {
    const health = await fetchJson(`${baseHttpUrl}/health`, { method: 'GET' });
    if (!health.ok) {
      if (process.env.GAME_CAMPAIGN_ALLOW_HEALTH_ERROR === '1') {
        console.log(
          `- Health check non-ok (${health.status}), continuing by override`,
        );
      } else {
        assert(health.ok, `Health check failed: ${health.status}`);
      }
    }

    const catalogAll = await fetchCatalogGames(baseWsUrl);
    assert(catalogAll.length > 0, 'Catalog is empty');
    const catalogGames =
      maxGames > 0 ? catalogAll.slice(0, maxGames) : catalogAll;

    for (const user of users) {
      user.token = await registerAndLoginOverApiWs(baseWsUrl, user, password);
    }

    const ownerRow = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ?',
      [users[0].username],
    );
    const playerRow = await queryOne(
      db,
      'SELECT id FROM users WHERE username = ?',
      [users[1].username],
    );
    assert(ownerRow?.id && playerRow?.id, 'Failed to resolve campaign users in DB');
    ownerId = Number(ownerRow.id);
    playerId = Number(playerRow.id);

    // Force both users admin so campaign can cover games still marked "construction".
    const adminRoles = JSON.stringify(['ROLE_USER', 'ROLE_ADMIN']);
    await db.execute('UPDATE users SET roles = ? WHERE id IN (?, ?)', [
      adminRoles,
      ownerId,
      playerId,
    ]);

    // Persistent sockets for the whole campaign.
    const ownerRoomTicket = await issueTicket(baseHttpUrl, users[0].token, 'room');
    const playerRoomTicket = await issueTicket(baseHttpUrl, users[1].token, 'room');
    const ownerGameTicket = await issueTicket(baseHttpUrl, users[0].token, 'game');
    const playerGameTicket = await issueTicket(baseHttpUrl, users[1].token, 'game');

    const ownerRoomWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(users[0].token)}&ticket=${encodeURIComponent(ownerRoomTicket)}`,
      ),
      'room-owner-campaign',
    );
    const playerRoomWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws?token=${encodeURIComponent(users[1].token)}&ticket=${encodeURIComponent(playerRoomTicket)}`,
      ),
      'room-player-campaign',
    );
    const ownerGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[0].token)}&ticket=${encodeURIComponent(ownerGameTicket)}`,
      ),
      'game-owner-campaign',
    );
    const playerGameWs = new WsClient(
      withClientVersion(
        `${baseWsUrl}/ws/game?token=${encodeURIComponent(users[1].token)}&ticket=${encodeURIComponent(playerGameTicket)}`,
      ),
      'game-player-campaign',
    );

    sockets.push(ownerRoomWs, playerRoomWs, ownerGameWs, playerGameWs);
    await ownerRoomWs.connect();
    await playerRoomWs.connect();
    await ownerGameWs.connect();
    await playerGameWs.connect();
    await sleep(300);

    for (const [idx, game] of catalogGames.entries()) {
      const gameLabel = `${game.id} (${game.name || 'n/a'})`;
      const startedAt = Date.now();
      let roomId = 0;
      let actionTried = null;
      console.log(`- [${idx + 1}/${catalogGames.length}] ${gameLabel}`);

      try {
        ownerRoomWs.popAll();
        playerRoomWs.popAll();
        ownerGameWs.popAll();
        playerGameWs.popAll();

        ownerRoomWs.send({
          type: 'room.create',
          payload: {
            gameType: game.id,
            name: `GCAMP-${game.id}-${runId}`,
            maxPlayers: Math.max(4, Number(game.minPlayers || 2)),
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
          `room.create ${game.id}`,
        );
        roomId =
          createdOrUpdated.type === 'room.created'
            ? Number(createdOrUpdated.roomId)
            : Number(createdOrUpdated?.payload?.room?.id || 0);
        assert(roomId > 0, `Invalid roomId for game=${game.id}`);

        playerRoomWs.send({
          type: 'room.join',
          payload: { roomId },
        });
        const joinRes = await playerRoomWs.waitFor(
          (m) =>
            m &&
            ((m.type === 'room.updated' && Number(m.roomId) === roomId) ||
              m.type === 'error'),
          25000,
          `room.join player ${game.id}`,
        );
        if (joinRes.type === 'error') {
          throw new Error(
            `room.join failed ${game.id}: ${joinRes?.payload?.message || 'unknown error'}`,
          );
        }

        // Add bots when game minimum players > 2
        const minPlayers = Math.max(2, Number(game.minPlayers || 2));
        const botsNeeded = Math.max(0, minPlayers - 2);
        for (let i = 0; i < botsNeeded; i += 1) {
          ownerRoomWs.send({
            type: 'bot.add',
            payload: { _trace: { id: `b-${game.id}-${i}`, sentAtMs: Date.now() } },
          });
          await ownerRoomWs.waitFor(
            (m) =>
              m &&
              ((m.type === 'room.ack' &&
                m?.payload?.action === 'bot.add') ||
                m.type === 'bot.added'),
            25000,
            `bot.add ${game.id}`,
          );
          // small delay to let room state settle
          await sleep(60);
        }

        ownerRoomWs.send({
          type: 'room.start',
          payload: { _trace: { id: `start-${game.id}`, sentAtMs: Date.now() } },
        });
        await ownerRoomWs.waitFor(
          (m) =>
            m &&
            m.type === 'room.ack' &&
            m?.payload?.action === 'room.start',
          25000,
          `room.start ack ${game.id}`,
        );
        await ownerRoomWs.waitFor(
          (m) =>
            m &&
            m.type === 'room.updated' &&
            Number(m.roomId) === roomId &&
            String(m?.payload?.room?.status || '').toLowerCase() === 'started',
          25000,
          `room.updated started ${game.id}`,
        );

        ownerGameWs.send({
          type: 'game.join',
          payload: { roomId, gameType: game.id },
        });
        await ownerGameWs.waitFor(
          (m) => m && m.type === 'game.state',
          25000,
          `game.join owner ${game.id}`,
        );

        playerGameWs.send({
          type: 'game.join',
          payload: { roomId, gameType: game.id },
        });
        await playerGameWs.waitFor(
          (m) => m && m.type === 'game.state',
          25000,
          `game.join player ${game.id}`,
        );

        ownerGameWs.send({
          type: 'game.rules',
          payload: { gameType: game.id },
        });
        await ownerGameWs.waitFor(
          (m) =>
            m &&
            m.type === 'game.rules' &&
            String(m?.payload?.gameType || '').toLowerCase() ===
              game.id.toLowerCase(),
          25000,
          `game.rules ${game.id}`,
        );

        ownerGameWs.send({
          type: 'game.turn',
          payload: { roomId, gameType: game.id },
        });
        await ownerGameWs.waitFor(
          (m) =>
            m &&
            m.type === 'game.turn' &&
            Number(m?.payload?.roomId || 0) === roomId,
          25000,
          `game.turn ${game.id}`,
        );

        ownerGameWs.send({
          type: 'game.state',
          payload: { roomId, gameType: game.id },
        });
        const ownerState = await ownerGameWs.waitFor(
          (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
          25000,
          `game.state owner ${game.id}`,
        );

        const currentPlayerId = extractCurrentPlayerId(ownerState.payload);
        const actorWs =
          currentPlayerId === ownerId
            ? ownerGameWs
            : currentPlayerId === playerId
              ? playerGameWs
              : ownerGameWs;

        actorWs.send({
          type: 'game.state',
          payload: { roomId, gameType: game.id },
        });
        const actorState = await actorWs.waitFor(
          (m) => m && m.type === 'game.state' && m.payload && typeof m.payload === 'object',
          25000,
          `game.state actor ${game.id}`,
        );

        const action = pickActionFromState(actorState.payload);
        if (action) {
          actionTried = action.type;
          ownerGameWs.popAll();
          playerGameWs.popAll();
          actorWs.send({
            type: 'game.actions',
            payload: {
              roomId,
              gameType: game.id,
              actions: [action],
              _trace: { id: `ga-${game.id}`, sentAtMs: Date.now() },
            },
          });
          const actionAckOrErr = await actorWs.waitFor(
            (m) =>
              m &&
              ((m.type === 'game.ack' &&
                String(m?.payload?.action || '') === 'game.actions') ||
                (m.type === 'error' &&
                  String(m?.context || '') === 'game.actions')),
            25000,
            `game.actions ack ${game.id}`,
          );
          if (actionAckOrErr.type === 'error') {
            throw new Error(
              `game.actions failed ${game.id}: ${actionAckOrErr?.payload?.message || 'unknown error'}`,
            );
          }
          const actionBroadcastOrErr = await actorWs.waitFor(
            (m) =>
              m &&
              (m.type === 'game.state' ||
                m.type === 'game.patch' ||
                m.type === 'game.ended' ||
                (m.type === 'error' &&
                  String(m?.context || '') === 'game.actions')),
            25000,
            `game broadcast after action ${game.id}`,
          );
          if (actionBroadcastOrErr.type === 'error') {
            throw new Error(
              `game.actions broadcast failed ${game.id}: ${actionBroadcastOrErr?.payload?.message || 'unknown error'}`,
            );
          }
        }

        ownerGameWs.send({
          type: 'game.key',
          payload: {
            roomId,
            gameType: game.id,
            key: 'X',
            _trace: { id: `gk-reset-${game.id}`, sentAtMs: Date.now() },
          },
        });
        const resetAckOrErr = await ownerGameWs.waitFor(
          (m) =>
            m &&
            ((m.type === 'game.ack' &&
              String(m?.payload?.action || '') === 'game.key' &&
              String(m?.payload?.roomOp || '') === 'reset') ||
              (m.type === 'error' && String(m?.context || '') === 'game.key')),
          25000,
          `game.key reset ${game.id}`,
        );
        if (resetAckOrErr.type === 'error') {
          throw new Error(
            `game.key reset failed ${game.id}: ${resetAckOrErr?.payload?.message || 'unknown error'}`,
          );
        }

        const roomDb = await queryOne(
          db,
          'SELECT status, started_at FROM rooms WHERE id = ?',
          [roomId],
        );
        assert(
          roomDb &&
            String(roomDb.status).toLowerCase() === 'setup' &&
            roomDb.started_at == null,
          `DB room not reset for game=${game.id}`,
        );

        gameResults.push({
          gameId: game.id,
          name: game.name,
          status: 'pass',
          actionTried,
          ms: Date.now() - startedAt,
        });
        console.log(
          `  PASS ${game.id}${actionTried ? ` action=${actionTried}` : ''} (${Date.now() - startedAt}ms)`,
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        gameResults.push({
          gameId: game.id,
          name: game.name,
          status: 'fail',
          actionTried,
          error: errMsg,
          ms: Date.now() - startedAt,
        });
        console.log(`  FAIL ${game.id}: ${errMsg}`);
      } finally {
        if (roomId > 0) {
          try {
            await db.execute('DELETE FROM rooms WHERE id = ?', [roomId]);
          } catch {
            // best effort
          }
        }
        // let sockets settle between games
        await sleep(80);
      }
    }

    const passed = gameResults.filter((g) => g.status === 'pass');
    const failed = gameResults.filter((g) => g.status === 'fail');

    console.log('GAME CAMPAIGN REAL E2E REPORT');
    console.log(
      `- Catalog games targeted: ${catalogGames.length} / total catalog: ${catalogAll.length}`,
    );
    console.log(`- Passed: ${passed.length}`);
    console.log(`- Failed: ${failed.length}`);
    if (passed.length > 0) {
      const sample = passed
        .slice(0, 10)
        .map((g) => `${g.gameId}${g.actionTried ? ` [${g.actionTried}]` : ''}`)
        .join(', ');
      console.log(`- Pass sample: ${sample}`);
    }
    if (failed.length > 0) {
      console.log('- Fails:');
      for (const f of failed) {
        console.log(
          `  * ${f.gameId} (${f.name || 'n/a'}) => ${f.error || 'unknown error'}`,
        );
      }
      console.log('RESULT: PARTIAL_FAIL');
      process.exitCode = 1;
      return;
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
      const usernames = users.map((u) => String(u.username || '').trim());
      const placeholders = usernames.map(() => '?').join(',');
      await db.execute(
        `DELETE FROM users WHERE username IN (${placeholders})`,
        usernames,
      );
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
