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
import type { RoomPlayer } from '../dto/room-response.dto';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { RoomInviteService } from '../services/room-invite.service';
import { ClientUpdatesService } from '../../client-updates/client-updates.service';
import { isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';

type AuthedClient = {
  socket: WebSocket;
  userId: number;
  username: string;
  roomId: number;
};
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
  private readonly heartbeats = new Map<WebSocket, NodeJS.Timeout>();
  private readonly lastPong = new WeakMap<WebSocket, number>();
  private readonly pingIntervalMs = 25_000;

  constructor(
    private readonly roomsService: RoomService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    config: ConfigService,
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

    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET doit être défini pour le WS room');
    }
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
      });
    }

    if (!this.clients.has(client)) {
      this.clients.set(client, {
        socket: client,
        userId: payload.id,
        username: payload.username,
        roomId: targetRoomId,
        role: 'participant',
      });
    }
    if (!this.rooms.has(targetRoomId)) {
      this.rooms.set(targetRoomId, new Set());
    }
    this.rooms.get(targetRoomId)!.add(client);
    if (targetRoomId > 0 && this.clients.get(client)?.role === 'participant') {
      this.realtimeTracker.registerPlayer(targetRoomId);
    }

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
      await this.sendRoomState(targetRoomId);
    }
  }

  async handleDisconnect(client: WebSocket) {
    const meta = this.clients.get(client);
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
      if (meta.roomId > 0 && meta.role === 'participant') {
        this.realtimeTracker.unregisterPlayer(meta.roomId);
      }
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
        const disconnectOnly = roomStarted === true || roomStarted === null;
        this.roomsService
          .leaveRoom(meta.roomId, meta.userId, {
            preserveRoom: disconnectOnly || remainingConnections > 0,
            disconnectOnly,
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
      payload.room.spectators = this.listSpectators(roomId);
      payload.room.counts.spectators = payload.room.spectators.length;
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
    state.room.spectators = this.listSpectators(roomId);
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
      payload.room.spectators = this.listSpectators(roomId);
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
        await this.roomsService.startRoom(meta.roomId, meta.userId);
        await this.broadcast(meta.roomId, 'state-updated', { roomId: meta.roomId });
        await this.sendRoomState(meta.roomId);
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
        await this.roomsService.resetRoom(meta.roomId, meta.userId);
        await this.broadcast(meta.roomId, 'state-updated', { roomId: meta.roomId });
        await this.sendRoomState(meta.roomId);
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
        await this.roomsService.togglePrivacy(meta.roomId, meta.userId);
        const state = await this.roomsService.getRoomPayload(meta.roomId);
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
        await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
        await this.broadcast(meta.roomId, 'bot.added', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
        });
        await this.sendRoomState(meta.roomId);
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
          const state = await this.roomsService.getRoomPayload(meta.roomId);
          const bots = state?.room?.bots ?? [];
          const last = bots.length > 0 ? bots[bots.length - 1] : null;
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
        await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
        await this.broadcast(meta.roomId, 'bot.removed', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
          botId,
        });
        await this.sendRoomState(meta.roomId);
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

        const manifest = await this.catalog.getGame(room.gameType);
        const state = {
          manifest: manifest
            ? {
                id: manifest.id,
                name: manifest.name,
                minPlayers: manifest.minPlayers ?? 2,
                maxPlayers: manifest.maxPlayers ?? room.maxPlayers,
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
        await this.sendRoomState(room.id);
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

        if (!Number.isFinite(roomId) || roomId <= 0) {
          throw new Error('roomId invalide');
        }

        if (spectator) {
          const allowed = await this.canSpectate(roomId, meta.userId);
          if (!allowed) {
            client.close(4003, 'Spectateur non autorise sur cette table');
            return;
          }
        }

        if (!spectator) {
          await this.roomsService.joinRoom(roomId, meta.userId);
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
          if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
          }
          this.rooms.get(roomId)!.add(client);
        }

        meta.roomId = roomId;
        meta.role = spectator ? 'spectator' : 'participant';
        await this.sendRoomState(roomId);
      },
      { userId: meta.userId, roomId: payload?.roomId ?? payload?.room ?? null, ...trace },
    );
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

  private listSpectators(roomId: number): RoomPlayer[] {
    const unique = new Map<number, string>();
    for (const meta of this.clients.values()) {
      if (meta.roomId !== roomId) continue;
      if (meta.role !== 'spectator') continue;
      unique.set(meta.userId, meta.username || `User ${meta.userId}`);
    }
    return Array.from(unique.entries()).map(([id, username]) => ({
      id,
      username,
    }));
  }

  private countSpectators(roomId: number): number {
    return this.listSpectators(roomId).length;
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
