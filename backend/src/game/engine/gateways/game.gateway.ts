import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { GameEngineService } from '../services/game-engine.service';
import { WsAuthPayload } from '../../../common/interfaces/ws-auth-payload';
import {
  GameSingleActionDto,
  GameStateWithActions,
} from '../dto/game-action.dto';
import { PlayerStateEntity } from '../../core/entities/game-state.entity';
import { playingLog } from '../../../common/utils/playing-logger';
import { WsJwtAuthService } from '../../../common/ws/ws-jwt-auth.service';
import { PerfMetricsService } from '../../../common/services/perf-metrics.service';
import { ClientUpdatesService } from '../../../client-updates/services/client-updates.service';
import { isVersionLower } from '../../../common/utils/version.utils';
import { WsTicketAuthService } from '../../../common/ws/ws-ticket-auth.service';
import { RoomService } from '../../../room/services/room.service';
import { GameContentService } from '../services/game-content.service';
import type { WsClientLike } from '../../../common/ws/ws-jwt-auth.service';

type Payload = Record<string, unknown>;
type TraceInfo = { traceId: string | null; sentAtMs: number | null };
const WS_READY_STATE_OPEN = 1;

interface GameWebSocket extends WsClientLike {
  readyState: number;
  send(data: string, cb?: (err?: Error) => void): void;
  close(code?: number, reason?: string): void;
  terminate(): void;
  ping(): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
}
type IncomingPayload = { type?: string; payload?: Payload };
type GameStatePayload = GameStateWithActions & Record<string, unknown>;
type GameClient = {
  socket: GameWebSocket;
  userId: number;
  roomId: number | null;
  gameType: string | null;
};

type TurnInfoPayload = {
  roomId: number;
  gameType: string;
  turnIndex: number | null;
  currentPlayerId: number | null;
  currentPlayerUsername: string | null;
  status: string | null;
  phase: string | null;
};

type GameStatePatchPayload = {
  baseTurnIndex: number | null;
  set: Record<string, unknown>;
  unset: string[];
};

