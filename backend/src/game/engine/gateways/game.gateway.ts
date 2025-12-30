import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { GameEngineService } from '../services/game-engine.service';
import { WsAuthPayload } from '../../../common/interfaces/ws-auth-payload';
import { GameSingleActionDto } from '../dto/game-action.dto';
import { playingLog } from '../../../common/utils/playing-logger';
import { WsJwtAuthService } from '../../../common/ws/ws-jwt-auth.service';
import { PerfMetricsService } from '../../../common/services/perf-metrics.service';

type IncomingPayload = { type?: string; payload?: any };
type GameClient = {
  socket: WebSocket;
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

@WebSocketGateway({ path: '/ws/game' })
export class GameGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, GameClient>();
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly heartbeats = new Map<WebSocket, NodeJS.Timeout>();
  private readonly lastPong = new WeakMap<WebSocket, number>();
  private readonly pingIntervalMs = 25000;
  private readonly pongGraceMs = 4000;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly engine: GameEngineService,
    private readonly auth: WsJwtAuthService,
    private readonly perf: PerfMetricsService,
  ) {
    this.engine.setBroadcaster((gameType, roomId, state) =>
      this.broadcastState(gameType, roomId, state),
    );
    // Log d'amorçage pour vérifier le chemin de log.
    playingLog('ws.game.gateway.init', {
      logPath: 'log/playing.log (racine ou backend/log)',
      gateway: '/ws/game',
    });
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const auth = this.resolveAuth(client, args);
    if (!auth?.id) {
      client.close(4001, 'auth required');
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
      this.handleMessage(client, raw);
    });
    client.on('error', () => client.close());
    // Heartbeat : ping régulier pour maintenir la connexion et détecter les resets silencieux.
    client.on('pong', () => this.lastPong.set(client, Date.now()));
    const interval = setInterval(() => {
      if (client.readyState !== WebSocket.OPEN) return;
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
            if (client.readyState === WebSocket.OPEN) {
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
  }

  handleDisconnect(client: WebSocket) {
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
  }

  private async handleMessage(client: WebSocket, raw: any) {
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
    const { type, payload } = parsed;
    try {
      switch (type) {
        case 'game.join':
          await this.handleJoin(client, meta, payload);
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

  private async handleJoin(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? payload?.room ?? 0);
    const gameType = String(payload?.gameType ?? '');
    const receivedAtMs = Date.now();
    const traceId =
      typeof payload?._trace?.id === 'string' ? payload._trace.id : null;
    const sentAtMs =
      typeof payload?._trace?.sentAtMs === 'number' ? payload._trace.sentAtMs : null;
    const clientToServerMs =
      typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
        ? Math.max(0, receivedAtMs - sentAtMs)
        : null;
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
        this.safeSend(client, { type: 'game.state', payload: state });
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleState(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      this.sendError(client, 'Parametres jeu manquants', 'game.state');
      return;
    }
    const receivedAtMs = Date.now();
    const traceId =
      typeof payload?._trace?.id === 'string' ? payload._trace.id : null;
    const sentAtMs =
      typeof payload?._trace?.sentAtMs === 'number' ? payload._trace.sentAtMs : null;
    const clientToServerMs =
      typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
        ? Math.max(0, receivedAtMs - sentAtMs)
        : null;
    await this.perf.measure(
      'ws.game.state.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );
        playingLog('ws.game.state.request', {
          userId: meta.userId,
          roomId,
          gameType,
        });
        this.safeSend(client, { type: 'game.state', payload: state });
      },
      { roomId, userId: meta.userId, gameType, traceId, clientToServerMs },
    );
  }

  private async handleTurn(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      this.sendError(client, 'Parametres jeu manquants', 'game.turn');
      return;
    }

    const receivedAtMs = Date.now();
    const traceId =
      typeof payload?._trace?.id === 'string' ? payload._trace.id : null;
    const sentAtMs =
      typeof payload?._trace?.sentAtMs === 'number' ? payload._trace.sentAtMs : null;
    const clientToServerMs =
      typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
        ? Math.max(0, receivedAtMs - sentAtMs)
        : null;
    await this.perf.measure(
      'ws.game.turn.total',
      async () => {
        await this.engine.checkReadAccess(roomId, meta.userId);
        const state = await this.engine.getStateForUser(
          roomId,
          gameType,
          meta.userId,
        );

        const currentPlayerId = state?.turn?.currentPlayerId ?? null;
        const players = Array.isArray(state?.players) ? state.players : [];
        const current =
          players.find((p: any) => p?.id === currentPlayerId) ?? null;

        const payloadOut: TurnInfoPayload = {
          roomId,
          gameType,
          turnIndex:
            typeof state?.turnIndex === 'number' ? state.turnIndex : null,
          currentPlayerId:
            typeof currentPlayerId === 'number' ? currentPlayerId : null,
          currentPlayerUsername:
            typeof current?.username === 'string' ? current.username : null,
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

  private async handleActions(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      return;
    }
    const receivedAtMs = Date.now();
    const traceId =
      typeof payload?._trace?.id === 'string' ? payload._trace.id : null;
    const sentAtMs =
      typeof payload?._trace?.sentAtMs === 'number' ? payload._trace.sentAtMs : null;
    const clientToServerMs =
      typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
        ? Math.max(0, receivedAtMs - sentAtMs)
        : null;

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
        await this.engine.checkAccess(roomId, meta.userId);
        const actions: GameSingleActionDto[] = Array.isArray(payload?.actions)
          ? payload.actions
          : [];
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

  private async handleBot(meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
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

  private broadcastState(gameType: string, roomId: number, state: any): void {
    const room = this.buildRoomKey(gameType, roomId);
    const targets = this.rooms.get(room);
    if (!targets) return;
    const encodedByUserId = new Map<number, string>();
    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WebSocket.OPEN) {
        targets.delete(socket);
        continue;
      }
      const meta = this.clients.get(socket);
      const userId = meta?.userId ?? null;
      if (userId == null) {
        continue;
      }
      let encoded = encodedByUserId.get(userId) ?? null;
      if (!encoded) {
        const payload = this.engine.exposeStateForUser(state, gameType, userId);
        encoded = JSON.stringify({ type: 'game.state', payload });
        encodedByUserId.set(userId, encoded);
      }
      try {
        socket.send(encoded);
      } catch {
        targets.delete(socket);
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

  private setRoom(
    meta: GameClient,
    roomId: number,
    gameType: string,
    client: WebSocket,
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

  private sendError(client: WebSocket, message: string, context?: string) {
    if (client.readyState !== WebSocket.OPEN) return;
    this.safeSend(client, { type: 'error', context, payload: { message } });
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(payload));
    } catch (err) {
      this.logger.warn('Echec envoi WS game', err as Error);
      try {
        client.close();
      } catch {
        /* ignore */
      }
    }
  }

  private decode(raw: any): IncomingPayload | null {
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

  private resolveAuth(client: WebSocket, args: any[]): WsAuthPayload | null {
    const token = this.auth.extractToken(client, args);
    return this.auth.tryVerify(token);
  }

  private buildRoomKey(gameType: string, roomId: number): string {
    return `${gameType}:${roomId}`;
  }
}
