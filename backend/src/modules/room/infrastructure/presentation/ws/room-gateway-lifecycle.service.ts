import { presentationTimestamp } from '../../../../../platform/serialization/public-api';
import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { CatalogService } from '../../../../catalog/public-api';
import { PerfMetricsService } from '../../../../../platform/observability/public-api';
import { bestEffort } from '../../../../../platform/observability/public-api';
import { RoomJoinPolicyService } from '../../../application/services/membership/room-join-policy.service';
import { RoomLifecycleFacadeService } from '../../../application/services/lifecycle/room-lifecycle-facade.service';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/state/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { extractTraceMeta } from './room-command.helpers';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import type { AuthedClient, ClientMeta } from './room-gateway.types';
import type { LifecycleContext } from './room-gateway-lifecycle.types';
import { removeSocketFromRoomMembership } from './room-socket-membership.helpers';
import { RoomGatewayJoinWorkflow } from './room-gateway-join.workflow';
import { RoomGatewayCreationWorkflow } from './room-gateway-creation.workflow';

@Injectable()
export class RoomGatewayLifecycleService {
  private readonly joins: RoomGatewayJoinWorkflow;
  private readonly creation: RoomGatewayCreationWorkflow;

  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly lifecycle: RoomLifecycleFacadeService,
    private readonly roomState: RoomStateService,
    catalog: CatalogService,
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
    this.creation = new RoomGatewayCreationWorkflow(
      membership,
      catalog,
      perf,
      realtimeTracker,
      roomState,
      presenter,
    );
  }

  async handleRoomLeave(
    ctx: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
  ): Promise<void> {
    const roomId = meta.roomId;
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
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

    await bestEffort(
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
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (state) => {
          state.room.status = room.status;
          state.room.startedAt = room.startedAt
            ? room.startedAt.toISOString()
            : null;
          state.room.runId = room.runId;
          state.generatedAt = presentationTimestamp();
          return state;
        });
        if (!updated) {
          await this.roomState.invalidateRoomPayloadCache(meta.roomId);
          await ctx.sendRoomState(meta.roomId);
        }
        // A state-updated event makes clients enter the game immediately, so
        // it must never overtake the cache transition to the started room.
        await ctx.broadcast(
          meta.roomId,
          'state-updated',
          this.presenter.presentStateUpdated(meta.roomId),
        );
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
            roomState.generatedAt = presentationTimestamp();
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
    return this.creation.handle(ctx, client, meta, payload, receivedAtMs);
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
