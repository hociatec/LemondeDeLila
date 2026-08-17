import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { RoomService } from '../services/room.service';
import { BotService } from '../../bot/services/bot.service';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { WsJwtAuthService } from '../../common/ws/ws-jwt-auth.service';
import type {
  RoomPayload,
} from '../dto/room-response.dto';
import type { RoomFocusIntent } from '../dto/room-focus-intent.dto';
import type { RoomIntent, RoomStartWizardIntent } from '../dto/room-intent.dto';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import { RoomInviteService } from '../services/room-invite.service';
import { ClientUpdatesService } from '../../client-updates/services/client-updates.service';
import { isVersionLower } from '../../common/utils/version.utils';
import { WsTicketAuthService } from '../../common/ws/ws-ticket-auth.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { extractRoomWsParams } from './room-ws-params';
import { SoundsService } from '../../sounds/sounds.service';
import {
  addHiddenSelf,
  listConnectedPlayers,
  listVisibleSpectators,
  mergePlayers,
} from './room-roster';
import { RoomChatStore, type RoomChatMessage } from './room-chat-state';
import {
  buildRoomSnapshot,
  collectRoomAnnouncementMessages,
  type RoomSnapshot,
} from './room-announcement.helpers';
import {
  buildBotJoinedMessage,
  buildBotLeftMessage,
  buildPlayerBecamePlayerMessage,
  buildPlayerBecameSpectatorMessage,
  buildPlayerJoinedMessage,
  buildPlayerLeftMessage,
} from './room-announcement-message.helpers';
import { emitRoomAnnouncementDiff } from './room-announcement-diff.helpers';
import {
  addBotToRoomPayload,
  removeBotFromRoomPayload,
} from './room-bot-payload.helpers';
import {
  extractTraceMeta,
  isImmediateAckAction,
  mapIntentToLegacyCommand,
} from './room-command.helpers';
import {
  addSocketToRoomMembership,
  hasUserConnectionsInRoom,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import { RoomSocketHeartbeat } from './room-heartbeat.helpers';
import {
  ensureUserIsOnTable,
  requireOwnerActionState,
  requireTargetUserId,
  requireValidRoomId,
} from './room-admin.helpers';
import { buildRoomInfoMessage } from './room-info.helpers';
import {
  buildRoomRoleAnnouncementMessage,
  buildRoomRoleClientMessage,
  resolveSpectatorIntent,
  resolveTruthyFlag,
} from './room-role.helpers';
import { buildCreatedRoomState } from './room-created-state.helpers';
import {
  parseRoomCreateRequest,
  parseRoomJoinRequest,
} from './room-request.helpers';

type AuthedClient = {
  socket: WebSocket;
  userId: number;
  username: string;
  roomId: number;
};
type IncomingPayload = { type?: string; payload?: unknown };
type ClientRole = 'participant' | 'spectator';
type ClientMeta = AuthedClient & {
  role: ClientRole;
  silent: boolean;
  isAdmin: boolean;
};

type RoomWithOptionalRuntimeFields = {
  runId?: unknown;
  tableAmbienceSoundId?: string | null;
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
  private readonly heartbeat = new RoomSocketHeartbeat(25_000);
  private readonly messageQueueByClient = new WeakMap<
    WebSocket,
    Promise<void>
  >();
  private readonly roomChat = new RoomChatStore();
  private readonly lastRoomStatusByRoomId = new Map<number, string>();
  private readonly lastRoomSnapshotByRoomId = new Map<number, RoomSnapshot>();
  private readonly participantDisconnectGraceMs = 60_000;
  private readonly pendingParticipantLeaves = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly roomsService: RoomService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    private readonly auth: WsJwtAuthService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly invites: RoomInviteService,
    private readonly clientUpdates: ClientUpdatesService,
    private readonly wsTickets: WsTicketAuthService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly sounds: SoundsService,
  ) {
    // Permet au backend (ex: moteur de jeu) de notifier les clients room sans dépendre du Gateway.
    this.roomsService.setRealtimeNotifier(async (roomId: number) => {
      await this.broadcast(roomId, 'state-updated', { roomId });
      await this.sendRoomState(roomId);
    });

    // Permet à l'admin (via RoomService) de forcer la suppression d'une room
    // en déconnectant tous les clients WS connectés à cette table.
    this.roomsService.setRoomDeletedNotifier(async (roomId: number) => {
      this.roomChat.clearRoom(roomId);
      this.forceDisconnectRoomClients(roomId);
    });

    // Auth JWT is handled by WsJwtAuthService (RS256/HS256 depending on configuration).
  }

  private forceDisconnectRoomClients(roomId: number): void {
    const targets = this.rooms.get(roomId);
    const silentTargets = this.silentRooms.get(roomId);

    const socketSet = new Set<WebSocket>();
    if (targets) {
      for (const socket of targets) socketSet.add(socket);
    }
    if (silentTargets) {
      for (const socket of silentTargets) socketSet.add(socket);
    }
    // Fallback: certains sockets peuvent ne pas être dans les sets (état dégradé).
    // On éjecte tout client encore associé à la room pour éviter les "écrans bloqués".
    for (const [socket, meta] of this.clients.entries()) {
      if (meta?.roomId === roomId) {
        socketSet.add(socket);
      }
    }

    const all = Array.from(socketSet);

    // Important: `ws` send is async; closing immediately can drop the last message.
    // We therefore send 'room.deleted' and close the socket in the send callback.
    const deletedMessage = JSON.stringify({ type: 'room.deleted', roomId });

    for (const socket of all) {
      // Important: retirer avant close pour éviter handleDisconnect/leaveRoom en cascade.
      this.realtimeTracker.clearSocket(socket);
      this.clients.delete(socket);
      targets?.delete(socket);
      silentTargets?.delete(socket);

      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(deletedMessage, () => {
            try {
              socket.close();
            } catch {
              /* ignore */
            }
          });
        } else {
          socket.close();
        }
      } catch {
        /* ignore */
      }
    }

    if (targets?.size === 0) this.rooms.delete(roomId);
    if (silentTargets?.size === 0) this.silentRooms.delete(roomId);
  }

  async handleConnection(client: WebSocket, ...args: unknown[]) {
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
    const { token, roomId, spectator, silent } = extractRoomWsParams(
      client,
      args,
    );
    const payload = this.auth.tryVerify(token);
    if (!payload?.id) {
      client.close(4001, 'auth required');
      return;
    }
    const isAdmin = this.isAdmin(payload.roles);

    let targetRoomId = roomId && roomId > 0 ? roomId : 0;
    if (targetRoomId > 0) {
      this.clearPendingParticipantLeave(targetRoomId, payload.id);
      const effectiveSilent = Boolean(silent);
      if (this.roomsService.isBanned(targetRoomId, payload.id)) {
        await this.sendError(client, 'Banni de cette table.');
        // Keep the socket open so the client can go back to home and join another room.
        targetRoomId = 0;
      }
      if (effectiveSilent && !isAdmin) {
        client.close(4003, 'Mode caché réservé aux admins');
        return;
      }

      let role: ClientRole =
        spectator || effectiveSilent ? 'spectator' : 'participant';
      if (role === 'spectator' && !effectiveSilent) {
        try {
          await this.roomsService.leaveAllRoomsForUser(payload.id, {
            exceptRoomId: targetRoomId,
          });
        } catch {
          // ignore
        }
        const allowed = await this.canSpectate(targetRoomId, payload.id);
        if (!allowed) {
          client.close(4003, 'Spectateur non autorise sur cette table');
          return;
        }
        // Alignement avec `room.set-role`: si on connecte directement en spectateur sur une table non démarrée,
        // on se retire des participants quand c'est autorisé (public, ou owner sur privé) pour éviter d'apparaître
        // à la fois dans `players` (DB) et `spectators` (WS).
        try {
          const state = await this.roomsService.getRoomPayload(targetRoomId);
          const isOwner = state.room.owner?.id === payload.id;
          const started =
            (state.room.status || '').toLowerCase() === 'started' ||
            Boolean(state.room.startedAt);
          if (!started && (!state.room.isPrivate || isOwner)) {
            await this.roomsService.leaveRoom(targetRoomId, payload.id, {
              preserveRoom: true,
              preserveOwner: isOwner,
            });
          }
        } catch {
          // ignore: best effort
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
                try {
                  await this.roomsService.leaveAllRoomsForUser(payload.id, {
                    exceptRoomId: targetRoomId,
                  });
                } catch {
                  // ignore
                }

                const allowed = await this.canSpectate(
                  targetRoomId,
                  payload.id,
                );
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
      addSocketToRoomMembership(
        this.rooms,
        this.silentRooms,
        targetRoomId,
        client,
        true,
      );
    } else {
      addSocketToRoomMembership(
        this.rooms,
        this.silentRooms,
        targetRoomId,
        client,
        false,
      );
    }
    this.realtimeTracker.setSocketParticipantRoom(
      client,
      initialMeta?.role === 'participant' && initialMeta?.silent !== true
        ? initialMeta.roomId
        : null,
    );

    // Heartbeat : ping régulier pour maintenir la connexion et détecter les resets silencieux.
    this.heartbeat.start(client);

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
    this.messageQueueByClient.delete(client);
    this.heartbeat.stop(client);
    // Sur déconnexion on ne veut jamais "supprimer" une table par erreur.
    // Si l'état de la table est indéterminé (ex: DB temporairement indisponible),
    // on traite la déconnexion comme un simple disconnect (disconnectOnly=true),
    // ce qui évite de marquer le joueur comme parti et de déclencher une suppression.
    let ownerId: number | null = null;
    if (meta && meta.roomId > 0) {
      try {
        const state = await this.roomsService.getRoomPayload(meta.roomId);
        ownerId = state?.room?.owner?.id ?? null;
      } catch {
        ownerId = null;
      }
    }
    if (meta) {
      const {
        remainingTotalConnections,
      } = removeSocketFromRoomMembership(
        this.rooms,
        this.silentRooms,
        meta.roomId,
        client,
      );
      const userStillConnected = this.hasUserConnections(
        meta.roomId,
        meta.userId,
      );
      // si plus aucune connexion pour cette room, on supprime la table côté service
      if (meta.role === 'participant') {
        // Important: ne pas "quitter" en DB si l'utilisateur a encore une autre connexion
        // (ex: double socket silent/visible, reconnexion rapide).
        if (!userStillConnected) {
          // Sur déconnexion on ne veut jamais supprimer une table par erreur.
          // On marque toutefois le joueur comme parti (et donc remplaçable par un bot en partie démarrée),
          // sauf si l'état de la table est indéterminé (ex: DB temporairement indisponible).
          const disconnectOnly = true;
          this.roomsService
            .leaveRoom(meta.roomId, meta.userId, {
              preserveRoom: true,
              disconnectOnly,
            })
            .catch(() => {});

          // Toujours planifier un leave réel après la fenêtre de grâce:
          // - évite les participants fantômes en setup
          // - évite les rooms démarrées sans humain (zombies) qui restent actives
          this.scheduleDelayedParticipantLeave(meta.roomId, meta.userId);
        }
      } else {
        if (!userStillConnected && ownerId === meta.userId) {
          this.roomsService
            .transferOwnerIfCurrent(meta.roomId, meta.userId)
            .catch(() => {});
        }

        if (remainingTotalConnections === 0) {
          this.roomsService
            .leaveRoom(meta.roomId, meta.userId, {
              preserveRoom: false,
              disconnectOnly: false,
            })
            .catch(() => {});
        }
      }
      if (meta.roomId > 0 && meta.silent !== true) {
        this.sendRoomState(meta.roomId).catch(() => {});
      }
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: WebSocket, raw: unknown) {
    await this.enqueueClientMessage(client, async () => {
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
    });
  }

  private enqueueClientMessage(
    client: WebSocket,
    fn: () => Promise<void>,
  ): Promise<void> {
    const prev = this.messageQueueByClient.get(client) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    // Keep the chain alive even if one handler throws.
    this.messageQueueByClient.set(
      client,
      next.catch(() => {}),
    );
    return next;
  }

  private async sendRoomState(roomId: number) {
    try {
      let payload = await this.roomsService.getRoomPayload(roomId);

      const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '')
        .toLowerCase()
        .trim();
      const nextStatus = String(payload?.room?.status ?? '')
        .toLowerCase()
        .trim();
      if (
        previousStatus === 'started' &&
        nextStatus &&
        nextStatus !== 'started'
      ) {
        await this.promoteConnectedSpectatorsToParticipants(roomId);
        await this.roomsService.invalidateRoomPayloadCache(roomId);
        payload = await this.roomsService.getRoomPayload(roomId);
      }
      this.lastRoomStatusByRoomId.set(roomId, nextStatus);

      this.applySpectators(roomId, payload);
      await this.broadcastRoomUpdated(roomId, payload);
    } catch {
      /* la table a peut-être été supprimée, on ignore */
    }
  }

  private applySpectators(roomId: number, payload: RoomPayload): void {
    payload.room.spectators = listVisibleSpectators(
      this.clients.values(),
      roomId,
    );
    payload.room.counts.spectators = payload.room.spectators.length;

    // Garde-fou: éviter qu'un utilisateur apparaisse à la fois dans `players` (participants DB)
    // et `spectators` (role socket) avant le démarrage.
    const started =
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    if (
      !started &&
      payload.room.players?.length &&
      payload.room.spectators?.length
    ) {
      const spectatorIds = new Set(payload.room.spectators.map((s) => s.id));
      payload.room.players = payload.room.players.filter(
        (p) => !spectatorIds.has(p.id),
      );
      payload.room.counts.players = payload.room.players.length;
    }

    // Garde-fou (y compris en partie démarrée): si un utilisateur est joueur (DB),
    // il ne doit pas apparaître en spectateur.
    if (payload.room.players?.length && payload.room.spectators?.length) {
      const playerIds = new Set(payload.room.players.map((p) => p.id));
      payload.room.spectators = payload.room.spectators.filter(
        (s) => !playerIds.has(s.id),
      );
      payload.room.counts.spectators = payload.room.spectators.length;
    }
  }

  private buildAllowedActionsForClient(
    meta: ClientMeta,
    payload: RoomPayload,
  ): string[] {
    const room = payload.room;
    const started =
      (room.status || '').toLowerCase() === 'started' ||
      Boolean(room.startedAt);
    const isOwner = room.owner?.id === meta.userId;
    const isParticipant =
      room.players?.some((p) => p?.id === meta.userId) ?? false;
    const canToggleRole =
      !started && (!room.isPrivate || isOwner || isParticipant);

    const actions = new Set<string>([
      'room.rules',
      'room.info',
      'room.players',
      'room.leave',
      'room.tableAmbienceVolume',
    ]);

    if (canToggleRole) {
      actions.add('room.set-role');
    }

    if (isOwner) {
      actions.add('room.start');
      actions.add('room.reset');
      actions.add('room.toggle-privacy');
      actions.add('bot.add');
      actions.add('bot.remove');
      actions.add('room.kick');
      actions.add('room.ban');
      actions.add('room.set-owner');
      actions.add('room.set-ambience');
      actions.add('room.tableAmbience');
      actions.add('room.snapshot.save');
    }

    return Array.from(actions);
  }

  private withAllowedActionsForClient(
    payload: RoomPayload,
    meta: ClientMeta,
  ): RoomPayload {
    return {
      ...payload,
      room: {
        ...payload.room,
        allowedActions: this.buildAllowedActionsForClient(meta, payload),
      },
    };
  }

  private async broadcastRoomUpdated(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const targets = this.rooms.get(roomId);
    const silentTargets = this.silentRooms.get(roomId);

    const sendToSet = (set?: Set<WebSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        const meta = this.clients.get(socket);
        if (!meta || socket.readyState !== WebSocket.OPEN) {
          set.delete(socket);
          continue;
        }
        try {
          const payloadForClient = this.withAllowedActionsForClient(
            payload,
            meta,
          );
          socket.send(
            JSON.stringify({
              type: 'room.updated',
              roomId,
              payload: payloadForClient,
            }),
          );
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

  private async broadcastRoomIntent(
    roomId: number,
    intent: RoomIntent,
  ): Promise<void> {
    await this.broadcast(roomId, 'room.intent', intent);
  }

  private buildStartWizardIntent(
    payload: RoomPayload,
    previousStatus: string,
    nextStatus: string,
  ): RoomStartWizardIntent | null {
    if (
      previousStatus.length === 0 &&
      nextStatus.length > 0 &&
      nextStatus !== 'started'
    ) {
      return {
        ownerId: payload.room.owner?.id ?? null,
        title: 'Configuration de la table',
        description: 'Le serveur vous invite à préparer la partie.',
        message: 'Choisissez rapidement l’ambiance et la configuration.',
      };
    }

    return null;
  }

  private computeStatusFocusIntent(
    roomId: number,
    payload: RoomPayload,
  ): RoomFocusIntent | null {
    const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '')
      .toLowerCase()
      .trim();
    const nextStatus = String(payload.room.status ?? '')
      .toLowerCase()
      .trim();

    if (previousStatus !== 'started' && nextStatus === 'started') {
      return {
        region: 'game',
        reason: 'room.started',
        priority: 'assertive',
      };
    }

    return null;
  }

  private async broadcastRoomPayload(
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '')
      .toLowerCase()
      .trim();
    const nextStatus = String(payload.room.status ?? '')
      .toLowerCase()
      .trim();

    this.applySpectators(roomId, payload);
    const focusIntent = this.computeStatusFocusIntent(roomId, payload);
    await this.broadcastRoomUpdated(roomId, payload);
    if (focusIntent) {
      await this.broadcast(roomId, 'room.focus', focusIntent);
      await this.broadcastRoomIntent(roomId, {
        type: 'focus',
        payload: focusIntent,
      } satisfies RoomIntent);
      await this.broadcastRoomIntent(roomId, {
        type: 'announcement',
        payload: {
          message:
            focusIntent.reason === 'room.started'
              ? 'la partie démare, bon jeux!'
              : 'Mise à jour de la table en cours.',
          priority:
            focusIntent.priority === 'assertive' ? 'assertive' : 'polite',
        },
      } satisfies RoomIntent);
    }

    const previousSnapshot = this.lastRoomSnapshotByRoomId.get(roomId);
    const nextSnapshot = buildRoomSnapshot(payload);
    await this.emitRoomAnnouncementsFromDiff(
      roomId,
      previousSnapshot,
      nextSnapshot,
    );
    this.lastRoomSnapshotByRoomId.set(roomId, nextSnapshot);

    const startWizardIntent = this.buildStartWizardIntent(
      payload,
      previousStatus,
      nextStatus,
    );
    if (startWizardIntent) {
      await this.broadcastRoomIntent(roomId, {
        type: 'start-wizard',
        payload: startWizardIntent,
      } satisfies RoomIntent);
      const gameName = (
        payload.manifest?.name ??
        payload.room.gameType ??
        ''
      ).trim();
      const creationMessage =
        gameName.length === 0
          ? 'Table créée. Ajoutez des bots et commencez à jouer (Entrée).'
          : `Table de ${gameName} créée. Ajoutez des bots et commencez à jouer (Entrée).`;
      await this.broadcastRoomIntent(roomId, {
        type: 'announcement',
        payload: {
          message: creationMessage,
        },
      } satisfies RoomIntent);
    }
    this.lastRoomStatusByRoomId.set(roomId, nextStatus);
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
        payload.room.spectators = addHiddenSelf(
          payload.room.spectators,
          opts.includeHiddenSelf,
        );
        payload.room.counts.spectators = payload.room.spectators.length;
      }
      if (opts?.includeRealtimePlayers) {
        const connected = listConnectedPlayers(this.clients.values(), roomId);
        payload.room.players = mergePlayers(payload.room.players, connected);
        payload.room.counts.players = payload.room.players.length;
      }
      const previousStatus = (this.lastRoomStatusByRoomId.get(roomId) ?? '')
        .toLowerCase()
        .trim();
      const nextStatus = String(payload.room.status ?? '')
        .toLowerCase()
        .trim();

      const focusIntent = this.computeStatusFocusIntent(roomId, payload);
      const meta = this.clients.get(client);
      const payloadForClient =
        meta != null
          ? this.withAllowedActionsForClient(payload, meta)
          : payload;
      this.safeSend(client, {
        type: 'room.updated',
        roomId,
        payload: payloadForClient,
      });
      if (focusIntent) {
        this.safeSend(client, {
          type: 'room.focus',
          roomId,
          payload: focusIntent,
        });
        this.safeSend(client, {
          type: 'room.intent',
          roomId,
          payload: {
            type: 'focus',
            payload: focusIntent,
          } satisfies RoomIntent,
        });
        this.safeSend(client, {
          type: 'room.intent',
          roomId,
          payload: {
            type: 'announcement',
            payload: {
              message:
                focusIntent.reason == 'room.started'
                  ? 'la partie démare, bon jeux!'
                  : 'Mise à jour de la table en cours.',
              priority:
                focusIntent.priority == 'assertive' ? 'assertive' : 'polite',
            },
          } satisfies RoomIntent,
        });
      }
      const startWizardIntent = this.buildStartWizardIntent(
        payload,
        previousStatus,
        nextStatus,
      );
      if (startWizardIntent) {
        this.safeSend(client, {
          type: 'room.intent',
          roomId,
          payload: {
            type: 'start-wizard',
            payload: startWizardIntent,
          },
        });
      }
      this.lastRoomSnapshotByRoomId.set(
        roomId,
        buildRoomSnapshot(payload),
      );
      this.lastRoomStatusByRoomId.set(roomId, nextStatus);
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
    payload: unknown,
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

  private sendRoomError(client: WebSocket, roomId: number, message: string) {
    this.safeSend(client, {
      type: 'error',
      roomId,
      payload: { message },
    });
  }

  private safeSend(client: WebSocket, payload: unknown) {
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

  private decode(raw: unknown): IncomingPayload | null {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (Buffer.isBuffer(raw)) {
      text = raw.toString('utf-8');
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString('utf-8');
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

    if (type === 'room.intent.execute') {
      await this.handleRoomIntentExecute(client, meta, data, receivedAtMs);
      return;
    }

    this.sendImmediateAckIfNeeded(client, meta, type, data, receivedAtMs);
    await this.executeLegacyRoomCommand(client, meta, type, data, receivedAtMs);
  }

  private async handleRoomIntentExecute(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const envelope = this.asRecord(payload);
    const intentIdRaw =
      typeof envelope.intentId === 'string'
        ? envelope.intentId
        : typeof envelope.action === 'string'
          ? envelope.action
          : typeof envelope.type === 'string'
            ? envelope.type
            : '';
    const intentId = intentIdRaw.trim().toLowerCase();
    if (intentId.length === 0) {
      throw new Error('intentId requis');
    }

    const legacyType = mapIntentToLegacyCommand(intentId);
    if (!legacyType) {
      throw new Error(`Intent inconnu: ${intentId}`);
    }

    const payloadSource = Object.prototype.hasOwnProperty.call(envelope, 'data')
      ? envelope.data
      : envelope.payload;
    const legacyPayload: Record<string, unknown> =
      payloadSource != null && typeof payloadSource === 'object'
        ? { ...(payloadSource as Record<string, unknown>) }
        : {};

    // Compat trace: accepte _trace dans l'enveloppe si absent dans data.
    if (
      !Object.prototype.hasOwnProperty.call(legacyPayload, '_trace') &&
      envelope._trace != null &&
      typeof envelope._trace === 'object'
    ) {
      legacyPayload._trace = envelope._trace;
    }

    this.sendImmediateAckIfNeeded(
      client,
      meta,
      legacyType,
      legacyPayload,
      receivedAtMs,
    );
    await this.executeLegacyRoomCommand(
      client,
      meta,
      legacyType,
      legacyPayload,
      receivedAtMs,
    );
  }

  private sendImmediateAckIfNeeded(
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    payload: unknown,
    receivedAtMs: number,
  ): void {
    if (!isImmediateAckAction(type)) {
      return;
    }

    const trace = extractTraceMeta(payload, receivedAtMs);
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

  private async executeLegacyRoomCommand(
    client: WebSocket,
    meta: ClientMeta,
    type: string | undefined,
    data: unknown,
    receivedAtMs: number,
  ): Promise<void> {
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
      case 'room.kick':
        await this.handleKickOrBan(meta, data, false);
        break;
      case 'room.ban':
        await this.handleKickOrBan(meta, data, true);
        break;
      case 'room.set-owner':
        await this.handleSetOwner(meta, data);
        break;
      case 'room.set-ambience':
        await this.handleSetAmbience(client, meta, data, receivedAtMs);
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
              typeof this.asRecord(data).clientSentAtMs === 'number'
                ? Number(this.asRecord(data).clientSentAtMs)
                : ((this.asRecord(this.asRecord(data)._trace).sentAtMs as
                    | number
                    | undefined) ?? null),
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
      const messages = this.roomChat.getHistory(roomId);
      if (messages.length === 0) return;
      this.safeSend(client, {
        type: 'room.chat.history',
        roomId,
        payload: { messages },
      });
    } catch {
      // best effort
    }
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

  private async handleChatSend(
    client: WebSocket,
    meta: ClientMeta,
    data: unknown,
  ) {
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
    if (!this.roomChat.tryConsumeCooldown(client, now)) {
      await this.sendError(client, 'Trop rapide. Attendez un instant.');
      return;
    }

    const message = this.roomChat.normalizeMessage(this.asRecord(data).message);
    if (!message) {
      return;
    }

    const chatMessage = this.roomChat.appendMessage(meta.roomId, {
      userId: meta.userId,
      username: meta.username,
      message,
    });

    await this.broadcast(meta.roomId, 'room.chat.message', chatMessage);
  }

  private async handleRoomInfo(client: WebSocket, meta: ClientMeta) {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    const state = await this.roomsService.getRoomPayload(roomId);
    state.room.spectators = listVisibleSpectators(
      this.clients.values(),
      roomId,
    );
    state.room.counts.spectators = state.room.spectators.length;

    const message = buildRoomInfoMessage(state, meta.role);

    this.safeSend(client, {
      type: 'room.info',
      roomId,
      payload: { message },
    });
  }

  private async emitRoomAnnouncementsFromDiff(
    roomId: number,
    previous: RoomSnapshot | undefined,
    next: RoomSnapshot,
  ): Promise<void> {
    const messages = collectRoomAnnouncementMessages(previous, next);
    if (!previous || messages.length > 0) {
      for (const message of messages) {
        await this.broadcastRoomAnnouncement(roomId, message);
      }
      return;
    }

    if (!previous) {
      return;
    }
    await emitRoomAnnouncementDiff({
      roomId,
      previous,
      next,
      announce: (message) => this.broadcastRoomAnnouncement(roomId, message),
    });
  }

  private async broadcastRoomAnnouncement(
    roomId: number,
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
  ): Promise<void> {
    const normalized = (message ?? '').trim();
    if (normalized.length === 0) {
      return;
    }

    await this.broadcastRoomIntent(roomId, {
      type: 'announcement',
      payload: {
        message: normalized,
        priority,
      },
    } satisfies RoomIntent);
  }

  private async handleRoomLeave(client: WebSocket, meta: ClientMeta) {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }
    this.realtimeTracker.setSocketParticipantRoom(client, null);

    const userId = meta.userId;
    const wasParticipant = meta.role === 'participant';

    const { remainingTotalConnections } = removeSocketFromRoomMembership(
      this.rooms,
      this.silentRooms,
      roomId,
      client,
    );
    const userStillConnected = this.hasUserConnections(roomId, userId);

    // Empêche handleDisconnect de rappeler leaveRoom quand on ferme le socket après un leave explicite.
    this.resetClientRoomState(meta);

    await this.sendRoomLeftOrDeleted(client, roomId);

    // Do not block on DB leave logic; allow the client to re-join instantly.
    (async () => {
      try {
        if (wasParticipant) {
          await this.roomsService.leaveRoom(roomId, userId, {
            // Leave explicite : si la table devient vide (plus aucun humain/bot), elle doit disparaître.
            // Garder preserveRoom uniquement quand il reste d'autres connexions (autres joueurs / autre socket).
            preserveRoom: remainingTotalConnections > 0,
            disconnectOnly: false,
          });
        } else {
          if (!userStillConnected) {
            await this.roomsService.transferOwnerIfCurrent(roomId, userId);
          }
          if (remainingTotalConnections === 0) {
            await this.roomsService.leaveRoom(roomId, userId, {
              preserveRoom: false,
              disconnectOnly: false,
            });
          }
        }
      } catch {
        // ignore: best effort
      }

      try {
        if (remainingTotalConnections > 0) {
          await this.sendRoomState(roomId);
        }
      } catch {
        // ignore
      }
    })().catch(() => {});
    // Important: ne pas fermer la socket.
    // Le client doit pouvoir rester connecté et rejoindre une autre table sans relancer l’app.
  }

  private async handleRoomStart(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.start.total',
      async () => {
        const room = await this.roomsService.startRoom(
          meta.roomId,
          meta.userId,
          false,
        );
        await this.broadcast(meta.roomId, 'state-updated', {
          roomId: meta.roomId,
        });
        const updated = await this.tryUpdateRoomPayload(
          meta.roomId,
          (payload) => {
            payload.room.status = room.status;
            payload.room.startedAt = room.startedAt
              ? room.startedAt.toISOString()
              : null;
            const roomWithRuntime =
              room as unknown as RoomWithOptionalRuntimeFields;
            payload.room.runId =
              typeof roomWithRuntime.runId === 'number'
                ? roomWithRuntime.runId
                : null;
            payload.generatedAt = new Date().toISOString();
            return payload;
          },
        );
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
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.reset.total',
      async () => {
        await this.roomsService.resetRoom(meta.roomId, meta.userId, false);

        // Après un reset, tous les connectés "visibles" doivent être considérés comme joueurs.
        // (Les admins en mode silent restent en dehors du roster.)
        await this.promoteConnectedSpectatorsToParticipants(meta.roomId);
        await this.roomsService.invalidateRoomPayloadCache(meta.roomId);

        await this.broadcast(meta.roomId, 'state-updated', {
          roomId: meta.roomId,
        });
        await this.sendRoomState(meta.roomId);
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async promoteConnectedSpectatorsToParticipants(
    roomId: number,
  ): Promise<void> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    let isPrivate = false;
    try {
      const state = await this.roomsService.getRoomPayload(roomId);
      isPrivate = Boolean(state?.room?.isPrivate);
    } catch {
      isPrivate = false;
    }

    const connected = Array.from(this.clients.entries())
      .map(([socket, meta]) => ({ socket, meta }))
      .filter(({ meta }) => meta.roomId === roomId)
      .filter(({ meta }) => meta.silent !== true)
      .filter(({ meta }) => meta.role === 'spectator');

    for (const { socket, meta } of connected) {
      try {
        await this.roomsService.joinRoom(roomId, meta.userId, {
          allowPrivate: isPrivate,
        });
      } catch {
        // best effort: table pleine / restrictions, on laisse spectateur.
        continue;
      }

      meta.role = 'participant';
      this.realtimeTracker.setSocketParticipantRoom(socket, roomId);

      try {
        this.safeSend(socket, {
          type: 'room.role',
          roomId,
          payload: {
            spectator: false,
            message: 'Mode spectateur désactivé.',
          },
        });
      } catch {
        // ignore
      }
    }
  }

  private async handleTogglePrivacy(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
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
        await this.broadcastRoomIntent(meta.roomId, {
          type: 'announcement',
          payload: {
            message: state.room.isPrivate ? 'Table privée.' : 'Table publique.',
          },
        } satisfies RoomIntent);
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async handleBotAdd(
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.add.total',
      async () => {
        const bot = await this.botService.addBot(meta.roomId, meta.userId);
        await this.broadcast(meta.roomId, 'bot.added', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
        });
        const updated = await this.tryUpdateRoomPayload(
          meta.roomId,
          (payload) => addBotToRoomPayload(payload, bot),
        );
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
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.remove.total',
      async () => {
        const row = this.asRecord(payload);
        let botId = Number(row.botId ?? row.id ?? -1);
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
        const updated = await this.tryUpdateRoomPayload(
          meta.roomId,
          (payload) => removeBotFromRoomPayload(payload, bot.id),
        );
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
    payload: unknown,
  ) {
    const row = this.asRecord(payload);
    const roomIdRaw = row.roomId ?? meta.roomId;
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
    const isOwner = state.room.owner?.id === meta.userId;

    const hasSpectatorFlag =
      Object.prototype.hasOwnProperty.call(row, 'spectator');
    const spectatorRaw = row.spectator;
    const spectator = resolveSpectatorIntent(
      spectatorRaw,
      hasSpectatorFlag,
      meta.role,
    );

    if (spectator) {
      // On se retire des participants (sans fermer la connexion) pour ne pas être compté comme joueur.
      // - Public: toujours
      // - Privé: uniquement pour le propriétaire (permet une partie 100% bots)
      if (!state.room.isPrivate || isOwner) {
        await this.roomsService.leaveRoom(meta.roomId, meta.userId, {
          preserveRoom: true,
          preserveOwner: isOwner,
        });
      }
      meta.role = 'spectator';
    } else {
      // Participant: on (re)joint la table pour être compté comme joueur.
      // - Public: join standard
      // - Privé: join autorisé pour le propriétaire (pour revenir de "spectateur owner" -> "joueur")
      if (state.room.isPrivate) {
        if (isOwner) {
          await this.roomsService.joinRoom(meta.roomId, meta.userId, {
            allowPrivate: true,
          });
        } else {
          const isParticipant =
            state.room.players?.some((p) => p?.id === meta.userId) ?? false;
          if (!isParticipant) {
            throw new Error('Table privée: invitation requise');
          }
        }
      } else {
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
        message: buildRoomRoleClientMessage(spectator),
      },
    });
    await this.broadcastRoomIntent(meta.roomId, {
      type: 'announcement',
      payload: {
        message: buildRoomRoleAnnouncementMessage(spectator),
      },
    } satisfies RoomIntent);

    await this.sendRoomState(meta.roomId);
  }

  private async handleRoomCreate(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.create.total',
      async () => {
        const row = this.asRecord(payload);
        const { gameType, name, maxPlayers, isPrivate } =
          parseRoomCreateRequest(row);
        const room = await this.roomsService.createRoom(
          meta.userId,
          gameType,
          name,
          maxPlayers,
          isPrivate,
          false,
        );

        const previousRoomId = meta.roomId;
        const previousRole = meta.role;
        if (previousRoomId !== room.id) {
          removeSocketFromRoomMembership(
            this.rooms,
            this.silentRooms,
            previousRoomId,
            client,
          );
          addSocketToRoomMembership(
            this.rooms,
            this.silentRooms,
            room.id,
            client,
            false,
          );
        }
        meta.roomId = room.id;
        meta.role = 'participant';
        this.realtimeTracker.setSocketParticipantRoom(client, room.id);

        const manifest = await this.catalog.getGame(room.gameType);
        const state = buildCreatedRoomState({
          manifest,
          room,
          userId: meta.userId,
          username: meta.username,
        });
        const message = {
          type: 'room.created',
          roomId: room.id,
          payload: this.withAllowedActionsForClient(state, meta),
        };
        if (previousRoomId > 0 && previousRoomId !== room.id) {
          await this.leavePreviousRoomOnSwitch(
            previousRoomId,
            meta.userId,
            previousRole,
          );
        }
        await this.roomsService.primeRoomPayloadCache(room.id, state);
        this.safeSend(client, message);
        await this.broadcastRoomPayload(room.id, state);
      },
      {
        userId: meta.userId,
        roomId: meta.roomId,
        gameType: this.asRecord(payload).gameType ?? null,
        ...trace,
      },
    );
  }

  private async handleRoomJoin(
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.join.total',
      async () => {
        const row = this.asRecord(payload);
        const { roomId, spectator, silent } = parseRoomJoinRequest(row);

        if (!Number.isFinite(roomId) || roomId <= 0) {
          throw new Error('roomId invalide');
        }

        if (this.roomsService.isBanned(roomId, meta.userId)) {
          await this.sendError(client, 'Banni de cette table.');
          return;
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
        const previousRole = meta.role;
        const previousSilent = meta.silent === true;
        // Rebind socket room membership if:
        // - we switch rooms, or
        // - we stay in the same room but change silent/normal mode
        // (otherwise the socket may end up in the wrong set and not receive updates).
        if (previousRoomId !== roomId || previousSilent !== effectiveSilent) {
          removeSocketFromRoomMembership(
            this.rooms,
            this.silentRooms,
            previousRoomId,
            client,
          );
          addSocketToRoomMembership(
            this.rooms,
            this.silentRooms,
            roomId,
            client,
            effectiveSilent,
          );
        }

        meta.roomId = roomId;
        meta.role = effectiveSpectator ? 'spectator' : 'participant';
        meta.silent = effectiveSilent;
        this.realtimeTracker.setSocketParticipantRoom(
          client,
          meta.role === 'participant' && meta.silent !== true
            ? meta.roomId
            : null,
        );
        if (effectiveSilent) {
          await this.sendRoomStateToClient(client, roomId, {
            includeRealtimePlayers: true,
            includeHiddenSelf: { userId: meta.userId, username: meta.username },
          });
        } else {
          await this.sendRoomState(roomId);
        }

        if (
          Number.isFinite(previousRoomId) &&
          previousRoomId > 0 &&
          previousRoomId !== roomId
        ) {
          await this.leavePreviousRoomOnSwitch(
            previousRoomId,
            meta.userId,
            previousRole,
          );
        }
      },
      {
        userId: meta.userId,
        roomId: this.asRecord(payload).roomId ?? this.asRecord(payload).room ?? null,
        ...trace,
      },
    );
  }

  private async leavePreviousRoomOnSwitch(
    previousRoomId: number,
    userId: number,
    previousRole: ClientRole,
  ): Promise<void> {
    try {
      // Quand un utilisateur rejoint une nouvelle table (même en spectateur),
      // il ne doit plus être considéré comme présent sur l'ancienne.
      // Exigence : si aucun humain restant -> supprimer; sinon transférer le propriétaire.
      if (previousRole === 'spectator') {
        await this.roomsService.transferOwnerIfCurrent(previousRoomId, userId);
      }
      await this.roomsService.leaveRoom(previousRoomId, userId, {
        preserveRoom: false,
        disconnectOnly: false,
      });
    } catch {
      // best effort: ne pas bloquer le join.
    }

    try {
      await this.sendRoomState(previousRoomId);
    } catch {
      // ignore
    }
  }

  private async handleKickOrBan(
    meta: ClientMeta,
    payload: unknown,
    ban: boolean,
  ): Promise<void> {
    const roomId = requireValidRoomId(meta.roomId);
    const targetUserId = requireTargetUserId(this.asRecord(payload), [
      'userId',
      'id',
      'targetUserId',
    ]);
    if (targetUserId === meta.userId) {
      throw new Error('Impossible de se cibler soi-meme');
    }

    const state = requireOwnerActionState(
      await this.roomsService.getRoomPayload(roomId),
      meta.userId,
      'Seul le proprietaire peut effectuer cette action',
    );
    const ownerId = state?.room?.owner?.id ?? 0;
    if (ownerId === targetUserId) {
      throw new Error('Impossible de cibler le proprietaire');
    }

    ensureUserIsOnTable(
      state,
      targetUserId,
      listVisibleSpectators(this.clients.values(), roomId).map(
        (spectator) => spectator?.id ?? 0,
      ),
      this.hasUserConnections(roomId, targetUserId),
    );

    if (ban) {
      this.roomsService.ban(roomId, targetUserId);
    }

    try {
      await this.roomsService.leaveRoom(roomId, targetUserId, {
        preserveRoom: true,
        disconnectOnly: false,
      });
    } catch {
      // ignore
    }

    const message = ban
      ? 'Vous avez ete banni de cette table.'
      : 'Vous avez ete exclu de cette table.';
    await this.forceDisconnectUser(roomId, targetUserId, message);

    await this.sendRoomState(roomId);
  }

  private async handleSetOwner(
    meta: ClientMeta,
    payload: unknown,
  ): Promise<void> {
    const roomId = requireValidRoomId(meta.roomId);
    const newOwnerId = requireTargetUserId(this.asRecord(payload), [
      'userId',
      'id',
      'newOwnerId',
    ]);
    if (newOwnerId === meta.userId) {
      return;
    }

    const state = requireOwnerActionState(
      await this.roomsService.getRoomPayload(roomId),
      meta.userId,
      'Seul le proprietaire peut changer le proprietaire',
    );

    ensureUserIsOnTable(
      state,
      newOwnerId,
      listVisibleSpectators(this.clients.values(), roomId).map(
        (spectator) => spectator?.id ?? 0,
      ),
      this.hasUserConnections(roomId, newOwnerId),
    );

    await this.roomsService.setOwner(roomId, meta.userId, newOwnerId);
    await this.sendRoomState(roomId);
  }

  private async forceDisconnectUser(
    roomId: number,
    userId: number,
    message: string,
  ): Promise<void> {
    const sockets: WebSocket[] = [];
    const a = this.rooms.get(roomId);
    const b = this.silentRooms.get(roomId);
    if (a) sockets.push(...Array.from(a));
    if (b) sockets.push(...Array.from(b));

    for (const socket of sockets) {
      const meta = this.clients.get(socket);
      if (!meta || meta.roomId !== roomId || meta.userId !== userId) {
        continue;
      }

      try {
        this.sendRoomError(socket, roomId, message);
      } catch {
        // ignore
      }

      // IMPORTANT: garder la socket ouverte (cycle de vie de l'app) et simplement
      // la détacher de la table. Le client peut ensuite rejoindre une autre table.
      this.realtimeTracker.setSocketParticipantRoom(socket, null);
      this.realtimeTracker.clearSocket(socket);
      a?.delete(socket);
      b?.delete(socket);

      this.resetClientRoomState(meta);
      await this.sendRoomLeftOrDeleted(socket, roomId);
    }

    if (a && a.size === 0) this.rooms.delete(roomId);
    if (b && b.size === 0) this.silentRooms.delete(roomId);
  }

  private isAdmin(roles?: string[] | null): boolean {
    if (!roles || roles.length === 0) return false;
    return roles.some((r) => {
      const v = (r || '').trim().toLowerCase();
      return v === 'role_admin' || v === 'admin' || v === 'administrator';
    });
  }

  private hasUserConnections(roomId: number, userId: number): boolean {
    return hasUserConnectionsInRoom(
      this.rooms,
      this.silentRooms,
      this.clients,
      roomId,
      userId,
    );
  }

  private async handleSetAmbience(
    client: WebSocket,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ) {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.setAmbience.total',
      async () => {
        const row = this.asRecord(payload);
        const raw = String(row.soundId ?? '').trim();
        const soundId = raw.length ? raw : null;

        const allowed = new Set<string>([
          'TableAmbience1',
          'TableAmbience2',
          'TableAmbience3',
          'TableAmbience4',
          'TableAmbience5',
          'TableAmbience6',
          'TableAmbience7',
          'TableAmbience8',
          'TableAmbience9',
          'TableAmbience10',
          'TableAmbience11',
          'TableAmbience12',
          'TableAmbience13',
          'TableAmbience14',
          'TableAmbience15',
          'TableAmbience16',
          'TableAmbience17',
          'TableAmbience18',
          'TableAmbience19',
          'TableAmbience20',
        ]);

        if (soundId != null && !allowed.has(soundId)) {
          await this.sendError(client, `Ambiance invalide: ${soundId}`);
          return;
        }

        if (soundId != null) {
          const activeAmbiences =
            await this.sounds.listTableAmbiencesWithFilter();
          const selectable = new Set(
            (activeAmbiences.items ?? []).map((a) =>
              String(a?.soundId ?? '')
                .trim()
                .toLowerCase(),
            ),
          );
          if (!selectable.has(soundId.toLowerCase())) {
            await this.sendError(client, `Ambiance indisponible: ${soundId}`);
            return;
          }
        }

        const room = await this.roomsService.requireRoomForOwnerAction(
          meta.roomId,
          meta.userId,
        );
        const roomWithRuntime = room as unknown as RoomWithOptionalRuntimeFields;
        roomWithRuntime.tableAmbienceSoundId = soundId;
        await this.roomsService.saveRoom(room);

        const updated = await this.tryUpdateRoomPayload(meta.roomId, (p) => {
          (p.room as RoomWithOptionalRuntimeFields).tableAmbienceSoundId =
            soundId;
          p.generatedAt = new Date().toISOString();
          return p;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await this.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private buildParticipantLeaveKey(roomId: number, userId: number): string {
    return `${roomId}:${userId}`;
  }

  private clearPendingParticipantLeave(roomId: number, userId: number): void {
    const key = this.buildParticipantLeaveKey(roomId, userId);
    const existing = this.pendingParticipantLeaves.get(key);
    if (!existing) return;
    clearTimeout(existing);
    this.pendingParticipantLeaves.delete(key);
  }

  private scheduleDelayedParticipantLeave(
    roomId: number,
    userId: number,
  ): void {
    const key = this.buildParticipantLeaveKey(roomId, userId);
    if (this.pendingParticipantLeaves.has(key)) return;

    const timeout = setTimeout(() => {
      this.pendingParticipantLeaves.delete(key);
      if (this.hasUserConnections(roomId, userId)) return;

      this.roomsService
        .leaveRoom(roomId, userId, {
          // Après expiration de la grâce, on applique un leave normal.
          // Si la room devient vide, elle est supprimée (sinon conservée).
          preserveRoom: false,
          disconnectOnly: false,
          replaceWithBot: false,
        })
        .then(() => this.sendRoomState(roomId))
        .catch(() => {});
    }, this.participantDisconnectGraceMs);

    this.pendingParticipantLeaves.set(key, timeout);
  }

  private async canSpectate(roomId: number, userId: number): Promise<boolean> {
    try {
      if (this.roomsService.isBanned(roomId, userId)) {
        return false;
      }
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

  private resetClientRoomState(meta: ClientMeta): void {
    meta.role = 'spectator';
    meta.roomId = 0;
    meta.silent = false;
  }

  private async sendRoomLeftOrDeleted(
    socket: WebSocket,
    roomId: number,
  ): Promise<void> {
    try {
      const leftPayload = await this.roomsService.getRoomPayload(roomId);
      this.applySpectators(roomId, leftPayload);
      this.safeSend(socket, {
        type: 'room.left',
        roomId,
        payload: leftPayload,
      });
    } catch {
      this.safeSend(socket, { type: 'room.deleted', roomId });
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value != null && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }
}