@WebSocketGateway({ path: '/ws/game' })
export class GameGateway
  implements
    OnGatewayConnection<GameWebSocket>,
    OnGatewayDisconnect<GameWebSocket>
{
  @WebSocketServer()
  server!: Server<GameWebSocket>;

  private readonly clients = new Map<GameWebSocket, GameClient>();
  private readonly rooms = new Map<string, Set<GameWebSocket>>();
  private readonly heartbeats = new Map<GameWebSocket, NodeJS.Timeout>();
  private readonly lastPong = new WeakMap<GameWebSocket, number>();
  private readonly encodedStateMessageCache = new WeakMap<object, string>();
  private readonly topLevelSnapshotCache = new WeakMap<
    object,
    Map<string, string>
  >();
  private readonly lastPayloadBySocket = new WeakMap<
    GameWebSocket,
    GameStatePayload
  >();
  private readonly pingIntervalMs = 25000;
  private readonly pongGraceMs = 4000;
  private readonly minPatchBytesSaved = 96;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly engine: GameEngineService,
    private readonly auth: WsJwtAuthService,
    private readonly perf: PerfMetricsService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly roomService: RoomService,
    private readonly content: GameContentService,
  ) {
    this.engine.setBroadcaster((gameType, roomId, state) =>
      this.broadcastState(gameType, roomId, state),
    );
    this.engine.setEndedBroadcaster((gameType, roomId, state, payload) =>
      this.broadcastEnded(gameType, roomId, state, payload),
    );
    this.roomService.setRoomDeletedNotifier((roomId: number) => {
      this.forceDisconnectRoomClients(roomId);
    });
    // Log d'amorçage pour vérifier le chemin de log.
    playingLog('ws.game.gateway.init', {
      logPath: 'log/playing.log (racine ou backend/log)',
      gateway: '/ws/game',
    });
  }

  async handleConnection(client: GameWebSocket, ...args: unknown[]) {
    const clientVersion = this.auth.extractClientVersion(client, args);
    const minRequired = await this.clientUpdates.getMinRequiredVersion();
    if (minRequired) {
      const outdated =
        !clientVersion || isVersionLower(clientVersion, minRequired) === true;
      if (outdated) {
        client.close(4406, 'update required');
        return;
      }
    }

    const auth = this.resolveAuth(client, args);
    if (!auth?.id) {
      client.close(4001, 'auth required');
      return;
    }
    const ticketValidation = this.wsTickets.validateIfTokenPresentDetailed(
      client,
      args,
      'game',
      true,
    );
    if (!ticketValidation.ok) {
      this.logger.warn(
        `Connexion WS game refusée (ticket) reason=${ticketValidation.reason} ticketPresent=${ticketValidation.ticketPresent} userId=${auth.id} clientVersion=${clientVersion ?? 'n/a'}`,
      );
      const reason =
        ticketValidation.reason === 'missing_ticket'
          ? 'ws ticket requis'
          : 'ws ticket invalide';
      client.close(4403, reason);
      return;
    }
    this.clients.set(client, {
      socket: client,
      userId: auth.id,
      roomId: null,
      gameType: null,
    });
    client.on('message', (raw) => {
      // Considère aussi l'activité applicative comme un signe de vie, pas uniquement les pongs.
      // Cela évite les déconnexions quand le client est "idle" mais envoie un keep-alive.
      this.lastPong.set(client, Date.now());
      void this.handleMessage(client, raw);
    });
    client.on('error', () => client.close());
    // Heartbeat : ping régulier pour maintenir la connexion et détecter les resets silencieux.
    client.on('pong', () => this.lastPong.set(client, Date.now()));
    const interval = setInterval(() => {
      if (client.readyState !== WS_READY_STATE_OPEN) return;
      const last = this.lastPong.get(client) ?? Date.now();
      if (Date.now() - last > this.pingIntervalMs * 2) {
        const metaNow = this.clients.get(client) ?? null;
        playingLog('ws.game.heartbeat.timeout', {
          userId: metaNow?.userId ?? null,
          roomId: metaNow?.roomId ?? null,
          gameType: metaNow?.gameType ?? null,
          lastPongAgeMs: Date.now() - last,
        });

        // Essayer une fermeture propre (close frame) avant terminate(), pour éviter
        // le "remote party closed without completing the close handshake" côté client.
        try {
          client.close(4000, 'heartbeat timeout');
        } catch {
          /* ignore */
        }

        setTimeout(() => {
          try {
            if (client.readyState === WS_READY_STATE_OPEN) {
              client.terminate();
            }
          } catch {
            /* ignore */
          }
        }, this.pongGraceMs);
        return;
      }
      try {
        client.ping();
      } catch {
        /* ignore */
      }
    }, this.pingIntervalMs);
    this.heartbeats.set(client, interval);
    this.lastPong.set(client, Date.now());

    await this.tryAutoJoinFromUrl(client, args);
  }

  handleDisconnect(client: GameWebSocket) {
    const meta = this.clients.get(client);
    if (meta) {
      playingLog('ws.game.disconnect', {
        userId: meta.userId,
        roomId: meta.roomId ?? null,
        gameType: meta.gameType ?? null,
      });
    }
    if (meta?.roomId && meta.gameType) {
      const key = this.buildRoomKey(meta.gameType, meta.roomId);
      const set = this.rooms.get(key);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.rooms.delete(key);
        }
      }
    }
    const hb = this.heartbeats.get(client);
    if (hb) {
      clearInterval(hb);
      this.heartbeats.delete(client);
    }
    this.clients.delete(client);
    this.lastPayloadBySocket.delete(client);
  }

  private async handleMessage(client: GameWebSocket, raw: unknown) {
    const meta = this.clients.get(client);
    if (!meta) {
      client.close();
      return;
    }
    if (!meta.userId || Number.isNaN(meta.userId)) {
      this.sendError(client, 'Authentification requise');
      client.close();
      return;
    }
    const parsed = this.decode(raw);
    if (!parsed?.type) return;
    const payload = parsed.payload ?? {};
    const type = parsed.type;
    try {
      // Some clients historically send raw key types (ex: "r"). Avoid spamming errors.
      if (type === 'r' || type === 'R') {
        return;
      }
      switch (type) {
        case 'game.join':
          await this.handleJoin(client, meta, payload);
          break;
        case 'game.ping':
          this.safeSend(client, {
            type: 'game.pong',
            payload: {
              serverTimeMs: Date.now(),
              clientSentAtMs:
                typeof payload?.clientSentAtMs === 'number'
                  ? payload.clientSentAtMs
                  : null,
            },
          });
          break;
        case 'game.state':
          await this.handleState(client, meta, payload);
          break;
        case 'game.turn':
          await this.handleTurn(client, meta, payload);
          break;
        case 'game.actions':
          await this.handleActions(client, meta, payload);
          break;
        case 'game.key':
          await this.handleKey(client, meta, payload);
          break;
        case 'game.rules':
        case 'game.rules.get':
        case 'game.rulebook':
        case 'game.rulebook.get':
        case 'rules':
        case 'ctrl+r':
        case 'Ctrl+R':
        case 'CTRL+R':
        case 'control+r':
        case 'Control+R':
        case 'CONTROL+R':
          await this.handleRules(client, meta, payload);
          break;
        case 'game.bot.play':
          await this.handleBot(meta, payload);
          break;
        default:
          this.sendError(client, 'Type de message inconnu', type);
          break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur temps reel';
      playingLog('ws.game.error', {
        userId: meta?.userId ?? null,
        roomId: meta?.roomId ?? null,
        gameType: meta?.gameType ?? null,
        type,
        message,
        stack: err instanceof Error ? err.stack : null,
      });
      this.sendError(client, message, type);
    }
  }

  private async handleJoin(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const roomId =
      Number(this.parseNumberFromPayload(payload, 'roomId', 'room')) || 0;
    const gameType = this.parseStringFromPayload(payload, 'gameType') ?? '';
    const receivedAtMs = Date.now();
    const { traceId, sentAtMs } = this.extractTrace(payload);
    const clientToServerMs = this.computeClientLatency(receivedAtMs, sentAtMs);
    await this.perf.measure(
      'ws.game.join.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );
        this.setRoom(meta, roomId, gameType, client);
        playingLog('ws.game.join', { userId: meta.userId, roomId, gameType });
        this.sendState(client, state);
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleRules(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const gameType = (
      this.parseStringFromPayload(payload, 'gameType') ??
      meta.gameType ??
      ''
    ).trim();
    if (!gameType) {
      this.sendError(client, 'gameType requis', 'game.rules');
      return;
    }

    const roomId = meta.roomId ?? null;
    if (typeof roomId === 'number' && roomId > 0) {
      await this.engine.checkReadAccess(roomId, meta.userId);
    }

    const rules = await this.content.getRules(gameType);
    this.safeSend(client, { type: 'game.rules', payload: { rules, gameType } });
  }

  private async handleState(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const ctx = await this.ensureRoomContext(client, meta, payload);
    if (!ctx) {
      this.sendError(client, 'Parametres jeu manquants', 'game.state');
      return;
    }
    const { roomId, gameType } = ctx;
    const receivedAtMs = Date.now();
    const { traceId, sentAtMs } = this.extractTrace(payload);
    const clientToServerMs = this.computeClientLatency(receivedAtMs, sentAtMs);
    await this.perf.measure(
      'ws.game.state.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );
        this.setRoom(meta, roomId, gameType, client);
        playingLog('ws.game.state.request', {
          userId: meta.userId,
          roomId,
          gameType,
        });
        this.sendState(client, state);
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleTurn(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const ctx = await this.ensureRoomContext(client, meta, payload);
    if (!ctx) {
      this.sendError(client, 'Parametres jeu manquants', 'game.turn');
      return;
    }
    const { roomId, gameType } = ctx;

    const receivedAtMs = Date.now();
    const { traceId, sentAtMs } = this.extractTrace(payload);
    const clientToServerMs = this.computeClientLatency(receivedAtMs, sentAtMs);
    await this.perf.measure(
      'ws.game.turn.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );
        this.setRoom(meta, roomId, gameType, client);

        const currentPlayerId = state?.turn?.currentPlayerId ?? null;
        const players = Array.isArray(state?.players) ? state.players : [];
        const current =
          players.find(
            (p: PlayerStateEntity | undefined) => p?.id === currentPlayerId,
          ) ?? null;
        const currentUsername = (() => {
          let name =
            typeof current?.username === 'string' ? current.username : '';
          name = name
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
          }
          const lowered = name.toLowerCase();
          if (
            lowered.endsWith('(zone de jeu)') ||
            lowered.endsWith('(zone de jeux)') ||
            lowered.endsWith('(game zone)')
          ) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
              name = name.slice(0, openParen).trimEnd();
            }
          }
          return name.length > 0 ? name : null;
        })();

        const payloadOut: TurnInfoPayload = {
          roomId,
          gameType,
          turnIndex:
            typeof state?.turnIndex === 'number' ? state.turnIndex : null,
          currentPlayerId:
            typeof currentPlayerId === 'number' ? currentPlayerId : null,
          currentPlayerUsername: currentUsername,
          status: typeof state?.status === 'string' ? state.status : null,
          phase: typeof state?.phase === 'string' ? state.phase : null,
        };

        playingLog('ws.game.turn.request', {
          userId: meta.userId,
          roomId,
          gameType,
          currentPlayerId: payloadOut.currentPlayerId,
          currentPlayerUsername: payloadOut.currentPlayerUsername,
          turnIndex: payloadOut.turnIndex,
        });

        this.safeSend(client, { type: 'game.turn', payload: payloadOut });
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleActions(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const ctx = await this.ensureRoomContext(client, meta, payload);
    if (!ctx) return;
    const { roomId, gameType } = ctx;
    const receivedAtMs = Date.now();
    const { traceId, sentAtMs } = this.extractTrace(payload);
    const clientToServerMs = this.computeClientLatency(receivedAtMs, sentAtMs);

    // ACK immédiat au client émetteur (utile quand la latence réseau est élevée).
    this.safeSend(client, {
      type: 'game.ack',
      payload: {
        action: 'game.actions',
        traceId,
        receivedAtMs,
        clientToServerMs,
      },
    });
    await this.perf.measure(
      'ws.game.actions.total',
      async () => {
        this.setRoom(meta, roomId, gameType, client);
        const actions = this.extractIncomingActions(payload);
        playingLog('ws.game.actions', {
          userId: meta.userId,
          roomId,
          gameType,
          count: actions.length,
        });
        // `GameEngineService` broadcast déjà via `setBroadcaster(...)` (pour inclure aussi `botThinking`).
        await this.engine.applyActions(roomId, gameType, actions, meta.userId);
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleKey(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ) {
    const ctx = await this.ensureRoomContext(client, meta, payload);
    const key = this.parseStringFromPayload(payload, 'key') ?? '';
    if (!ctx) {
      this.sendError(client, 'Parametres jeu manquants', 'game.key');
      return;
    }
    const { roomId, gameType } = ctx;

    const receivedAtMs = Date.now();
    const { traceId, sentAtMs } = this.extractTrace(payload);
    const clientToServerMs = this.computeClientLatency(receivedAtMs, sentAtMs);

    await this.perf.measure(
      'ws.game.key.total',
      async () => {
        await this.engine.checkPlayAccess(roomId, meta.userId);
        this.setRoom(meta, roomId, gameType, client);

        const normalized = String(key ?? '').trim();
        if (!normalized) {
          return;
        }

        const result = await this.engine.handleKeyPress(
          roomId,
          gameType,
          meta.userId,
          normalized,
        );

        if (!result) {
          return;
        }

        if (result.kind === 'action') {
          await this.engine.applyActions(
            roomId,
            gameType,
            result.actions,
            meta.userId,
          );
          this.safeSend(client, {
            type: 'game.ack',
            payload: {
              action: 'game.key',
              ok: true,
              key: normalized,
              traceId,
              receivedAtMs,
              clientToServerMs,
            },
          });
          return;
        }

        if (result.kind === 'room') {
          if (result.op === 'reset') {
            await this.roomService.resetRoom(roomId, meta.userId, true);
          } else if (result.op === 'start') {
            await this.roomService.startRoom(roomId, meta.userId, true);
          } else if (result.op === 'restart') {
            await this.roomService.resetRoom(roomId, meta.userId, true);
            await this.roomService.startRoom(roomId, meta.userId, true);
          }
          await this.engine.refreshAndBroadcast(roomId, gameType);
          this.safeSend(client, {
            type: 'game.ack',
            payload: {
              action: 'game.key',
              ok: true,
              key: normalized,
              roomOp: result.op,
              traceId,
              receivedAtMs,
              clientToServerMs,
            },
          });
          return;
        }

        this.safeSend(client, {
          type: 'game.ack',
          payload: {
            action: 'game.key',
            ok: true,
            key: normalized,
            panelId: result.panelId,
            message: result.message,
            traceId,
            receivedAtMs,
            clientToServerMs,
          },
        });
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleBot(meta: GameClient, payload: Payload) {
    const roomId = Number(
      this.parseNumberFromPayload(payload, 'roomId') ?? meta.roomId ?? 0,
    );
    const gameType =
      this.parseStringFromPayload(payload, 'gameType') ?? meta.gameType ?? '';
    if (!roomId || !gameType) {
      return;
    }
    await this.perf.measure(
      'ws.game.bot.play.total',
      async () => {
        // Seul le proprietaire de la table (ou un role privilegie cote RoomService) peut forcer le bot.
        await this.engine.checkAccess(roomId, meta.userId, true);
        await this.engine.playBotTurn(roomId, gameType);
        playingLog('ws.game.bot.play', {
          userId: meta.userId,
          roomId,
          gameType,
        });
      },
      { roomId, userId: meta.userId, gameType },
    );
  }

  private broadcastState(
    gameType: string,
    roomId: number,
    state: GameStateWithActions,
  ): void {
    const room = this.buildRoomKey(gameType, roomId);
    const targets = this.rooms.get(room);
    if (!targets) return;
    const payloadByUserId = new Map<number, GameStatePayload>();
    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WS_READY_STATE_OPEN) {
        targets.delete(socket);
        this.lastPayloadBySocket.delete(socket);
        continue;
      }
      const meta = this.clients.get(socket);
      const userId = meta?.userId ?? null;
      if (userId == null) {
        continue;
      }
      let payload = payloadByUserId.get(userId) ?? null;
      if (!payload) {
        const exposed = this.engine.exposeStateForUser(state, gameType, userId);
        if (!exposed) {
          continue;
        }
        payload = exposed as GameStatePayload;
        payloadByUserId.set(userId, payload);
      }
      const previousPayload = this.lastPayloadBySocket.get(socket) ?? null;
      if (previousPayload === payload) {
        continue;
      }
      const fullStateEncoded = this.getEncodedStateMessage(payload);
      const encodedPatch = previousPayload
        ? this.buildEncodedPatch(previousPayload, payload, fullStateEncoded)
        : null;
      const encoded = encodedPatch ?? fullStateEncoded;
      try {
        socket.send(encoded);
        this.lastPayloadBySocket.set(socket, payload);
      } catch {
        targets.delete(socket);
        this.lastPayloadBySocket.delete(socket);
      }
    }
    playingLog('ws.game.broadcast', {
      roomId,
      gameType,
      subscribers: targets ? targets.size : 0,
      status: state?.status ?? null,
      turnIndex: state?.turnIndex ?? null,
      currentPlayerId: state?.turn?.currentPlayerId ?? null,
    });
  }

  private broadcastEnded(
    gameType: string,
    roomId: number,
    state: GameStateWithActions,
    payload: Payload,
  ): void {
    const room = this.buildRoomKey(gameType, roomId);
    const targets = this.rooms.get(room);
    if (!targets) return;

    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WS_READY_STATE_OPEN) {
        targets.delete(socket);
        continue;
      }

      const meta = this.clients.get(socket);
      const userId = meta?.userId ?? null;
      if (userId == null) {
        continue;
      }

      let viewerPlayerId: number | null = null;
      try {
        const exposed = this.engine.exposeStateForUser(state, gameType, userId);
        const extras =
          exposed?.extras && typeof exposed.extras === 'object'
            ? exposed.extras
            : {};
        const viewerPayloadId = this.parseNumberFromPayload(
          extras,
          'viewerPlayerId',
        );
        if (viewerPayloadId !== null) {
          viewerPlayerId = viewerPayloadId;
        }
      } catch {
        // best-effort
      }

      const outcomesByPlayerId =
        payload.outcomesByPlayerId &&
        typeof payload.outcomesByPlayerId === 'object'
          ? (payload.outcomesByPlayerId as Record<string, unknown>)
          : {};
      const viewerOutcome = (() => {
        if (viewerPlayerId == null) return null;
        const rawOutcome = outcomesByPlayerId[String(viewerPlayerId)];
        if (typeof rawOutcome === 'string') {
          const trimmed = rawOutcome.trim();
          return trimmed.length > 0 ? trimmed : null;
        }
        return null;
      })();

      this.safeSend(socket, {
        type: 'game.ended',
        payload: {
          ...payload,
          viewerPlayerId,
          viewerOutcome,
        },
      });
    }

    playingLog('ws.game.ended', {
      roomId,
      gameType,
      subscribers: targets ? targets.size : 0,
      winnerPlayerId: payload?.winnerPlayerId ?? null,
      finishedAt: payload?.finishedAt ?? null,
      turnIndex: payload?.turnIndex ?? null,
    });
  }

  private setRoom(
    meta: GameClient,
    roomId: number,
    gameType: string,
    client: GameWebSocket,
  ) {
    if (meta.roomId && meta.gameType) {
      const oldKey = this.buildRoomKey(meta.gameType, meta.roomId);
      this.rooms.get(oldKey)?.delete(client);
    }
    const key = this.buildRoomKey(gameType, roomId);
    if (!this.rooms.has(key)) {
      this.rooms.set(key, new Set());
    }
    this.rooms.get(key)!.add(client);
    meta.roomId = roomId;
    meta.gameType = gameType;
  }

  private forceDisconnectRoomClients(roomId: number): void {
    const targets = Array.from(this.clients.entries())
      .filter(([, meta]) => meta?.roomId === roomId)
      .map(([socket]) => socket);

    if (targets.length === 0) {
      return;
    }

    const errorPayload = JSON.stringify({
      type: 'error',
      context: 'room.deleted',
      payload: { message: 'Table fermee.' },
    });

    for (const socket of targets) {
      const meta = this.clients.get(socket);
      if (meta?.roomId && meta.gameType) {
        const key = this.buildRoomKey(meta.gameType, meta.roomId);
        const set = this.rooms.get(key);
        if (set) {
          set.delete(socket);
          if (set.size === 0) {
            this.rooms.delete(key);
          }
        }
      }

      this.clients.delete(socket);
      this.lastPayloadBySocket.delete(socket);

      try {
        if (socket.readyState === WS_READY_STATE_OPEN) {
          socket.send(errorPayload, () => {
            try {
              socket.close();
            } catch {
              // ignore
            }
          });
        } else {
          socket.close();
        }
      } catch {
        // ignore
      }
    }
  }

  private sendError(client: GameWebSocket, message: string, context?: string) {
    if (client.readyState !== WS_READY_STATE_OPEN) return;
    this.safeSend(client, { type: 'error', context, payload: { message } });
  }

  private unsafeStringify(payload: unknown): string {
    return JSON.stringify(payload);
  }

  private safeSend(client: GameWebSocket, payload: Payload) {
    if (client.readyState !== WS_READY_STATE_OPEN) return;
    try {
      client.send(this.unsafeStringify(payload));
    } catch (err) {
      this.logger.warn('Echec envoi WS game', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private sendState(client: GameWebSocket, payload: GameStatePayload): void {
    if (client.readyState !== WS_READY_STATE_OPEN) return;
    const encoded = this.getEncodedStateMessage(payload);
    try {
      client.send(encoded);
      this.lastPayloadBySocket.set(client, payload);
    } catch (err) {
      this.logger.warn('Echec envoi WS game.state', err as Error);
      this.lastPayloadBySocket.delete(client);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private getEncodedStateMessage(payload: GameStatePayload): string {
    if (!payload || typeof payload !== 'object') {
      return JSON.stringify({ type: 'game.state', payload });
    }
    const cached = this.encodedStateMessageCache.get(payload);
    if (cached) {
      return cached;
    }
    const encoded = JSON.stringify({ type: 'game.state', payload });
    this.encodedStateMessageCache.set(payload, encoded);
    return encoded;
  }

  private buildEncodedPatch(
    previousPayload: GameStatePayload,
    nextPayload: GameStatePayload,
    fullStateEncoded: string,
  ): string | null {
    const patch = this.buildTopLevelPatch(previousPayload, nextPayload);
    if (!patch) {
      return null;
    }
    const encodedPatch = JSON.stringify({ type: 'game.patch', payload: patch });
    const patchBytes = Buffer.byteLength(encodedPatch, 'utf8');
    const fullBytes = Buffer.byteLength(fullStateEncoded, 'utf8');
    if (patchBytes + this.minPatchBytesSaved >= fullBytes) {
      return null;
    }
    return encodedPatch;
  }

  private buildTopLevelPatch(
    previousPayload: GameStatePayload,
    nextPayload: GameStatePayload,
  ): GameStatePatchPayload | null {
    if (
      !previousPayload ||
      typeof previousPayload !== 'object' ||
      !nextPayload ||
      typeof nextPayload !== 'object'
    ) {
      return null;
    }

    const previousSnapshot = this.getTopLevelSnapshot(previousPayload);
    const nextSnapshot = this.getTopLevelSnapshot(nextPayload);
    const set: Record<string, unknown> = {};
    const unset: string[] = [];

    for (const [key, nextSerialized] of nextSnapshot.entries()) {
      const prevSerialized = previousSnapshot.get(key);
      if (prevSerialized !== nextSerialized) {
        set[key] = nextPayload[key];
      }
    }

    for (const key of previousSnapshot.keys()) {
      if (!nextSnapshot.has(key)) {
        unset.push(key);
      }
    }

    if (Object.keys(set).length === 0 && unset.length === 0) {
      return null;
    }

    const rawBaseTurnIndex = previousPayload?.turnIndex;
    const baseTurnIndex =
      typeof rawBaseTurnIndex === 'number' && Number.isFinite(rawBaseTurnIndex)
        ? rawBaseTurnIndex
        : null;

    return {
      baseTurnIndex,
      set,
      unset,
    };
  }

  private getTopLevelSnapshot(payload: GameStatePayload): Map<string, string> {
    if (!payload || typeof payload !== 'object') {
      return new Map<string, string>();
    }

    const cached = this.topLevelSnapshotCache.get(payload);
    if (cached) {
      return cached;
    }

    const snapshot = new Map<string, string>();
    for (const key of Object.keys(payload)) {
      const value = payload[key];
      if (value === undefined) {
        snapshot.set(key, '__undefined__');
        continue;
      }
      try {
        snapshot.set(key, JSON.stringify(value));
      } catch {
        snapshot.set(key, '__unserializable__');
      }
    }
    this.topLevelSnapshotCache.set(payload, snapshot);
    return snapshot;
  }

  private decode(raw: unknown): IncomingPayload | null {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw && typeof raw === 'object' && 'byteLength' in raw) {
      text = Buffer.from(raw as ArrayBuffer).toString('utf-8');
    } else {
      return null;
    }
    if (!text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text) as IncomingPayload;
    } catch {
      return null;
    }
  }

  private resolveAuth(
    client: GameWebSocket,
    args: unknown[],
  ): WsAuthPayload | null {
    const token = this.auth.extractToken(client, args);
    return this.auth.tryVerify(token);
  }

  private async tryAutoJoinFromUrl(
    client: GameWebSocket,
    args: unknown[],
  ): Promise<void> {
    const meta = this.clients.get(client);
    if (!meta) return;

    const params = this.extractJoinParams(client, args);
    if (!params) return;

    const { roomId, gameType } = params;

    await this.perf.measure(
      'ws.game.auto_join.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );
        this.setRoom(meta, roomId, gameType, client);
        playingLog('ws.game.auto_join', {
          userId: meta.userId,
          roomId,
          gameType,
        });
        this.sendState(client, state);
      },
      { roomId, userId: meta.userId, gameType },
    );
  }

  private async ensureRoomContext(
    client: GameWebSocket,
    meta: GameClient,
    payload: Payload,
  ): Promise<{ roomId: number; gameType: string } | null> {
    const payloadRoomId =
      this.parseNumberFromPayload(payload, 'roomId', 'room') ?? 0;
    const payloadGameType =
      this.parseStringFromPayload(payload, 'gameType', 'game') ?? '';
    if (payloadRoomId > 0 && payloadGameType) {
      return { roomId: payloadRoomId, gameType: payloadGameType };
    }

    const metaRoomId = Number(meta.roomId ?? 0);
    const metaGameType = String(meta.gameType ?? '').trim();
    if (metaRoomId > 0 && metaGameType) {
      return { roomId: metaRoomId, gameType: metaGameType };
    }

    // Fallback for "warm" sockets: infer from active participation in DB.
    try {
      const inferred = await this.roomService.findLatestActiveRoomForUser(
        meta.userId,
      );
      if (inferred?.roomId && inferred?.gameType) {
        return inferred;
      }
    } catch {
      // ignore
    }

    // Last resort: attempt to read from the client url (if exposed by ws).
    try {
      const urlCandidate = this.resolveUrlCandidate(client, []);
      if (urlCandidate) {
        const url = new URL(urlCandidate, 'ws://localhost');
        const roomId = Number(
          url.searchParams.get('roomId') || url.searchParams.get('room') || 0,
        );
        const gameType = (
          url.searchParams.get('gameType') ||
          url.searchParams.get('game') ||
          ''
        )
          .trim()
          .toString();
        if (!Number.isFinite(roomId) || roomId <= 0) return null;
        if (gameType) {
          return { roomId, gameType };
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  private extractJoinParams(
    client: GameWebSocket,
    args: unknown[],
  ): { roomId: number; gameType: string } | null {
    const urlCandidate = this.resolveUrlCandidate(client, args);
    if (!urlCandidate) {
      return null;
    }
    const trimmedCandidate = urlCandidate.trim();
    if (!trimmedCandidate) return null;
    try {
      const url = new URL(trimmedCandidate, 'ws://localhost');
      const roomId = Number(
        url.searchParams.get('roomId') || url.searchParams.get('room') || 0,
      );
      const gameType = (
        url.searchParams.get('gameType') ||
        url.searchParams.get('game') ||
        ''
      )
        .trim()
        .toString();

      if (!Number.isFinite(roomId) || roomId <= 0) return null;
      if (!gameType) return null;

      return { roomId, gameType };
    } catch {
      return null;
    }
  }

  private extractTrace(payload?: Payload): TraceInfo {
    if (!payload) {
      return { traceId: null, sentAtMs: null };
    }
    const traceValue = payload['_trace'];
    if (!traceValue || typeof traceValue !== 'object') {
      return { traceId: null, sentAtMs: null };
    }
    const trace = traceValue as Record<string, unknown>;
    const traceId =
      typeof trace['id'] === 'string' && trace['id'].trim()
        ? trace['id'].trim()
        : null;
    const sentAtMs =
      typeof trace['sentAtMs'] === 'number' &&
      Number.isFinite(trace['sentAtMs'])
        ? trace['sentAtMs']
        : null;
    return { traceId, sentAtMs };
  }

  private computeClientLatency(
    receivedAtMs: number,
    sentAtMs: number | null,
  ): number | null {
    if (sentAtMs === null) {
      return null;
    }
    return Math.max(0, receivedAtMs - sentAtMs);
  }

  private parseNumberFromPayload(
    payload: Payload | undefined,
    ...keys: string[]
  ): number | null {
    if (!payload) {
      return null;
    }
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  private parseStringFromPayload(
    payload: Payload | undefined,
    ...keys: string[]
  ): string | null {
    if (!payload) {
      return null;
    }
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  }

  private extractIncomingActions(payload: Payload): GameSingleActionDto[] {
    const candidate = payload.actions;
    if (!Array.isArray(candidate)) {
      return [];
    }
    return candidate.filter((action) => this.isGameSingleActionDto(action));
  }

  private isGameSingleActionDto(value: unknown): value is GameSingleActionDto {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate.type === 'string';
  }

  private resolveUrlCandidate(
    client: GameWebSocket,
    args: unknown[],
  ): string | null {
    const wsClient = client;
    const request = Array.isArray(args) ? args[0] : undefined;
    const candidate =
      (request &&
        typeof request === 'object' &&
        'url' in request &&
        typeof (request as { url?: string }).url === 'string' &&
        (request as { url?: string }).url) ??
      wsClient.url ??
      wsClient.upgradeReq?.url ??
      wsClient.req?.url ??
      null;
    if (typeof candidate !== 'string') {
      return null;
    }
    return candidate;
  }

  private buildRoomKey(gameType: string, roomId: number): string {
    return `${gameType}:${roomId}`;
  }
}
