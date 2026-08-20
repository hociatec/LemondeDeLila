import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { AddBotToRoomService } from '../../bot/application/use-cases/bot-rooms/add-bot-to-room.service';
import { GetLastRoomBotService } from '../../bot/application/use-cases/bot-rooms/get-last-room-bot.service';
import { RemoveBotFromRoomService } from '../../bot/application/use-cases/bot-rooms/remove-bot-from-room.service';
import { mapBotApplicationError } from '../../bot/infrastructure/errors/bot-error-http.mapper';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import type { RoomIntent } from '../dto/room-intent.dto';
import type { RoomPayload } from '../dto/room-response.dto';
import { RoomService } from '../services/room.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import {
  addBotToRoomPayload,
  removeBotFromRoomPayload,
} from './room-bot-payload.helpers';
import { extractTraceMeta } from './room-command.helpers';
import {
  ensureUserIsOnTable,
  requireOwnerActionState,
  requireTargetUserId,
  requireValidRoomId,
} from './room-admin.helpers';
import {
  buildRoomRoleAnnouncementMessage,
  buildRoomRoleClientMessage,
  resolveSpectatorIntent,
} from './room-role.helpers';
import type {
  AuthedClient,
  ClientMeta,
  RoomWithOptionalRuntimeFields,
} from './room-gateway.types';
import type { Server } from 'ws';

type ActionsContext = {
  server: Server<WebSocket>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  clients: Map<WebSocket, ClientMeta>;
  broadcast: (roomId: number, type: string, payload: any) => Promise<void>;
  broadcastRoomIntent: (roomId: number, payload: RoomIntent) => Promise<void>;
  sendRoomState: (roomId: number) => Promise<void>;
  tryUpdateRoomPayload: (
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ) => Promise<RoomPayload | null>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  sendRoomError: (client: WebSocket, roomId: number, message: string) => void;
  sendRoomLeftOrDeleted: (socket: WebSocket, roomId: number) => Promise<void>;
  hasUserConnections: (roomId: number, userId: number) => boolean;
  resetClientRoomState: (meta: ClientMeta) => void;
  asRecord: (value: unknown) => Record<string, unknown>;
};

@Injectable()
export class RoomGatewayActionsService {
  constructor(
    private readonly roomsService: RoomService,
    private readonly addBotToRoom: AddBotToRoomService,
    private readonly getLastRoomBot: GetLastRoomBotService,
    private readonly removeBotFromRoom: RemoveBotFromRoomService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
  ) {}

