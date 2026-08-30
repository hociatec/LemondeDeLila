import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { CatalogService } from '../../../../catalog/public-api';
import { PerfMetricsService } from '../../../../../platform/observability/public-api';
import { bestEffort } from '@shared/utils/public-api';
import { RoomJoinPolicyService } from '../../../application/services/membership/room-join-policy.service';
import { RoomLifecycleFacadeService } from '../../../application/services/lifecycle/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/state/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { buildCreatedRoomState } from './room-created-state.helpers';
import { extractTraceMeta } from './room-command.helpers';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import type { AuthedClient, ClientMeta } from './room-gateway.types';
import type { LifecycleContext } from './room-gateway-lifecycle.types';
import {
  addSocketToRoomMembership,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import { parseRoomCreateRequest } from './room-request.helpers';
import { RoomGatewayJoinWorkflow } from './room-gateway-join.workflow';

@Injectable()
export class RoomGatewayLifecycleService {
  private readonly joins: RoomGatewayJoinWorkflow;

  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly roomState: RoomStateService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    joinPolicy: RoomJoinPolicyService,
    private readonly presenter: RoomGatewayLifecyclePresenter,
  ) {
    this.joins = new RoomGatewayJoinWorkflow(
      membership,
      roomState,
      realtimeTracker,
      joinPolicy,
      presenter,
    );
  }

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

    void bestEffort(
      (async () => {
        if (wasParticipant) {
          await bestEffort(
            this.membership.leaveRoom(roomId, userId, {
              preserveRoom: remainingTotalConnections > 0,
              disconnectOnly: false,
            }),
            `sortie participant room=${roomId} user=${userId}`,
          );
        } else {
          if (!userStillConnected) {
            await bestEffort(
              this.membership.transferOwnerIfCurrent(roomId, userId),
              `transfert propriétaire room=${roomId} user=${userId}`,
            );
          }
          if (remainingTotalConnections === 0) {
            await bestEffort(
              this.membership.leaveRoom(roomId, userId, {
                preserveRoom: false,
                disconnectOnly: false,
              }),
              `sortie spectateur room=${roomId} user=${userId}`,
            );
          }
        }
        if (remainingTotalConnections > 0) {
          await bestEffort(
            ctx.sendRoomState(roomId),
            `rafraîchissement après sortie room=${roomId}`,
          );
        }
      })(),
      'cycle de connexion room',
    );
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
          state.room.runId = room.runId;
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
        await this.joins.promoteSpectators(ctx, meta.roomId);
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
    await this.joins.promoteSpectators(ctx, roomId);
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
        await this.joins.join(ctx, client, meta, payload);
      },
      {
        userId: meta.userId,
        roomId:
          ctx.asRecord(payload).roomId ?? ctx.asRecord(payload).room ?? null,
        ...trace,
      },
    );
  }
}
