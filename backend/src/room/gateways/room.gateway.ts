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
import type { RoomPayload, RoomPlayer } from '../dto/room-response.dto';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { RoomInviteService } from '../services/room-invite.service';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { extractRoomWsParams } from './room-ws-params';
import {
  addHiddenSelf,
  listConnectedPlayers,
  listVisibleSpectators,
  mergePlayers,
} from './room-roster';

type AuthedClient = {
  socket: WebSocket;
  userId: number;
  username: string;
  roomId: number;
};
type IncomingPayload = { type?: string; payload?: any };
type ClientRole = 'participant' | 'spectator';
type ClientMeta = AuthedClient & {
  role: ClientRole;
  silent: boolean;
  isAdmin: boolean;
};

type RoomChatMessage = {
  seq: number;
  userId: number;
  username: string;
  message: string;
  createdAt: string;
};

@WebSocketGateway({ path: '/ws' })
export class RoomGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  @WebSocketServer()
  server!: Server<WebSocket>;

  private readonly clients = new Map<WebSocket, ClientMeta>();
  private readonly rooms = new Map<number, Set<WebSocket>>();
  private readonly silentRooms = new Map<number, Set<WebSocket>>();
  private readonly logger = new Logger(RoomGateway.name);
  private readonly heartbeats = new Map<WebSocket, NodeJS.Timeout>();
  private readonly lastPong = new WeakMap<WebSocket, number>();
  private readonly pingIntervalMs = 25_000;
  private readonly lastChatSentAt = new WeakMap<WebSocket, number>();

  private readonly roomChat = new Map<
    number,
    { nextSeq: number; messages: RoomChatMessage[] }
  >();
  private readonly roomChatLimit = 120;
  private readonly chatCooldownMs = 350;
  private readonly chatMaxLength = 300;

  constructor(
    private readonly roomsService: RoomService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    private readonly auth: WsJwtAuthService,
    private readonly signature: WsSignatureService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly invites: RoomInviteService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
  ) {
    // Permet au backend (ex: moteur de jeu) de notifier les clients room sans dépendre du Gateway.
    this.roomsService.setRealtimeNotifier(async (roomId: number) => {
      await this.broadcast(roomId, 'state-updated', { roomId });
      await this.sendRoomState(roomId);
    });

    // Permet à l'admin (via RoomService) de forcer la suppression d'une room
    // en déconnectant tous les clients WS connectés à cette table.
    this.roomsService.setRoomDeletedNotifier(async (roomId: number) => {
      this.roomChat.delete(roomId);
      this.forceDisconnectRoomClients(roomId);
    });

    // Auth JWT is handled by WsJwtAuthService (RS256/HS256 depending on configuration).
  }

  private forceDisconnectRoomClients(roomId: number): void {
    const targets = this.rooms.get(roomId);
    const silentTargets = this.silentRooms.get(roomId);

    const all: WebSocket[] = [];
    if (targets) all.push(...Array.from(targets));
    if (silentTargets) all.push(...Array.from(silentTargets));

    for (const socket of all) {
      try {
        this.safeSend(socket, { type: 'room.deleted', roomId });
      } catch {
        // ignore
      }

      // Important: retirer avant close pour éviter handleDisconnect/leaveRoom en cascade.
      this.realtimeTracker.clearSocket(socket);
      this.clients.delete(socket);
      targets?.delete(socket);
      silentTargets?.delete(socket);

      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }

    if (targets?.size === 0) this.rooms.delete(roomId);
    if (silentTargets?.size === 0) this.silentRooms.delete(roomId);
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    // WS ticket (short-lived) required.
    if (!this.wsTickets.validate(client, args, 'room')) {
      this.logger.warn('Connexion WS refusée: ticket manquant ou invalide.');
      client.close(4403, 'ws ticket requis');
      return;
    }
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
    const { token, roomId, spectator, silent } = extractRoomWsParams(client, args);
    const payload = this.auth.tryVerify(token);
    if (!payload?.id) {
      client.close(4001, 'auth required');
      return;
    }
    const isAdmin = this.isAdmin(payload.roles);

    const targetRoomId = roomId && roomId > 0 ? roomId : 0;
    if (targetRoomId > 0) {
      const effectiveSilent = Boolean(silent);
      if (effectiveSilent && !isAdmin) {
        client.close(4003, 'Mode caché réservé aux admins');
        return;
      }

      let role: ClientRole = spectator || effectiveSilent ? 'spectator' : 'participant';
      if (role === 'spectator' && !effectiveSilent) {
        const allowed = await this.canSpectate(targetRoomId, payload.id);
        if (!allowed) {
          client.close(4003, 'Spectateur non autorise sur cette table');
          return;
        }
      } else if (role !== 'spectator') {
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
            const started =
              (state.room.status || '').toLowerCase() === 'started' ||
              Boolean(state.room.startedAt);
            if (!isOwner && !isParticipant) {
              // Table démarrée: si l'utilisateur n'est pas joueur, on tente un fallback en spectateur
              // (utile pour les tables privées: autoriser si invité).
              if (started) {
                const allowed = await this.canSpectate(targetRoomId, payload.id);
                if (allowed) {
                  role = 'spectator';
                } else {
                  await this.sendError(client, reason);
                  client.close(4003, reason);
                  return;
                }
              } else if (!isPrivate) {
                role = 'spectator';
              } else {
                // Important: envoyer un message d'erreur avant de fermer la socket,
                // pour que le client puisse afficher un dialogue explicite (ex: table privée).
                await this.sendError(client, reason);
                client.close(4003, reason);
                return;
              }
            }
          } catch {
            await this.sendError(client, reason);
            client.close(4003, reason);
            return;
          }
        }
      }
      this.clients.set(client, {
        socket: client,
        userId: payload.id,
        username: payload.username,
        roomId: targetRoomId,
        role,
        silent: effectiveSilent,
        isAdmin,
      });
    }

    if (!this.clients.has(client)) {
      this.clients.set(client, {
        socket: client,
        userId: payload.id,
        username: payload.username,
        roomId: targetRoomId,
        role: 'participant',
        silent: false,
        isAdmin,
      });
    }
    const initialMeta = this.clients.get(client);
    if (initialMeta?.silent) {
      if (!this.silentRooms.has(targetRoomId)) {
        this.silentRooms.set(targetRoomId, new Set());
      }
      this.silentRooms.get(targetRoomId)!.add(client);
    } else {
      if (!this.rooms.has(targetRoomId)) {
        this.rooms.set(targetRoomId, new Set());
      }
      this.rooms.get(targetRoomId)!.add(client);
    }
    this.realtimeTracker.setSocketParticipantRoom(
      client,
      initialMeta?.role === 'participant' && initialMeta?.silent !== true
        ? initialMeta.roomId
        : null,
    );

    // Heartbeat : ping régulier pour maintenir la connexion et détecter les resets silencieux.
    this.lastPong.set(client, Date.now());
    client.on('pong', () => this.lastPong.set(client, Date.now()));
    const hb = setInterval(() => {
      try {
        if (client.readyState !== WebSocket.OPEN) {
          clearInterval(hb);
          this.heartbeats.delete(client);
          return;
        }
        const last = this.lastPong.get(client) ?? Date.now();
        if (Date.now() - last > this.pingIntervalMs * 2) {
          clearInterval(hb);
          this.heartbeats.delete(client);
          try {
            (client as any).terminate?.();
          } catch {
            try {
              client.close();
            } catch {
              /* ignore */
            }
          }
          return;
        }
        (client as any).ping?.();
      } catch {
        // ignore
      }
    }, this.pingIntervalMs);
    this.heartbeats.set(client, hb);

    client.on('message', (raw) => this.handleMessage(client, raw));
    client.on('error', () => client.close());

    if (targetRoomId > 0) {
      if (initialMeta?.silent) {
        await this.sendRoomStateToClient(client, targetRoomId, {
          includeRealtimePlayers: true,
          includeHiddenSelf: {
            userId: initialMeta.userId,
            username: initialMeta.username,
          },
        });
      } else {
        await this.sendRoomState(targetRoomId);
      }

      await this.sendChatHistoryToClient(client, targetRoomId);
    }
  }

  async handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
    this.realtimeTracker.clearSocket(client);
    this.clients.delete(client);
    const hb = this.heartbeats.get(client);
    if (hb) {
      clearInterval(hb);
      this.heartbeats.delete(client);
    }
    // Sur déconnexion on ne veut jamais "supprimer" une table par erreur.
    // Si l'état de la table est indéterminé (ex: DB temporairement indisponible),
    // on traite la déconnexion comme un simple disconnect (disconnectOnly=true),
    // ce qui évite de marquer le joueur comme parti et de déclencher une suppression.
    let roomStarted: boolean | null = false;
    if (meta && meta.roomId > 0) {
      try {
        const state = await this.roomsService.getRoomPayload(meta.roomId);
        roomStarted =
          (state?.room?.status || '').toLowerCase() === 'started' ||
          Boolean(state?.room?.startedAt);
      } catch {
        roomStarted = null;
      }
    }
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
	      const silentSet = this.silentRooms.get(meta.roomId);
	      if (silentSet) {
	        silentSet.delete(client);
	        if (silentSet.size === 0) {
	          this.silentRooms.delete(meta.roomId);
	        }
	      }
	      // si plus aucune connexion pour cette room, on supprime la table côté service
	      if (meta.role === 'participant') {
	        const disconnectOnly = roomStarted === true || roomStarted === null;
	        this.roomsService
          .leaveRoom(meta.roomId, meta.userId, {
            preserveRoom: disconnectOnly || remainingConnections > 0,
            disconnectOnly,
	          })
	          .catch(() => {});
	      }
	      if (meta.roomId > 0 && meta.silent !== true) {
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
      this.applySpectators(roomId, payload);
      await this.broadcast(roomId, 'room.updated', payload);
    } catch {
      /* la table a peut-être été supprimée, on ignore */
    }
  }

  private applySpectators(roomId: number, payload: RoomPayload): void {
    payload.room.spectators = listVisibleSpectators(this.clients.values(), roomId);
    payload.room.counts.spectators = payload.room.spectators.length;
  }

  private async broadcastRoomPayload(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    this.applySpectators(roomId, payload);
    await this.broadcast(roomId, 'room.updated', payload);
  }

  private async tryUpdateRoomPayload(
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<boolean> {
    const updated = await this.roomsService.updateRoomPayloadCache(
      roomId,
      updater,
    );
    if (!updated) {
      return false;
    }
    await this.broadcastRoomPayload(roomId, updated);
    return true;
  }

  private async sendRoomStateToClient(
    client: WebSocket,
    roomId: number,
    opts?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ) {
    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      this.applySpectators(roomId, payload);
      if (opts?.includeHiddenSelf) {
        payload.room.spectators = addHiddenSelf(payload.room.spectators, opts.includeHiddenSelf);
        payload.room.counts.spectators = payload.room.spectators.length;
      }
      if (opts?.includeRealtimePlayers) {
        const connected = listConnectedPlayers(this.clients.values(), roomId);
        payload.room.players = mergePlayers(payload.room.players, connected);
        payload.room.counts.players = payload.room.players.length;
      }
      this.safeSend(client, { type: 'room.updated', roomId, payload });
    } catch (err) {
      await this.sendError(client, (err as Error).message || 'Erreur table');
      try {
        client.close(4003, 'room not found');
      } catch {
        /* ignore */
      }
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
    const silentTargets = this.silentRooms.get(roomId);

    const sendToSet = (set?: Set<WebSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        if (socket.readyState !== WebSocket.OPEN) {
          set.delete(socket);
          continue;
        }
        try {
          socket.send(message);
        } catch {
          set.delete(socket);
          try {
            socket.close();
          } catch {
            /* ignore */
          }
        }
      }
      if (set.size === 0) {
        if (set === targets) this.rooms.delete(roomId);
        if (set === silentTargets) this.silentRooms.delete(roomId);
      }
    };

    sendToSet(targets);
    sendToSet(silentTargets);
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
    const receivedAtMs = Date.now();
    const trace = this.extractTraceMeta(data, receivedAtMs);

    // ACK immédiat (réduit la latence perçue côté client : "commande reçue")
    // Les erreurs éventuelles seront envoyées ensuite via `error`.
    if (
      type === 'room.start' ||
      type === 'room.reset' ||
      type === 'bot.add' ||
      type === 'bot.remove' ||
      type === 'room.toggle-privacy'
    ) {
      this.safeSend(client, {
        type: 'room.ack',
        roomId: meta.roomId,
        payload: {
          action: type,
          traceId: trace.traceId,
          receivedAtMs,
          clientToServerMs: trace.clientToServerMs,
        },
      });
    }
    switch (type) {
      case 'room.leave':
        await this.handleRoomLeave(client, meta);
        break;
      case 'room.chat.send':
        await this.handleChatSend(client, meta, data);
        break;
      case 'room.chat.history':
        await this.handleChatHistory(client, meta);
        break;
      case 'room.start':
        await this.handleRoomStart(meta, data, receivedAtMs);
        break;
      case 'room.reset':
        await this.handleRoomReset(meta, data, receivedAtMs);
        break;
      case 'room.set-role':
        await this.handleSetRole(client, meta, data);
        break;
      case 'room.toggle-privacy':
        await this.handleTogglePrivacy(meta, data, receivedAtMs);
        break;
      case 'room.info':
        await this.handleRoomInfo(client, meta);
        break;
      case 'room.ping':
        this.safeSend(client, {
          type: 'room.pong',
          roomId: meta.roomId,
          payload: {
            serverTimeMs: Date.now(),
            clientSentAtMs:
              typeof data?.clientSentAtMs === 'number'
                ? data.clientSentAtMs
                : (data?._trace?.sentAtMs as number | undefined) ?? null,
          },
        });
        break;
      case 'bot.add':
        await this.handleBotAdd(meta, data, receivedAtMs);
        break;
      case 'bot.remove':
        await this.handleBotRemove(meta, data, receivedAtMs);
        break;
      case 'room.create':
        await this.handleRoomCreate(client, meta, data, receivedAtMs);
        break;
      case 'room.join':
        await this.handleRoomJoin(client, meta, data, receivedAtMs);
        break;
      default:
        break;
    }
  }

  private async sendChatHistoryToClient(
    client: WebSocket,
    roomId: number,
  ): Promise<void> {
    try {
      const enabled = await this.isRoomChatEnabled(roomId);
      if (!enabled) return;
      const state = this.getRoomChatState(roomId);
      if (state.messages.length === 0) return;
      this.safeSend(client, {
        type: 'room.chat.history',
        roomId,
        payload: { messages: state.messages },
      });
    } catch {
      // best effort
    }
  }

  private getRoomChatState(roomId: number): {
    nextSeq: number;
    messages: RoomChatMessage[];
  } {
    const existing = this.roomChat.get(roomId);
    if (existing) return existing;
    const created = { nextSeq: 1, messages: [] as RoomChatMessage[] };
    this.roomChat.set(roomId, created);
    return created;
  }

  private normalizeChatMessage(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.replace(/\r?\n/g, ' ').trim();
    if (!trimmed) return '';
    if (trimmed.length <= this.chatMaxLength) return trimmed;
    return trimmed.slice(0, this.chatMaxLength).trim();
  }

  private async isRoomChatEnabled(roomId: number): Promise<boolean> {
    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      return payload?.manifest?.chatEnabled !== false;
    } catch {
      return false;
    }
  }

  private async handleChatHistory(client: WebSocket, meta: ClientMeta) {
    if (!meta.roomId || meta.roomId <= 0) {
      await this.sendError(client, 'Vous n’êtes pas dans une table.');
      return;
    }
    await this.sendChatHistoryToClient(client, meta.roomId);
  }

  private async handleChatSend(client: WebSocket, meta: ClientMeta, data: any) {
    if (!meta.roomId || meta.roomId <= 0) {
      await this.sendError(client, 'Vous n’êtes pas dans une table.');
      return;
    }

    const enabled = await this.isRoomChatEnabled(meta.roomId);
    if (!enabled) {
      await this.sendError(client, 'Chat désactivé pour ce jeu.');
      return;
    }

    const now = Date.now();
    const lastAt = this.lastChatSentAt.get(client) ?? 0;
    if (now - lastAt < this.chatCooldownMs) {
      await this.sendError(client, 'Trop rapide. Attendez un instant.');
      return;
    }
    this.lastChatSentAt.set(client, now);

    const message = this.normalizeChatMessage(data?.message);
    if (!message) {
      return;
    }

    const state = this.getRoomChatState(meta.roomId);
    const chatMessage: RoomChatMessage = {
      seq: state.nextSeq++,
      userId: meta.userId,
      username: meta.username,
      message,
      createdAt: new Date().toISOString(),
    };
    state.messages.push(chatMessage);
    while (state.messages.length > this.roomChatLimit) {
      state.messages.shift();
    }

    await this.broadcast(meta.roomId, 'room.chat.message', chatMessage);
  }

  private extractTraceMeta(
    payload: any,
    receivedAtMs: number,
  ): { traceId: string | null; clientToServerMs: number | null } {
    const traceId =
      payload && typeof payload === 'object'
        ? (payload?._trace?.id as string | undefined)
        : undefined;
    const sentAtMs =
      payload && typeof payload === 'object'
        ? (payload?._trace?.sentAtMs as number | undefined)
        : undefined;

    const id =
      typeof traceId === 'string' && traceId.trim().length > 0
        ? traceId.trim()
        : null;

    const c2s =
      typeof sentAtMs === 'number' && Number.isFinite(sentAtMs)
        ? Math.max(0, receivedAtMs - sentAtMs)
        : null;

    return { traceId: id, clientToServerMs: c2s };
  }

  private async handleRoomInfo(client: WebSocket, meta: ClientMeta) {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    const state = await this.roomsService.getRoomPayload(roomId);
    state.room.spectators = listVisibleSpectators(this.clients.values(), roomId);
    state.room.counts.spectators = state.room.spectators.length;

    const gameName = state.manifest?.name || state.room.gameType || 'Jeu';
    const visibility = state.room.isPrivate ? 'privée' : 'publique';
    const mode = meta.role === 'spectator' ? 'spectateur' : 'joueur';

    const players =
      state.room.counts.players || state.room.players?.length || 0;
    const spectators =
      state.room.counts.spectators || state.room.spectators?.length || 0;
    const bots = state.room.bots?.length || 0;
    const total = players + spectators + bots;
    const peopleLabel = total === 1 ? 'personne' : 'personnes';

    const message = `${gameName}. Table ${visibility}. Mode ${mode}. ${total} ${peopleLabel} sur la table.`;

    this.safeSend(client, {
      type: 'room.info',
      roomId,
      payload: { message },
    });
  }

  private async handleRoomLeave(client: WebSocket, meta: ClientMeta) {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }
    this.realtimeTracker.setSocketParticipantRoom(client, null);

    const set = this.rooms.get(roomId);
    let remainingConnections = 0;
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        this.rooms.delete(roomId);
        remainingConnections = 0;
      } else {
        remainingConnections = set.size;
      }
    }

    if (meta.role === 'participant') {
      let roomStarted = false;
      try {
        const state = await this.roomsService.getRoomPayload(roomId);
        roomStarted =
          (state?.room?.status || '').toLowerCase() === 'started' ||
          Boolean(state?.room?.startedAt);
      } catch {
        roomStarted = false;
      }

      await this.roomsService.leaveRoom(roomId, meta.userId, {
        preserveRoom: roomStarted || remainingConnections > 0,
        disconnectOnly: false,
      });
    }

    // Empêche handleDisconnect de rappeler leaveRoom quand on ferme le socket après un leave explicite.
    meta.role = 'spectator';
    meta.roomId = 0;

    try {
      const payload = await this.roomsService.getRoomPayload(roomId);
      payload.room.spectators = listVisibleSpectators(this.clients.values(), roomId);
      payload.room.counts.spectators = payload.room.spectators.length;
      this.safeSend(client, { type: 'room.left', roomId, payload });
    } catch {
      this.safeSend(client, { type: 'room.deleted', roomId });
    }

    if (remainingConnections > 0) {
      await this.sendRoomState(roomId);
    }

    try {
      client.close();
    } catch {
      /* ignore */
    }
  }

  private async handleRoomStart(
    meta: AuthedClient,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.start.total',
      async () => {
        const room = await this.roomsService.startRoom(
          meta.roomId,
          meta.userId,
          false,
        );
        await this.broadcast(meta.roomId, 'state-updated', { roomId: meta.roomId });
        const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
          payload.room.status = room.status;
          payload.room.startedAt = room.startedAt ? room.startedAt.toISOString() : null;
          payload.room.runId = typeof (room as any).runId === 'number' ? (room as any).runId : null;
          payload.generatedAt = new Date().toISOString();
          return payload;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await this.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async handleRoomReset(
    meta: AuthedClient,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.reset.total',
      async () => {
        const room = await this.roomsService.resetRoom(
          meta.roomId,
          meta.userId,
          false,
        );
        await this.broadcast(meta.roomId, 'state-updated', { roomId: meta.roomId });
        const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
          payload.room.status = room.status;
          payload.room.startedAt = null;
          payload.room.runId = typeof (room as any).runId === 'number' ? (room as any).runId : null;
          payload.generatedAt = new Date().toISOString();
          return payload;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await this.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async handleTogglePrivacy(
    meta: AuthedClient,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.togglePrivacy.total',
      async () => {
        const room = await this.roomsService.togglePrivacy(
          meta.roomId,
          meta.userId,
          false,
        );
        let state = await this.roomsService.updateRoomPayloadCache(
          meta.roomId,
          (payload) => {
            payload.room.isPrivate = room.isPrivate;
            payload.generatedAt = new Date().toISOString();
            return payload;
          },
        );
        if (!state) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          state = await this.roomsService.getRoomPayload(meta.roomId);
        }
        await this.broadcast(meta.roomId, 'room.privacy', {
          isPrivate: state.room.isPrivate,
          room: state.room,
        });
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async handleBotAdd(
    meta: AuthedClient,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.add.total',
      async () => {
        const bot = await this.botService.addBot(meta.roomId, meta.userId);
        await this.broadcast(meta.roomId, 'bot.added', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
        });
        const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
          payload.room.bots = payload.room.bots ?? [];
          if (!payload.room.bots.some((b) => b.id === bot.id)) {
            payload.room.bots.push({ id: bot.id, name: bot.name });
          }
          payload.generatedAt = new Date().toISOString();
          return payload;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await this.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async handleBotRemove(
    meta: AuthedClient,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.remove.total',
      async () => {
        let botId = Number(payload?.botId ?? payload?.id ?? -1);
        if (!Number.isFinite(botId) || botId <= 0) {
          const last = await this.botService.getLastBotForRoom(meta.roomId);
          if (!last?.id) {
            throw new Error('Aucun bot à retirer');
          }
          botId = Number(last.id);
        }
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
        const updated = await this.tryUpdateRoomPayload(meta.roomId, (payload) => {
          payload.room.bots = (payload.room.bots ?? []).filter(
            (b) => b.id !== bot.id,
          );
          payload.generatedAt = new Date().toISOString();
          return payload;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await this.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
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

    this.realtimeTracker.setSocketParticipantRoom(
      client,
      meta.role === 'participant' ? meta.roomId : null,
    );

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
    meta: ClientMeta,
    payload: any,
    receivedAtMs: number,
  ) {
    const trace = this.extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.create.total',
      async () => {
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
          false,
        );

        const previousRoomId = meta.roomId;
        if (previousRoomId !== room.id) {
          const previousSet = this.rooms.get(previousRoomId);
          if (previousSet) {
            previousSet.delete(client);
            if (previousSet.size === 0) {
              this.rooms.delete(previousRoomId);
            }
          }
          if (!this.rooms.has(room.id)) {
            this.rooms.set(room.id, new Set());
          }
          this.rooms.get(room.id)!.add(client);
        }
        meta.roomId = room.id;
        meta.role = 'participant';
        this.realtimeTracker.setSocketParticipantRoom(client, room.id);

        const manifest = await this.catalog.getGame(room.gameType);
        const state = {
          manifest: manifest
            ? {
                id: manifest.id,
                name: manifest.name,
                minPlayers: manifest.minPlayers ?? 2,
                maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
                chatEnabled: manifest.chatEnabled !== false,
                chatSoundsEnabled: manifest.chatSoundsEnabled !== false,
              }
            : null,
          room: {
            id: room.id,
            name: room.name,
            isPrivate: room.isPrivate,
            maxPlayers: room.maxPlayers,
            status: room.status,
            gameType: room.gameType,
            startedAt: room.startedAt ? room.startedAt.toISOString() : null,
            counts: { players: 1, spectators: 0 },
            owner: { id: meta.userId, username: meta.username },
            players: [
              {
                id: meta.userId,
                username: meta.username,
              } satisfies RoomPlayer,
            ],
            spectators: [],
            bots: [],
          },
          generatedAt: new Date().toISOString(),
        };
        const message = { type: 'room.created', roomId: room.id, payload: state };
        if (previousRoomId > 0) {
          await this.broadcast(
            previousRoomId,
            message.type,
            message.payload ?? state,
            room.id,
          );
        }
        await this.roomsService.primeRoomPayloadCache(room.id, state);
        this.safeSend(client, message);
        await this.broadcastRoomPayload(room.id, state);
      },
      {
        userId: meta.userId,
        roomId: meta.roomId,
        gameType: payload?.gameType ?? null,
        ...trace,
      },
    );
  }

		  private async handleRoomJoin(
		    client: WebSocket,
		    meta: ClientMeta,
		    payload: any,
		    receivedAtMs: number,
		  ) {
	    const trace = this.extractTraceMeta(payload, receivedAtMs);
	    await this.perf.measure(
	      'ws.room.join.total',
		      async () => {
		        const roomId = Number(payload?.roomId ?? payload?.room ?? 0);
	        const spectatorRaw = payload?.spectator;
	        const spectator =
	          spectatorRaw === true ||
	          spectatorRaw === 1 ||
	          spectatorRaw === '1' ||
	          spectatorRaw === 'true' ||
	          spectatorRaw === 'yes' ||
	          spectatorRaw === 'y';
	        const silentRaw = payload?.silent;
	        const hiddenRaw = payload?.hidden;
	        const silent =
	          silentRaw === true ||
	          silentRaw === 1 ||
	          silentRaw === '1' ||
	          silentRaw === 'true' ||
	          silentRaw === 'yes' ||
	          silentRaw === 'y' ||
	          hiddenRaw === true ||
	          hiddenRaw === 1 ||
	          hiddenRaw === '1' ||
	          hiddenRaw === 'true' ||
	          hiddenRaw === 'yes' ||
	          hiddenRaw === 'y';

	        if (!Number.isFinite(roomId) || roomId <= 0) {
	          throw new Error('roomId invalide');
	        }

		        const effectiveSilent = Boolean(silent);
		        if (effectiveSilent && !meta.isAdmin) {
		          client.close(4003, 'Mode caché réservé aux admins');
		          return;
		        }

		        let effectiveSpectator = spectator || effectiveSilent;
		        if (effectiveSpectator && !effectiveSilent) {
		          const allowed = await this.canSpectate(roomId, meta.userId);
		          if (!allowed) {
		            client.close(4003, 'Spectateur non autorise sur cette table');
		            return;
		          }
		        }

		        if (!effectiveSpectator) {
		          try {
		            await this.roomsService.joinRoom(roomId, meta.userId);
			          } catch (err) {
			            // Table démarrée: autoriser un "join" en spectateur plutôt que refuser,
			            // à condition que l'utilisateur ait le droit de spectate (tables privées: invite).
			            const reason = (err as Error).message;
			            const state = await this.roomsService.getRoomPayload(roomId);
			            const isOwner = state.room.owner?.id === meta.userId;
			            const isParticipant =
			              state.room.players?.some((p) => p?.id === meta.userId) ?? false;
			            const started =
			              (state.room.status || '').toLowerCase() === 'started' ||
			              Boolean(state.room.startedAt);
			            if (started) {
			              // Rejoin: si l'utilisateur est déjà joueur (owner/participant),
			              // on accepte la connexion en "participant" même si joinRoom() refuse.
			              if (isOwner || isParticipant) {
			                // no-op
			              } else {
			                const allowed = await this.canSpectate(roomId, meta.userId);
			                if (!allowed) {
			                  throw new Error(reason);
			                }
			                effectiveSpectator = true;
			              }
			            } else {
			              throw err;
			            }
			          }
			        }

	        const previousRoomId = meta.roomId;
	        if (previousRoomId !== roomId) {
	          const previousSet = this.rooms.get(previousRoomId);
	          if (previousSet) {
	            previousSet.delete(client);
	            if (previousSet.size === 0) {
	              this.rooms.delete(previousRoomId);
	            }
	          }
	          const previousSilentSet = this.silentRooms.get(previousRoomId);
	          if (previousSilentSet) {
	            previousSilentSet.delete(client);
	            if (previousSilentSet.size === 0) {
	              this.silentRooms.delete(previousRoomId);
	            }
	          }

	          if (effectiveSilent) {
	            if (!this.silentRooms.has(roomId)) {
	              this.silentRooms.set(roomId, new Set());
	            }
	            this.silentRooms.get(roomId)!.add(client);
	          } else {
	            if (!this.rooms.has(roomId)) {
	              this.rooms.set(roomId, new Set());
	            }
	            this.rooms.get(roomId)!.add(client);
	          }
	        }

	        meta.roomId = roomId;
	        meta.role = effectiveSpectator ? 'spectator' : 'participant';
	        meta.silent = effectiveSilent;
	        this.realtimeTracker.setSocketParticipantRoom(
	          client,
	          meta.role === 'participant' && meta.silent !== true ? meta.roomId : null,
	        );
	        if (effectiveSilent) {
	          await this.sendRoomStateToClient(client, roomId, {
	            includeRealtimePlayers: true,
              includeHiddenSelf: { userId: meta.userId, username: meta.username },
	          });
	        } else {
	          await this.sendRoomState(roomId);
	        }
	      },
	      { userId: meta.userId, roomId: payload?.roomId ?? payload?.room ?? null, ...trace },
	    );
	  }

  private isAdmin(roles?: string[] | null): boolean {
    if (!roles || roles.length === 0) return false;
    return roles.some((r) => {
      const v = (r || '').trim().toLowerCase();
	      return v === 'role_admin' || v === 'admin' || v === 'administrator';
	    });
	  }

  private countSpectators(roomId: number): number {
    return listVisibleSpectators(this.clients.values(), roomId).length;
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
      if (isOwner || isParticipant) return true;
      const started =
        (state.room.status || '').toLowerCase() === 'started' ||
        Boolean(state.room.startedAt);
      return started && this.invites.canSpectate(roomId, userId);
    } catch {
      return false;
    }
  }
}
