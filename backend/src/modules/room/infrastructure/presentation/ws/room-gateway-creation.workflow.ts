import { WebSocket } from 'ws';
import { PerfMetricsService } from '../../../../../platform/observability/public-api';
import { CatalogService } from '../../../../catalog/public-api';
import { RoomMembershipFacadeService } from '../../../application/services/membership/room-membership-facade.service';
import { RoomRealtimeTrackerService } from '../../../application/services/state/room-realtime-tracker.service';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import { buildCreatedRoomState } from './room-created-state.helpers';
import { extractTraceMeta } from './room-command.helpers';
import type { ClientMeta } from './room-gateway.types';
import type { LifecycleContext } from './room-gateway-lifecycle.types';
import {
  addSocketToRoomMembership,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import { parseRoomCreateRequest } from './room-request.helpers';
import { RoomGatewayLifecyclePresenter } from './room-gateway-lifecycle.presenter';

/** Owns the room-creation workflow separately from leave/start/reset lifecycle transitions. */
export class RoomGatewayCreationWorkflow {
  constructor(
    private readonly membership: RoomMembershipFacadeService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly roomState: RoomStateService,
    private readonly presenter: RoomGatewayLifecyclePresenter,
  ) {}

  async handle(
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
        const room = await this.membership.createRoom({
          userId: meta.userId,
          gameType,
          name,
          maxPlayers,
          isPrivate,
          invalidateCache: false,
        });

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
}
