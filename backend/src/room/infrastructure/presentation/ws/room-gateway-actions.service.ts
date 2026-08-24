import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WebSocket } from 'ws';
import { BotApplicationError } from '../../../../bot/public-api';
import { AddBotToRoomService } from '../../../../bot/public-api';
import { GetLastRoomBotService } from '../../../../bot/public-api';
import { RemoveBotFromRoomService } from '../../../../bot/public-api';
import { PerfMetricsService } from '../../../../common/observability/public-api';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import { RoomAdminPolicyService } from '../../../application/services/room-admin-policy.service';
import { RoomAccessService } from '../../../application/services/room-access.service';
import { RoomMembershipFacadeService } from '../../../application/services/room-membership-facade.service';
import { RoomStateService } from '../../../application/services/room-state.service';
import { RoomRealtimeTrackerService } from '../../../application/services/room-realtime-tracker.service';
import { extractTraceMeta } from './room-command.helpers';
import {
  RoomWsCurrentRoomMismatchError,
  RoomWsGameAlreadyStartedError,
  RoomWsInvalidRoomIdError,
  RoomWsNoBotToRemoveError,
  RoomWsOwnerTargetForbiddenError,
  RoomWsPrivateInvitationRequiredError,
  RoomWsSelfTargetForbiddenError,
} from '../../../domain/errors/room-ws.errors';
import { resolveSpectatorIntent } from './room-role.helpers';
import { RoomGatewayPresenter } from './room-gateway.presenter';
import type {
  AuthedClient,
  ClientMeta,
  RoomWithOptionalRuntimeFields,
} from './room-gateway.types';
import type { Server } from 'ws';

function mapBotApplicationError(error: unknown): unknown {
  if (!(error instanceof BotApplicationError)) {
    return error;
  }

  switch (error.code) {
    case 'BOT_ROOM_NOT_FOUND':
    case 'BOT_NOT_FOUND':
      return new NotFoundException(error.message);
    case 'BOT_ROOM_OWNER_REQUIRED':
      return new UnauthorizedException(error.message);
    default:
      return new BadRequestException(error.message);
  }
}

type ActionsContext = {
  server: Server<WebSocket>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  clients: Map<WebSocket, ClientMeta>;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
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
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomAccess: RoomAccessService,
    private readonly roomState: RoomStateService,
    private readonly policy: RoomAdminPolicyService,
    private readonly addBotToRoom: AddBotToRoomService,
    private readonly getLastRoomBot: GetLastRoomBotService,
    private readonly removeBotFromRoom: RemoveBotFromRoomService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly presenter: RoomGatewayPresenter,
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
        await ctx.broadcast(
          meta.roomId,
          'bot.added',
          this.presenter.presentBotAdded(meta.roomId, bot),
        );
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (room) =>
          this.presenter.updateRoomPayloadWithAddedBot(room, bot),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
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
            throw new RoomWsNoBotToRemoveError();
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
        await ctx.broadcast(
          meta.roomId,
          'bot.removed',
          this.presenter.presentBotRemoved(meta.roomId, bot, botId),
        );
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (room) =>
          this.presenter.updateRoomPayloadWithRemovedBot(room, bot.id),
        );
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
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
      throw new RoomWsInvalidRoomIdError();
    }
    if (roomId !== meta.roomId) {
      throw new RoomWsCurrentRoomMismatchError();
    }

    const state = await this.roomState.getRoomPayload(meta.roomId);
    const status = (state?.room?.status || '').toLowerCase();
    if (status === 'started') {
      throw new RoomWsGameAlreadyStartedError();
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
        await this.membership.leaveRoom(meta.roomId, meta.userId, {
          preserveRoom: true,
          preserveOwner: isOwner,
        });
      }
      meta.role = 'spectator';
    } else {
      if (state.room.isPrivate) {
        if (isOwner) {
          await this.membership.joinRoom(meta.roomId, meta.userId, {
            allowPrivate: true,
          });
        } else {
          const isParticipant =
            state.room.players?.some((p) => p?.id === meta.userId) ?? false;
          if (!isParticipant) {
            throw new RoomWsPrivateInvitationRequiredError();
          }
        }
      } else {
        await this.membership.joinRoom(meta.roomId, meta.userId);
      }
      meta.role = 'participant';
    }

    this.realtimeTracker.setSocketParticipantRoom(
      client,
      meta.role === 'participant' ? meta.roomId : null,
    );

    ctx.safeSend(client, this.presenter.presentRoleEvent(meta.roomId, spectator));
    await ctx.broadcastRoomIntent(
      meta.roomId,
      this.presenter.presentRoleAnnouncement(spectator),
    );

    await ctx.sendRoomState(meta.roomId);
  }

  async handleKickOrBan(
    ctx: ActionsContext,
    meta: ClientMeta,
    payload: unknown,
    ban: boolean,
  ): Promise<void> {
    const roomId = this.policy.requireValidRoomId(meta.roomId);
    const targetUserId = this.policy.requireTargetUserId(ctx.asRecord(payload), [
      'userId',
      'id',
      'targetUserId',
    ]);
    if (targetUserId === meta.userId) {
      throw new RoomWsSelfTargetForbiddenError();
    }

    const state = this.policy.requireOwnerActionState(
      await this.roomState.getRoomPayload(roomId),
      meta.userId,
      'Seul le proprietaire peut effectuer cette action',
    );
    const ownerId = state?.room?.owner?.id ?? 0;
    if (ownerId === targetUserId) {
      throw new RoomWsOwnerTargetForbiddenError();
    }

    this.policy.ensureUserIsOnTable({
      state,
      userId: targetUserId,
      spectatorIds: Array.from(ctx.clients.values())
        .filter((clientMeta) => clientMeta.roomId === roomId)
        .filter((clientMeta) => clientMeta.role === 'spectator')
        .map((spectator) => spectator.userId),
      hasUserConnections: ctx.hasUserConnections(roomId, targetUserId),
    });

    if (ban) {
      this.roomState.ban(roomId, targetUserId);
    }

    try {
      await this.membership.leaveRoom(roomId, targetUserId, {
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
    const roomId = this.policy.requireValidRoomId(meta.roomId);
    const newOwnerId = this.policy.requireTargetUserId(ctx.asRecord(payload), [
      'userId',
      'id',
      'newOwnerId',
    ]);
    if (newOwnerId === meta.userId) {
      return;
    }

    const state = this.policy.requireOwnerActionState(
      await this.roomState.getRoomPayload(roomId),
      meta.userId,
      'Seul le proprietaire peut changer le proprietaire',
    );

    this.policy.ensureUserIsOnTable({
      state,
      userId: newOwnerId,
      spectatorIds: Array.from(ctx.clients.values())
        .filter((clientMeta) => clientMeta.roomId === roomId)
        .filter((clientMeta) => clientMeta.role === 'spectator')
        .map((spectator) => spectator.userId),
      hasUserConnections: ctx.hasUserConnections(roomId, newOwnerId),
    });

    await this.roomAccess.setOwner(roomId, meta.userId, newOwnerId);
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

        const room = await this.roomAccess.requireRoomForOwnerAction(
          meta.roomId,
          meta.userId,
        );
        const roomWithRuntime = room as unknown as RoomWithOptionalRuntimeFields;
        roomWithRuntime.tableAmbienceSoundId = soundId;
        await this.roomAccess.saveRoom(room);

        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (roomState) => {
          (roomState.room as RoomWithOptionalRuntimeFields).tableAmbienceSoundId =
            soundId;
          roomState.generatedAt = new Date().toISOString();
          return roomState;
        });
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
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
