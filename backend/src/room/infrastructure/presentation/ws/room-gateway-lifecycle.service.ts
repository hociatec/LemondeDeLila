import { Injectable } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { CatalogService } from '../../../../catalog/public-api';
import { PerfMetricsService } from '../../../../common/observability/public-api';
import { RoomWsPrivateInvitationRequiredError } from '../../../domain/errors/room-ws.errors';
import type { RoomPayload } from '../../../public-api';
import { RoomJoinPolicyService } from '../../../application/services/room-join-policy.service';
import { RoomLifecycleFacadeService } from '../../../application/services/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../../application/services/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/room-state.service';
import { buildCreatedRoomState } from './room-created-state.helpers';
import { extractTraceMeta } from './room-command.helpers';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import type {
  AuthedClient,
  ClientMeta,
  ClientRole,
  RoomWithOptionalRuntimeFields,
} from './room-gateway.types';
import {
  addSocketToRoomMembership,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import {
  parseRoomCreateRequest,
  parseRoomJoinRequest,
} from './room-request.helpers';

type LifecycleContext = {
  server: Server<WebSocket>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  clients: Map<WebSocket, ClientMeta>;
  sendRoomLeftOrDeleted: (client: WebSocket, roomId: number) => Promise<void>;
  resetClientRoomState: (meta: ClientMeta) => void;
  hasUserConnections: (roomId: number, userId: number) => boolean;
  sendRoomState: (roomId: number) => Promise<void>;
  sendRoomStateToClient: (
    client: WebSocket,
    roomId: number,
    options?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ) => Promise<void>;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
  broadcastRoomIntent: (roomId: number, payload: RoomIntent) => Promise<void>;
  broadcastRoomPayload: (roomId: number, payload: RoomPayload) => Promise<void>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  tryUpdateRoomPayload: (
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ) => Promise<boolean>;
  canSpectate: (roomId: number, userId: number) => Promise<boolean>;
  leavePreviousRoomOnSwitch: (
    previousRoomId: number,
    userId: number,
    previousRole: ClientRole,
  ) => Promise<void>;
  withAllowedActionsForClient: (
    payload: RoomPayload,
    meta: ClientMeta,
  ) => RoomPayload;
  asRecord: (value: unknown) => Record<string, unknown>;
};

type JoinResolution = {
  roomId: number;
  silent: boolean;
  spectator: boolean;
};

@Injectable()
export class RoomGatewayLifecycleService {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly roomState: RoomStateService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly joinPolicy: RoomJoinPolicyService,
    private readonly presenter: RoomGatewayLifecyclePresenter,
  ) {}

  async handleRoomLeave(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    const roomId = meta.roomId;
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }
    this.realtimeTracker.setSocketParticipantRoom(client, null);

    const userId = meta.userId;
    const wasParticipant = meta.role === 'participant';

    const { remainingTotalConnections } = removeSocketFromRoomMembership(
      ctx.rooms,
      ctx.silentRooms,
      roomId,
      client,
    );
    const userStillConnected = ctx.hasUserConnections(roomId, userId);

    ctx.resetClientRoomState(meta);

    await ctx.sendRoomLeftOrDeleted(client, roomId);

    (async () => {
      try {
        if (wasParticipant) {
          await this.membership.leaveRoom(roomId, userId, {
            preserveRoom: remainingTotalConnections > 0,
            disconnectOnly: false,
          });
        } else {
          if (!userStillConnected) {
            await this.membership.transferOwnerIfCurrent(roomId, userId);
          }
          if (remainingTotalConnections === 0) {
            await this.membership.leaveRoom(roomId, userId, {
              preserveRoom: false,
              disconnectOnly: false,
            });
          }
        }
      } catch {
        // ignore
      }

      try {
        if (remainingTotalConnections > 0) {
          await ctx.sendRoomState(roomId);
        }
      } catch {
        // ignore
      }
    })().catch(() => {});
  }

  async handleRoomStart(
    ctx: LifecycleContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.start.total',
      async () => {
        const room = await this.lifecycle.startRoom(
          meta.roomId,
          meta.userId,
          false,
        );
        await ctx.broadcast(
          meta.roomId,
          'state-updated',
          this.presenter.presentStateUpdated(meta.roomId),
        );
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (state) => {
          state.room.status = room.status;
          state.room.startedAt = room.startedAt
            ? room.startedAt.toISOString()
            : null;
          const roomWithRuntime =
            room as unknown as RoomWithOptionalRuntimeFields;
          state.room.runId =
            typeof roomWithRuntime.runId === 'number'
              ? roomWithRuntime.runId
              : null;
          state.generatedAt = new Date().toISOString();
          return state;
        });
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await ctx.sendRoomState(meta.roomId);
        }
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async handleRoomReset(
    ctx: LifecycleContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.reset.total',
      async () => {
        await this.lifecycle.resetRoom(meta.roomId, meta.userId, false);
        await this.promoteConnectedSpectatorsToParticipants(ctx, meta.roomId);
        await this.roomState.invalidateRoomPayloadCache(meta.roomId);

        await ctx.broadcast(
          meta.roomId,
          'state-updated',
          this.presenter.presentStateUpdated(meta.roomId),
        );
        await ctx.sendRoomState(meta.roomId);
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async promoteConnectedSpectatorsToParticipantsForRoom(
    ctx: LifecycleContext,
    roomId: number,
  ): Promise<void> {
    await this.promoteConnectedSpectatorsToParticipants(ctx, roomId);
  }

  async handleTogglePrivacy(
    ctx: LifecycleContext,
    meta: AuthedClient,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.togglePrivacy.total',
      async () => {
        const room = await this.lifecycle.togglePrivacy(
          meta.roomId,
          meta.userId,
          false,
        );
        let state = await this.roomState.updateRoomPayloadCache(
          meta.roomId,
          (roomState) => {
            roomState.room.isPrivate = room.isPrivate;
            roomState.generatedAt = new Date().toISOString();
            return roomState;
          },
        );
        if (!state) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          state = await this.roomState.getRoomPayload(meta.roomId);
        }
        await ctx.broadcast(
          meta.roomId,
          'room.privacy',
          this.presenter.presentPrivacyUpdated(state),
        );
        await ctx.broadcastRoomIntent(
          meta.roomId,
          this.presenter.presentPrivacyAnnouncement(state),
        );
      },
      { roomId: meta.roomId, userId: meta.userId, ...trace },
    );
  }

  async handleRoomCreate(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.create.total',
      async () => {
        const row = ctx.asRecord(payload);
        const { gameType, name, maxPlayers, isPrivate } =
          parseRoomCreateRequest(row);
        const room = await this.membership.createRoom(
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
            ctx.rooms,
            ctx.silentRooms,
            previousRoomId,
            client,
          );
          addSocketToRoomMembership(
            ctx.rooms,
            ctx.silentRooms,
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
        if (previousRoomId > 0 && previousRoomId !== room.id) {
          await ctx.leavePreviousRoomOnSwitch(
            previousRoomId,
            meta.userId,
            previousRole,
          );
        }
        await this.roomState.primeRoomPayloadCache(room.id, state);
        ctx.safeSend(
          client,
          this.presenter.presentCreatedRoom(
            room.id,
            state,
            meta,
            ctx.withAllowedActionsForClient,
          ),
        );
        await ctx.broadcastRoomPayload(room.id, state);
      },
      {
        userId: meta.userId,
        roomId: meta.roomId,
        gameType: ctx.asRecord(payload).gameType ?? null,
        ...trace,
      },
    );
  }

  async handleRoomJoin(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
    receivedAtMs: number,
  ): Promise<void> {
    const trace = extractTraceMeta(payload, receivedAtMs);
    await this.perf.measure(
      'ws.room.join.total',
      async () => {
        const resolution = await this.resolveJoin(ctx, client, meta, payload);
        if (resolution) {
          await this.applyJoin(ctx, client, meta, resolution);
        }
      },
      {
        userId: meta.userId,
        roomId:
          ctx.asRecord(payload).roomId ?? ctx.asRecord(payload).room ?? null,
        ...trace,
      },
    );
  }

  private async resolveJoin(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ): Promise<JoinResolution | null> {
    const request = parseRoomJoinRequest(ctx.asRecord(payload));
    const roomId = this.joinPolicy.requireValidRoomId(request.roomId);
    if (
      this.joinPolicy.isBanned(this.roomState.isBanned(roomId, meta.userId))
    ) {
      await ctx.sendError(client, this.presenter.presentJoinBannedError());
      return null;
    }
    const silent = Boolean(request.silent);
    if (silent && !this.joinPolicy.canUseSilentMode(meta.isAdmin || false)) {
      client.close(4003, this.presenter.presentSilentModeForbiddenReason());
      return null;
    }
    let spectator = request.spectator || silent;
    if (this.joinPolicy.shouldValidateSpectatorAccess(spectator, silent)) {
      if (!(await ctx.canSpectate(roomId, meta.userId))) {
        client.close(4003, this.presenter.presentSpectatorForbiddenReason());
        return null;
      }
    }
    if (!spectator) {
      try {
        await this.membership.joinRoom(roomId, meta.userId);
      } catch (error) {
        const state = await this.roomState.getRoomPayload(roomId);
        if (!this.joinPolicy.shouldFallbackToSpectator(state, meta.userId)) {
          throw error;
        }
        if (!(await ctx.canSpectate(roomId, meta.userId))) {
          throw new RoomWsPrivateInvitationRequiredError();
        }
        spectator = true;
      }
    }
    return { roomId, silent, spectator };
  }

  private async applyJoin(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    resolution: JoinResolution,
  ): Promise<void> {
    const previousRoomId = meta.roomId;
    const previousRole = meta.role;
    if (
      previousRoomId !== resolution.roomId ||
      (meta.silent === true) !== resolution.silent
    ) {
      removeSocketFromRoomMembership(
        ctx.rooms,
        ctx.silentRooms,
        previousRoomId,
        client,
      );
      addSocketToRoomMembership(
        ctx.rooms,
        ctx.silentRooms,
        resolution.roomId,
        client,
        resolution.silent,
      );
    }
    meta.roomId = resolution.roomId;
    meta.role = resolution.spectator ? 'spectator' : 'participant';
    meta.silent = resolution.silent;
    this.realtimeTracker.setSocketParticipantRoom(
      client,
      meta.role === 'participant' && !meta.silent ? meta.roomId : null,
    );
    if (resolution.silent) {
      await ctx.sendRoomStateToClient(client, resolution.roomId, {
        includeRealtimePlayers: true,
        includeHiddenSelf: { userId: meta.userId, username: meta.username },
      });
    } else {
      await ctx.sendRoomState(resolution.roomId);
    }
    if (previousRoomId > 0 && previousRoomId !== resolution.roomId) {
      await ctx.leavePreviousRoomOnSwitch(
        previousRoomId,
        meta.userId,
        previousRole,
      );
    }
  }

  private async promoteConnectedSpectatorsToParticipants(
    ctx: LifecycleContext,
    roomId: number,
  ): Promise<void> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    let isPrivate = false;
    try {
      const state = await this.roomState.getRoomPayload(roomId);
      isPrivate = Boolean(state?.room?.isPrivate);
    } catch {
      isPrivate = false;
    }

    const connected = Array.from(ctx.clients.entries())
      .map(([socket, meta]) => ({ socket, meta }))
      .filter(({ meta }) => meta.roomId === roomId)
      .filter(({ meta }) => meta.silent !== true)
      .filter(({ meta }) => meta.role === 'spectator');

    for (const { socket, meta } of connected) {
      try {
        await this.membership.joinRoom(roomId, meta.userId, {
          allowPrivate: isPrivate,
        });
      } catch {
        continue;
      }

      meta.role = 'participant';
      this.realtimeTracker.setSocketParticipantRoom(socket, roomId);

      try {
        ctx.safeSend(socket, this.presenter.presentRolePromoted(roomId));
      } catch {
        // ignore
      }
    }
  }
}
