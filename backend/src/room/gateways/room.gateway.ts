import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { ConfigService } from '@nestjs/config';
import { RoomService } from '../services/room.service';
import { BotService } from '../../bot/services/bot.service';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import { WsSignatureService } from '../../common/ws/ws-signature.service';

type AuthedClient = { socket: WebSocket; userId: number; roomId: number };
type IncomingPayload = { type?: string; payload?: any };
type ClientRole = 'participant' | 'spectator';
type ClientMeta = AuthedClient & { role: ClientRole };

@WebSocketGateway({ path: '/ws' })
export class RoomGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, ClientMeta>();
  private readonly rooms = new Map<number, Set<WebSocket>>();
  private readonly logger = new Logger(RoomGateway.name);

  constructor(
    private readonly roomsService: RoomService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    config: ConfigService,
    private readonly auth: WsJwtAuthService,
    private readonly signature: WsSignatureService,
  ) {
    // Permet au backend (ex: moteur de jeu) de notifier les clients room sans dépendre du Gateway.
    this.roomsService.setRealtimeNotifier(async (roomId: number) => {
      await this.broadcast(roomId, 'state-updated', { roomId });
      await this.sendRoomState(roomId);
    });

    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET doit être défini pour le WS room');
    }
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    if (!this.signature.validate(client, args)) {
      this.logger.warn(
        'Connexion WS refusée: signature manquante ou invalide.',
      );
      client.close(4403, 'signature temps reel requise');
      return;
    }
    const { token, roomId, spectator } = this.extractParams(client, args);
    const payload = this.auth.tryVerify(token);
    if (!payload?.id) {
      client.close(4001, 'auth required');
      return;
    }

    const targetRoomId = roomId && roomId > 0 ? roomId : 0;
    if (targetRoomId > 0) {
      let role: ClientRole = spectator ? 'spectator' : 'participant';
      if (spectator) {
        const allowed = await this.canSpectate(targetRoomId, payload.id);
        if (!allowed) {
          client.close(4003, 'Spectateur non autorise sur cette table');
          return;
        }
      } else {
        try {
          await this.roomsService.joinRoom(targetRoomId, payload.id);
        } catch (err) {
          const reason = (err as Error).message;
          // Reconnexion : si la table est démarrée, joinRoom() refuse. On autorise toutefois si l'utilisateur est déjà participant.
          try {
            const state = await this.roomsService.getRoomPayload(targetRoomId);
            const isOwner = state.room.owner?.id === payload.id;
            const isParticipant =
              state.room.players?.some((p) => p?.id === payload.id) ?? false;
            const isPrivate = Boolean(state.room.isPrivate);
            if (!isOwner && !isParticipant) {
              if (!isPrivate) {
                role = 'spectator';
              } else {
                client.close(4003, reason);
                return;
              }
            }
          } catch {
            client.close(4003, reason);
            return;
          }
        }
      }
      this.clients.set(client, {
        socket: client,
        userId: payload.id,
        roomId: targetRoomId,
        role,
      });
    }

    if (!this.clients.has(client)) {
      this.clients.set(client, {
        socket: client,
        userId: payload.id,
        roomId: targetRoomId,
        role: 'participant',
      });
    }
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
      let remainingConnections = 0;
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.rooms.delete(meta.roomId);
          remainingConnections = 0;
        } else {
          remainingConnections = set.size;
        }
      }
      // si plus aucune connexion pour cette room, on supprime la table côté service
      if (meta.role === 'participant') {
        this.roomsService
          .leaveRoom(meta.roomId, meta.userId, {
            preserveRoom: remainingConnections > 0,
          })
          .catch(() => {});
      }
      if (meta.roomId > 0) {
        this.sendRoomState(meta.roomId).catch(() => {});
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
      await this.sendError(
        client,
        (err as Error).message || 'Erreur temps réel',
      );
    }
  }

  private async sendRoomState(roomId: number) {
    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      payload.room.counts.spectators = this.countSpectators(roomId);
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
    meta: ClientMeta,
    payload: IncomingPayload,
  ) {
    const type = payload?.type;
    const data = payload?.payload ?? {};
    switch (type) {
      case 'room.start':
        await this.handleRoomStart(meta);
        break;
      case 'room.reset':
        await this.handleRoomReset(meta);
        break;
      case 'room.set-role':
        await this.handleSetRole(client, meta, data);
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

  private async handleRoomReset(meta: AuthedClient) {
    await this.roomsService.resetRoom(meta.roomId, meta.userId);
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
    const bot = await this.botService.removeBot(
      meta.roomId,
      meta.userId,
      botId,
    );
    await this.broadcast(meta.roomId, 'bot.removed', {
      roomId: meta.roomId,
      bot: { id: bot.id, name: bot.name },
      botId,
    });
    await this.sendRoomState(meta.roomId);
  }

  private async handleSetRole(
    client: WebSocket,
    meta: ClientMeta,
    payload: any,
  ) {
    const roomIdRaw = payload?.roomId ?? meta.roomId;
    const roomId = Number(roomIdRaw);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new Error('roomId invalide');
    }
    if (roomId !== meta.roomId) {
      throw new Error('roomId ne correspond pas à la table courante');
    }

    const state = await this.roomsService.getRoomPayload(meta.roomId);
    const status = (state?.room?.status || '').toLowerCase();
    if (status === 'started') {
      throw new Error('Partie déjà commencée');
    }

    const spectatorRaw = payload?.spectator;
    const spectator =
      spectatorRaw === true ||
      spectatorRaw === 1 ||
      spectatorRaw === '1' ||
      spectatorRaw === 'true' ||
      spectatorRaw === 'yes' ||
      spectatorRaw === 'y';

    if (spectator) {
      // Public: on se retire des participants (sans fermer la connexion) pour ne pas être compté comme joueur.
      if (!state.room.isPrivate) {
        await this.roomsService.leaveRoom(meta.roomId, meta.userId, {
          preserveRoom: true,
        });
      }
      meta.role = 'spectator';
    } else {
      // Privé: autorisé uniquement si déjà owner/participant (canSpectate l'a déjà garanti).
      if (!state.room.isPrivate) {
        await this.roomsService.joinRoom(meta.roomId, meta.userId);
      }
      meta.role = 'participant';
    }

    this.safeSend(client, {
      type: 'room.role',
      roomId: meta.roomId,
      payload: {
        spectator,
        message: spectator
          ? 'Mode spectateur activé.'
          : 'Mode spectateur désactivé.',
      },
    });

    await this.sendRoomState(meta.roomId);
  }

  private async handleRoomCreate(
    client: WebSocket,
    meta: AuthedClient,
    payload: any,
  ) {
    const gameType =
      typeof payload?.gameType === 'string' ? payload.gameType : '';
    const name = typeof payload?.name === 'string' ? payload.name : null;
    const maxPlayersRaw = payload?.maxPlayers ?? payload?.max ?? null;
    const maxPlayers =
      typeof maxPlayersRaw === 'number'
        ? maxPlayersRaw
        : Number.isFinite(parseInt(maxPlayersRaw, 10))
          ? parseInt(maxPlayersRaw, 10)
          : null;
    const isPrivate =
      typeof payload?.isPrivate === 'boolean' ? payload.isPrivate : false;
    const room = await this.roomsService.createRoom(
      meta.userId,
      gameType,
      name,
      maxPlayers,
      isPrivate,
    );
    const state = await this.roomsService.getRoomPayload(room.id);
    const message = { type: 'room.created', roomId: room.id, payload: state };
    await this.broadcast(
      meta.roomId,
      message.type,
      message.payload ?? state,
      room.id,
    );
    this.safeSend(client, message);
  }

  private extractParams(client: WebSocket, args: any[]) {
    const request: any =
      (args && args[0]) || (client as any).upgradeReq || (client as any).req;
    const urlCandidate = (client as any).url || request?.url || '';
    let roomId = 0;
    let token: string | null = null;
    let spectator = false;
    try {
      const url = new URL(urlCandidate, 'ws://localhost');
      token = url.searchParams.get('token');
      roomId = Number(url.searchParams.get('room') || 0);
      const spectateRaw = (
        url.searchParams.get('spectator') ||
        url.searchParams.get('spectate') ||
        ''
      ).toLowerCase();
      spectator =
        spectateRaw === '1' ||
        spectateRaw === 'true' ||
        spectateRaw === 'yes' ||
        spectateRaw === 'y';
    } catch {
      roomId = 0;
    }
    if (!token) {
      token =
        this.extractBearer((client as any).handshakeHeaders) ||
        this.extractBearer(request?.headers);
    }
    return { token, roomId, spectator };
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

  private countSpectators(roomId: number): number {
    const unique = new Set<number>();
    for (const meta of this.clients.values()) {
      if (meta.roomId !== roomId) continue;
      if (meta.role !== 'spectator') continue;
      unique.add(meta.userId);
    }
    return unique.size;
  }

  private async canSpectate(roomId: number, userId: number): Promise<boolean> {
    try {
      const state = await this.roomsService.getRoomPayload(roomId);
      if (!state?.room) return false;
      if (!state.room.isPrivate) {
        return true;
      }
      const isOwner = state.room.owner?.id === userId;
      const isParticipant =
        state.room.players?.some((p) => p?.id === userId) ?? false;
      return isOwner || isParticipant;
    } catch {
      return false;
    }
  }
}
