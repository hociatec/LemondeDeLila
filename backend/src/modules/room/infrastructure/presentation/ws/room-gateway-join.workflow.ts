import type { WebSocket } from 'ws';
import { RoomWsPrivateInvitationRequiredError } from '../../../domain/errors/room-ws.errors';
import { RoomJoinPolicyService } from '../../../application/services/membership/room-join-policy.service';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/state/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';
import type { ClientMeta } from './room-gateway.types';
import type {
  JoinResolution,
  LifecycleContext,
} from './room-gateway-lifecycle.types';
import {
  addSocketToRoomMembership,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import { parseRoomJoinRequest } from './room-request.helpers';

/** Resolves access policy and applies realtime membership for room joins. */
export class RoomGatewayJoinWorkflow {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly roomState: RoomStateService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly joinPolicy: RoomJoinPolicyService,
    private readonly presenter: RoomGatewayLifecyclePresenter,
  ) {}

  async join(
    context: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ): Promise<void> {
    const resolution = await this.resolve(context, client, meta, payload);
    if (resolution) await this.apply(context, client, meta, resolution);
  }

  async promoteSpectators(
    context: LifecycleContext,
    roomId: number,
  ): Promise<void> {
    if (!Number.isFinite(roomId) || roomId <= 0) return;
    const isPrivate = await this.roomState
      .getRoomPayload(roomId)
      .then((state) => Boolean(state.room.isPrivate))
      .catch(() => false);
    const connected = Array.from(context.clients.entries())
      .map(([socket, meta]) => ({ socket, meta }))
      .filter(
        ({ meta }) =>
          meta.roomId === roomId &&
          meta.silent !== true &&
          meta.role === 'spectator',
      );
    await Promise.all(
      connected.map(async ({ socket, meta }) => {
        try {
          await this.membership.joinRoom(roomId, meta.userId, {
            allowPrivate: isPrivate,
          });
        } catch {
          return;
        }
        meta.role = 'participant';
        this.realtimeTracker.setSocketParticipantRoom(socket, roomId);
        try {
          context.safeSend(socket, this.presenter.presentRolePromoted(roomId));
        } catch {
          // A closed socket does not invalidate the persisted promotion.
        }
      }),
    );
  }

  private async resolve(
    context: LifecycleContext,
    client: WebSocket,
    meta: ClientMeta,
    payload: unknown,
  ): Promise<JoinResolution | null> {
    const request = parseRoomJoinRequest(context.asRecord(payload));
    const roomId = this.joinPolicy.requireValidRoomId(request.roomId);
    if (
      this.joinPolicy.isBanned(this.roomState.isBanned(roomId, meta.userId))
    ) {
      await context.sendError(client, this.presenter.presentJoinBannedError());
      return null;
    }
    const silent = Boolean(request.silent);
    if (silent && !this.joinPolicy.canUseSilentMode(meta.isAdmin || false)) {
      client.close(4003, this.presenter.presentSilentModeForbiddenReason());
      return null;
    }
    let spectator = request.spectator || silent;
    if (
      this.joinPolicy.shouldValidateSpectatorAccess(spectator, silent) &&
      !(await context.canSpectate(roomId, meta.userId))
    ) {
      client.close(4003, this.presenter.presentSpectatorForbiddenReason());
      return null;
    }
    if (!spectator) {
      spectator = await this.joinParticipantOrFallback(
        context,
        roomId,
        meta.userId,
      );
    }
    return { roomId, silent, spectator };
  }

  private async joinParticipantOrFallback(
    context: LifecycleContext,
    roomId: number,
    userId: number,
  ): Promise<boolean> {
    try {
      await this.membership.joinRoom(roomId, userId);
      return false;
    } catch (error) {
      const state = await this.roomState.getRoomPayload(roomId);
      if (!this.joinPolicy.shouldFallbackToSpectator(state, userId))
        throw error;
      if (!(await context.canSpectate(roomId, userId))) {
        throw new RoomWsPrivateInvitationRequiredError();
      }
      return true;
    }
  }

  private async apply(
    context: LifecycleContext,
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
        context.rooms,
        context.silentRooms,
        previousRoomId,
        client,
      );
      addSocketToRoomMembership(
        context.rooms,
        context.silentRooms,
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
      await context.sendRoomStateToClient(client, resolution.roomId, {
        includeRealtimePlayers: true,
        includeHiddenSelf: { userId: meta.userId, username: meta.username },
      });
    } else await context.sendRoomState(resolution.roomId);
    if (previousRoomId > 0 && previousRoomId !== resolution.roomId) {
      await context.leavePreviousRoomOnSwitch(
        previousRoomId,
        meta.userId,
        previousRole,
      );
    }
  }
}
