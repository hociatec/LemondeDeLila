import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { RoomService } from '../services/room.service';
import { BotService } from '../../bot/services/bot.service';
import { Inject, forwardRef } from '@nestjs/common';

type AuthedClient = { socket: WebSocket; userId: number; roomId: number };
type IncomingPayload = { type?: string; payload?: any };

@WebSocketGateway({ path: '/ws' })
export class RoomGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly jwtSecret: string;
  private readonly clients = new Map<WebSocket, AuthedClient>();
  private readonly rooms = new Map<number, Set<WebSocket>>();

  constructor(
    private readonly roomsService: RoomService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET doit être défini pour le WS room');
    }
    this.jwtSecret = secret;
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const { token, roomId } = this.extractParams(client, args);
    const payload = this.verify(token);
    if (!payload?.id) {
      client.close(4001, 'auth required');
      return;
    }

    const targetRoomId = roomId && roomId > 0 ? roomId : 0;
    if (targetRoomId > 0) {
      try {
        await this.roomsService.joinRoom(targetRoomId, payload.id);
      } catch (err) {
        client.close(4003, (err as Error).message);
        return;
      }
    }

    this.clients.set(client, { socket: client, userId: payload.id, roomId: targetRoomId });
    if (!this.rooms.has(targetRoomId)) {
      this.rooms.set(targetRoomId, new Set());
    }
    this.rooms.get(targetRoomId)!.add(client);

    client.on('message', (raw) => this.handleMessage(client, raw));
    client.on('error', () => client.close());

    if (targetRoomId > 0) {
      await this.sendRoomState(targetRoomId);
    }
  }

  handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
    this.clients.delete(client);
    if (meta) {
      const set = this.rooms.get(meta.roomId);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.rooms.delete(meta.roomId);
        }
      }
      // si plus aucune connexion pour cette room, on supprime la table côté service
      if (!this.rooms.has(meta.roomId)) {
        this.roomsService
          .leaveRoom(meta.roomId, meta.userId)
          .catch(() => {});
      }
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: WebSocket, raw: any) {
    const meta = this.clients.get(client);
    if (!meta) {
      client.close();
      return;
    }
    try {
      const parsed = this.decode(raw);
      if (!parsed) return;
      await this.handleCommand(client, meta, parsed);
    } catch (err) {
      await this.sendError(client, (err as Error).message || 'Erreur temps réel');
    }
  }

  private async sendRoomState(roomId: number) {
    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      await this.broadcast(roomId, 'room.updated', payload);
    } catch {
      /* la table a peut-être été supprimée, on ignore */
    }
  }

  private async broadcast(
    roomId: number,
    type: string,
    payload: any,
    emittedRoomId?: number,
  ) {
    const message = JSON.stringify({
      type,
      roomId: emittedRoomId ?? roomId,
      payload,
    });
    const targets = this.rooms.get(roomId);
    if (!targets) return;
    for (const socket of Array.from(targets)) {
      if (socket.readyState !== WebSocket.OPEN) {
        targets.delete(socket);
        continue;
      }
      try {
        socket.send(message);
      } catch {
        targets.delete(socket);
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async sendError(client: WebSocket, message: string) {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(JSON.stringify({ type: 'error', payload: { message } }));
  }

  private safeSend(client: WebSocket, payload: any) {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      client.send(JSON.stringify(payload));
    } catch {
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
      const parsed = JSON.parse(text);
      return parsed as IncomingPayload;
    } catch {
      return null;
    }
  }

  private async handleCommand(
    client: WebSocket,
    meta: AuthedClient,
    payload: IncomingPayload,
  ) {
    const type = payload?.type;
    const data = payload?.payload ?? {};
    switch (type) {
      case 'room.start':
        await this.handleRoomStart(meta);
        break;
      case 'room.toggle-privacy':
        await this.handleTogglePrivacy(meta);
        break;
      case 'bot.add':
        await this.handleBotAdd(meta, data);
        break;
      case 'bot.remove':
        await this.handleBotRemove(meta, data);
        break;
      case 'room.create':
        await this.handleRoomCreate(client, meta, data);
        break;
      default:
        break;
    }
  }

  private async handleRoomStart(meta: AuthedClient) {
    await this.roomsService.startRoom(meta.roomId, meta.userId);
    await this.broadcast(meta.roomId, 'state-updated', { roomId: meta.roomId });
    await this.sendRoomState(meta.roomId);
  }

  private async handleTogglePrivacy(meta: AuthedClient) {
    await this.roomsService.togglePrivacy(meta.roomId, meta.userId);
    const state = await this.roomsService.getRoomPayload(meta.roomId);
    await this.broadcast(meta.roomId, 'room.privacy', {
      isPrivate: state.room.isPrivate,
      room: state.room,
    });
  }

  private async handleBotAdd(meta: AuthedClient, payload: any) {
    const name = typeof payload?.name === 'string' ? payload.name : '';
    const bot = await this.botService.addBot(meta.roomId, meta.userId, name);
    await this.broadcast(meta.roomId, 'bot.added', {
      roomId: meta.roomId,
      bot: { id: bot.id, name: bot.name },
    });
    await this.sendRoomState(meta.roomId);
  }

  private async handleBotRemove(meta: AuthedClient, payload: any) {
    const botId = Number(payload?.botId ?? payload?.id ?? -1);
    const bot = await this.botService.removeBot(meta.roomId, meta.userId, botId);
    await this.broadcast(meta.roomId, 'bot.removed', {
      roomId: meta.roomId,
      bot: { id: bot.id, name: bot.name },
      botId,
    });
    await this.sendRoomState(meta.roomId);
  }

  private async handleRoomCreate(client: WebSocket, meta: AuthedClient, payload: any) {
    const gameType = typeof payload?.gameType === 'string' ? payload.gameType : '';
    const name = typeof payload?.name === 'string' ? payload.name : null;
    const maxPlayersRaw = payload?.maxPlayers ?? payload?.max ?? null;
    const maxPlayers =
      typeof maxPlayersRaw === 'number'
        ? maxPlayersRaw
        : Number.isFinite(parseInt(maxPlayersRaw, 10))
        ? parseInt(maxPlayersRaw, 10)
        : null;
    const isPrivate = typeof payload?.isPrivate === 'boolean' ? payload.isPrivate : false;
    const room = await this.roomsService.createRoom(
      meta.userId,
      gameType,
      name,
      maxPlayers,
      isPrivate,
    );
    const state = await this.roomsService.getRoomPayload(room.id);
    const message = { type: 'room.created', roomId: room.id, payload: state };
    await this.broadcast(meta.roomId, message.type, message.payload ?? state, room.id);
    this.safeSend(client, message);
  }

  private extractParams(client: WebSocket, args: any[]) {
    const request: any = (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    let roomId = 0;
    let token: string | null = null;
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      token = url.searchParams.get('token');
      roomId = Number(url.searchParams.get('room') || 0);
    } catch {
      roomId = 0;
    }
    if (!token) {
      token = this.extractBearer((client as any).handshakeHeaders) || this.extractBearer(request?.headers);
    }
    return { token, roomId };
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

  private verify(token: string | null): any {
    if (!token) {
      throw new Error('Token manquant');
    }
    return jwt.verify(token, this.jwtSecret);
  }
}