  async handleBotAdd(
    ctx: ActionsContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.add.total',
      async () => {
        let bot;
        try {
          bot = await this.addBotToRoom.execute(meta.roomId, meta.userId);
        } catch (error) {
          throw mapBotApplicationError(error);
        }
        await ctx.broadcast(meta.roomId, 'bot.added', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
        });
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (room) =>
          addBotToRoomPayload(room, bot),
        );
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await ctx.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async handleBotRemove(
    ctx: ActionsContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.bot.remove.total',
      async () => {
        const row = ctx.asRecord(payload);
        let botId = Number(row.botId ?? row.id ?? -1);
        if (!Number.isFinite(botId) || botId <= 0) {
          const last = await this.getLastRoomBot.execute(meta.roomId);
          if (!last?.id) {
            throw new Error('Aucun bot a retirer');
          }
          botId = Number(last.id);
        }
        let bot;
        try {
          bot = await this.removeBotFromRoom.execute(
            meta.roomId,
            meta.userId,
            botId,
          );
        } catch (error) {
          throw mapBotApplicationError(error);
        }
        await ctx.broadcast(meta.roomId, 'bot.removed', {
          roomId: meta.roomId,
          bot: { id: bot.id, name: bot.name },
          botId,
        });
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (room) =>
          removeBotFromRoomPayload(room, bot.id),
        );
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await ctx.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async handleSetRole(
    ctx: ActionsContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ): Promise<void> {
    const row = ctx.asRecord(payload);
    const roomIdRaw = row.roomId ?? meta.roomId;
    const roomId = Number(roomIdRaw);
    if (!Number.isFinite(roomId) || roomId <= 0) {
      throw new Error('roomId invalide');
    }
    if (roomId !== meta.roomId) {
      throw new Error('roomId ne correspond pas a la table courante');
    }

    const state = await this.roomsService.getRoomPayload(meta.roomId);
    const status = (state?.room?.status || '').toLowerCase();
    if (status === 'started') {
      throw new Error('Partie déjà commencée');
    }
    const isOwner = state.room.owner?.id === meta.userId;

    const hasSpectatorFlag = Object.prototype.hasOwnProperty.call(
      row,
      'spectator',
    );
    const spectator = resolveSpectatorIntent(
      row.spectator,
      hasSpectatorFlag,
      meta.role,
    );

    if (spectator) {
      if (!state.room.isPrivate || isOwner) {
        await this.roomsService.leaveRoom(meta.roomId, meta.userId, {
          preserveRoom: true,
          preserveOwner: isOwner,
        });
      }
      meta.role = 'spectator';
    } else {
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

    ctx.safeSend(client, {
      type: 'room.role',
      roomId: meta.roomId,
      payload: {
        spectator,
        message: buildRoomRoleClientMessage(spectator),
      },
    });
    await ctx.broadcastRoomIntent(meta.roomId, {
      type: 'announcement',
      payload: {
        message: buildRoomRoleAnnouncementMessage(spectator),
      },
    } satisfies RoomIntent);

    await ctx.sendRoomState(meta.roomId);
  }

  async handleKickOrBan(
    ctx: ActionsContext,
    meta: ClientMeta,
    payload: unknown,
    ban: boolean,
  ): Promise<void> {
    const roomId = requireValidRoomId(meta.roomId);
    const targetUserId = requireTargetUserId(ctx.asRecord(payload), [
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
      Array.from(ctx.clients.values())
        .filter((clientMeta) => clientMeta.roomId === roomId)
        .filter((clientMeta) => clientMeta.role === 'spectator')
        .map((spectator) => spectator.userId),
      ctx.hasUserConnections(roomId, targetUserId),
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
    await this.forceDisconnectUser(ctx, roomId, targetUserId, message);
    await ctx.sendRoomState(roomId);
  }

  async handleSetOwner(
    ctx: ActionsContext,
    meta: ClientMeta,
    payload: unknown,
  ): Promise<void> {
    const roomId = requireValidRoomId(meta.roomId);
    const newOwnerId = requireTargetUserId(ctx.asRecord(payload), [
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
      Array.from(ctx.clients.values())
        .filter((clientMeta) => clientMeta.roomId === roomId)
        .filter((clientMeta) => clientMeta.role === 'spectator')
        .map((spectator) => spectator.userId),
      ctx.hasUserConnections(roomId, newOwnerId),
    );

    await this.roomsService.setOwner(roomId, meta.userId, newOwnerId);
    await ctx.sendRoomState(roomId);
  }

  async handleSetAmbience(
    ctx: ActionsContext,
    client: WebSocket,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
    listTableAmbiencesWithFilter: () => Promise<{
      items?: Array<{ soundId?: string | null }>;
    }>,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.setAmbience.total',
      async () => {
        const row = ctx.asRecord(payload);
        const raw =
          typeof row.soundId === 'string'
            ? row.soundId.trim()
            : typeof row.soundId === 'number' ||
                typeof row.soundId === 'boolean'
              ? String(row.soundId)
              : '';
        const soundId = raw.length ? raw : null;

        const allowed = new Set<string>(
          Array.from({ length: 20 }, (_, index) => `TableAmbience${index + 1}`),
        );

        if (soundId != null && !allowed.has(soundId)) {
          await ctx.sendError(client, `Ambiance invalide: ${soundId}`);
          return;
        }

        if (soundId != null) {
          const activeAmbiences = await listTableAmbiencesWithFilter();
          const selectable = new Set(
            (activeAmbiences.items ?? []).map((item) =>
              String(item?.soundId ?? '')
                .trim()
                .toLowerCase(),
            ),
          );
          if (!selectable.has(soundId.toLowerCase())) {
            await ctx.sendError(client, `Ambiance indisponible: ${soundId}`);
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

        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (roomState) => {
          (roomState.room as RoomWithOptionalRuntimeFields).tableAmbienceSoundId =
            soundId;
          roomState.generatedAt = new Date().toISOString();
          return roomState;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          await ctx.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  private async forceDisconnectUser(
    ctx: ActionsContext,
    roomId: number,
    userId: number,
    message: string,
  ): Promise<void> {
    const sockets: WebSocket[] = [];
    const visible = ctx.rooms.get(roomId);
    const silent = ctx.silentRooms.get(roomId);
    if (visible) sockets.push(...Array.from(visible));
    if (silent) sockets.push(...Array.from(silent));

    for (const socket of sockets) {
      const meta = ctx.clients.get(socket);
      if (!meta || meta.roomId !== roomId || meta.userId !== userId) {
        continue;
      }

      try {
        ctx.sendRoomError(socket, roomId, message);
      } catch {
        // ignore
      }

      this.realtimeTracker.setSocketParticipantRoom(socket, null);
      this.realtimeTracker.clearSocket(socket);
      visible?.delete(socket);
      silent?.delete(socket);

      ctx.resetClientRoomState(meta);
      await ctx.sendRoomLeftOrDeleted(socket, roomId);
    }

    if (visible && visible.size === 0) ctx.rooms.delete(roomId);
    if (silent && silent.size === 0) ctx.silentRooms.delete(roomId);
  }
}
