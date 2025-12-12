import { Logger, UnauthorizedException } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { Server, WebSocket } from 'ws';
import { GameEngineService } from '../services/game-engine.service';
import { WsAuthPayload } from '../../../common/interfaces/ws-auth-payload';
import { GameSingleActionDto } from '../dto/game-action.dto';
import { playingLog } from '../../../common/utils/playing-logger';

type IncomingPayload = { type?: string; payload?: any };
type GameClient = { socket: WebSocket; userId: number; roomId: number | null; gameType: string | null };

@WebSocketGateway({ path: '/ws/game' })
export class GameGateway implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket> {
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, GameClient>();
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly jwtSecret: string;
  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly engine: GameEngineService, config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET doit etre defini pour le WS game');
    }
    this.jwtSecret = secret;
    this.engine.setBroadcaster((gameType, roomId, state) => this.broadcastState(gameType, roomId, state));
    // Log d'amorçage pour vérifier le chemin de log.
    playingLog('ws.game.gateway.init', { logPath: 'log/playing.log (racine ou backend/log)', gateway: '/ws/game' });
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const auth = this.resolveAuth(client, args);
    if (!auth?.id) {
      client.close(4001, 'auth required');
      return;
    }
    this.clients.set(client, { socket: client, userId: auth.id, roomId: null, gameType: null });
    client.on('message', (raw) => this.handleMessage(client, raw));
    client.on('error', () => client.close());
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
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
    this.clients.delete(client);
  }

  private async handleMessage(client: WebSocket, raw: any) {
    const meta = this.clients.get(client);
    if (!meta) {
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
        case 'game.actions':
          await this.handleActions(meta, payload);
          break;
        case 'game.actions.available':
          await this.handleAvailable(meta, payload);
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
      });
      this.sendError(client, message, type);
    }
  }

  private async handleJoin(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? payload?.room ?? 0);
    const gameType = String(payload?.gameType ?? '');
    await this.engine.checkAccess(roomId, meta.userId);
    const state = await this.engine.getState(roomId, gameType);
    this.setRoom(meta, roomId, gameType, client);
    playingLog('ws.game.join', { userId: meta.userId, roomId, gameType });
    this.safeSend(client, { type: 'game.state', payload: state });
  }

  private async handleState(client: WebSocket, meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      this.sendError(client, 'Parametres jeu manquants', 'game.state');
      return;
    }
    await this.engine.checkAccess(roomId, meta.userId);
    const state = await this.engine.getState(roomId, gameType);
    playingLog('ws.game.state.request', { userId: meta.userId, roomId, gameType });
    this.safeSend(client, { type: 'game.state', payload: state });
  }

  private async handleActions(meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      return;
    }
    await this.engine.checkAccess(roomId, meta.userId);
    const actions: GameSingleActionDto[] = Array.isArray(payload?.actions) ? payload.actions : [];
    playingLog('ws.game.actions', { userId: meta.userId, roomId, gameType, count: actions.length });
    const nextState = await this.engine.applyActions(roomId, gameType, actions, meta.userId);
    this.broadcastState(gameType, roomId, nextState);
  }

  private async handleAvailable(meta: GameClient, payload: any) {
    const client = meta.socket;
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    const playerId = payload?.playerId ? Number(payload.playerId) : meta.userId;
    if (!roomId || !gameType) {
      this.sendError(client, 'Parametres jeu manquants', 'game.actions.available');
      return;
    }
    await this.engine.checkAccess(roomId, meta.userId);
    const actions = await this.engine.getAvailableActions(roomId, gameType, playerId);
    playingLog('ws.game.actions.available', {
      userId: meta.userId,
      roomId,
      gameType,
      playerId,
      count: actions.length,
    });
    this.safeSend(client, {
      type: 'game.actions.available',
      payload: { actions, roomId, gameType, playerId },
    });
  }

  private async handleBot(meta: GameClient, payload: any) {
    const roomId = Number(payload?.roomId ?? meta.roomId ?? 0);
    const gameType = String(payload?.gameType ?? meta.gameType ?? '');
    if (!roomId || !gameType) {
      return;
    }
    // Seul le proprietaire de la table (ou un role privilegie cote RoomService) peut forcer le bot.
    await this.engine.checkAccess(roomId, meta.userId, true);
    const state = await this.engine.playBotTurn(roomId, gameType);
    playingLog('ws.game.bot.play', { userId: meta.userId, roomId, gameType });
    this.broadcastState(gameType, roomId, state);
  }

  private broadcastState(gameType: string, roomId: number, state: any): void {
    const room = this.buildRoomKey(gameType, roomId);
    const targets = this.rooms.get(room);
    if (!targets) return;
    const encoded = JSON.stringify({ type: 'game.state', payload: state });
    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WebSocket.OPEN) {
        targets.delete(socket);
        continue;
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

  private setRoom(meta: GameClient, roomId: number, gameType: string, client: WebSocket) {
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
    const request: any = (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    const token =
      this.extractBearer((client as any).handshakeHeaders) ||
      this.extractBearer(request?.headers) ||
      this.extractQueryToken(urlCandidate);
    if (!token) return null;
    try {
      return jwt.verify(token, this.jwtSecret) as WsAuthPayload;
    } catch (err) {
      this.logger.warn(`Token WS invalide: ${(err as Error).message}`);
      return null;
    }
  }

  private extractBearer(headers: any): string | null {
    if (!headers) return null;
    const authHeader = headers.authorization || headers.Authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        return parts[1];
      }
    }
    return null;
  }

  private extractQueryToken(urlCandidate?: string): string | null {
    if (!urlCandidate || typeof urlCandidate !== 'string') {
      return null;
    }
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  private buildRoomKey(gameType: string, roomId: number): string {
    return `${gameType}:${roomId}`;
  }
}
