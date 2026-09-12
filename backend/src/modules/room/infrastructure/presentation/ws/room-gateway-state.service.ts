import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { getErrorMessage } from '@shared/utils/public-api';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import { RoomStateService } from '../../../application/services/state/room-state.service';
import {
  buildRoomSnapshot,
  type RoomSnapshot,
} from './room-announcement.helpers';
import type { RoomIntent } from './dto/room-intent.ws.dto';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
import { RoomGatewayAnnouncements } from './room-gateway.announcements';
import type { ClientMeta } from './room-gateway.types';
import {
  projectRoomRoster,
  type RoomRosterOptions,
} from './room-roster-projection';
import { RoomPayloadBroadcaster } from './room-payload.broadcaster';

type StateContext = {
  clients: Map<WebSocket, ClientMeta>;
  rooms: Map<number, Set<WebSocket>>;
  silentRooms: Map<number, Set<WebSocket>>;
  lastRoomStatusByRoomId: Map<number, string>;
  lastRoomSnapshotByRoomId: Map<number, RoomSnapshot>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  broadcast: (roomId: number, type: string, payload: unknown) => Promise<void>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  promoteConnectedSpectatorsToParticipantsForRoom: (
    roomId: number,
  ) => Promise<void>;
  nextRoomRealtimeVersion: (roomId: number) => {
    streamId: string;
    sequence: number;
    snapshot: true;
  };
  currentRoomRealtimeVersion: (roomId: number) => {
    streamId: string;
    sequence: number;
    snapshot: true;
  };
};

@Injectable()
export class RoomGatewayStateService {
  private static readonly MAX_TRACKED_ROOMS = 10_000;
  private readonly announcements: RoomGatewayAnnouncements;
  private readonly publicationQueues = new Map<number, Promise<void>>();

  constructor(
    private readonly roomState: RoomStateService,
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly presenter: RoomGatewayStatePresenter,
    private readonly broadcaster: RoomPayloadBroadcaster,
  ) {
    this.announcements = new RoomGatewayAnnouncements(presenter);
  }

  async sendRoomState(ctx: StateContext, roomId: number): Promise<void> {
    return this.enqueuePublication(roomId, () =>
      this.publishRoomState(ctx, roomId),
    );
  }

  private async publishRoomState(
    ctx: StateContext,
    roomId: number,
  ): Promise<void> {
    try {
      let payload = await this.roomState.getRoomPayload(roomId);

      const previousStatus = (ctx.lastRoomStatusByRoomId.get(roomId) ?? '')
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
        await ctx.promoteConnectedSpectatorsToParticipantsForRoom(roomId);
        await this.roomState.invalidateRoomPayloadCache(roomId);
        payload = await this.roomState.getRoomPayload(roomId);
      }
      this.ensureRoomTrackingCapacity(ctx, roomId);
      ctx.lastRoomStatusByRoomId.set(roomId, nextStatus);

      payload = projectRoomRoster(payload, ctx.clients.values(), roomId);
      await this.broadcaster.broadcast(
        ctx,
        roomId,
        payload,
        ctx.nextRoomRealtimeVersion(roomId),
      );
    } catch {
      // la table a peut-etre ete supprimee, on ignore
    }
  }

  withAllowedActionsForClient(
    payload: RoomPayload,
    meta: ClientMeta,
  ): RoomPayload {
    return {
      ...payload,
      room: {
        ...payload.room,
        allowedActions: this.clientPolicy.listAllowedActions(
          payload,
          meta.userId,
        ),
      },
    };
  }

  async broadcastRoomIntent(
    ctx: StateContext,
    roomId: number,
    intent: RoomIntent,
  ): Promise<void> {
    await this.announcements.broadcastIntent(ctx, roomId, intent);
  }

  async broadcastRoomPayload(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    return this.enqueuePublication(roomId, () =>
      this.publishRoomPayload(ctx, roomId, payload),
    );
  }

  private async publishRoomPayload(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const previousStatus = (ctx.lastRoomStatusByRoomId.get(roomId) ?? '')
      .toLowerCase()
      .trim();
    const nextStatus = String(payload.room.status ?? '')
      .toLowerCase()
      .trim();

    payload = projectRoomRoster(payload, ctx.clients.values(), roomId);
    const focusIntent = this.announcements.focusIntent(ctx, roomId, payload);
    await this.broadcaster.broadcast(
      ctx,
      roomId,
      payload,
      ctx.nextRoomRealtimeVersion(roomId),
    );
    if (focusIntent) {
      await ctx.broadcast(roomId, 'room.focus', focusIntent);
      await this.broadcastRoomIntent(
        ctx,
        roomId,
        this.presenter.presentFocusIntent(focusIntent),
      );
      if (focusIntent.announce !== false)
        await this.broadcastRoomIntent(
          ctx,
          roomId,
          this.presenter.presentFocusAnnouncement(focusIntent),
        );
    }

    const previousSnapshot = ctx.lastRoomSnapshotByRoomId.get(roomId);
    const nextSnapshot = buildRoomSnapshot(payload);
    await this.announcements.broadcastDiff(
      ctx,
      roomId,
      previousSnapshot,
      nextSnapshot,
    );
    this.ensureRoomTrackingCapacity(ctx, roomId);
    ctx.lastRoomSnapshotByRoomId.set(roomId, nextSnapshot);

    const startWizardIntent = this.announcements.startWizardIntent(
      payload,
      previousStatus,
      nextStatus,
    );
    if (startWizardIntent) {
      await this.broadcastRoomIntent(
        ctx,
        roomId,
        this.presenter.presentStartWizardIntent(startWizardIntent),
      );
      const gameName = (
        payload.manifest?.name ??
        payload.room.gameType ??
        ''
      ).trim();
      await this.broadcastRoomIntent(
        ctx,
        roomId,
        this.presenter.presentCreationAnnouncement(gameName),
      );
    }
    this.ensureRoomTrackingCapacity(ctx, roomId);
    ctx.lastRoomStatusByRoomId.set(roomId, nextStatus);
  }

  async tryUpdateRoomPayload(
    ctx: StateContext,
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ): Promise<boolean> {
    const updated = await this.roomState.updateRoomPayloadCache(
      roomId,
      updater,
    );
    if (!updated) {
      return false;
    }
    await this.broadcastRoomPayload(ctx, roomId, updated);
    return true;
  }

  async sendRoomStateToClient(
    ctx: StateContext,
    client: WebSocket,
    roomId: number,
    opts?: RoomRosterOptions,
  ): Promise<void> {
    return this.enqueuePublication(roomId, () =>
      this.publishRoomStateToClient(ctx, client, roomId, opts),
    );
  }

  private async publishRoomStateToClient(
    ctx: StateContext,
    client: WebSocket,
    roomId: number,
    opts?: RoomRosterOptions,
  ): Promise<void> {
    try {
      const payload = projectRoomRoster(
        await this.roomState.getRoomPayload(roomId),
        ctx.clients.values(),
        roomId,
        opts,
      );
      const previousStatus = (ctx.lastRoomStatusByRoomId.get(roomId) ?? '')
        .toLowerCase()
        .trim();
      const nextStatus = String(payload.room.status ?? '')
        .toLowerCase()
        .trim();

      const focusIntent = this.announcements.focusIntent(ctx, roomId, payload);
      const meta = ctx.clients.get(client);
      const payloadForClient =
        meta != null
          ? this.withAllowedActionsForClient(payload, meta)
          : payload;
      ctx.safeSend(
        client,
        this.presenter.presentRoomUpdated(
          roomId,
          payloadForClient,
          ctx.currentRoomRealtimeVersion(roomId),
        ),
      );
      if (focusIntent) {
        this.announcements.sendFocus(ctx, client, roomId, focusIntent);
      }
      const startWizardIntent = this.announcements.startWizardIntent(
        payload,
        previousStatus,
        nextStatus,
      );
      if (startWizardIntent) {
        ctx.safeSend(
          client,
          this.presenter.presentRoomIntent(
            roomId,
            this.presenter.presentStartWizardIntent(startWizardIntent),
          ),
        );
      }
      this.ensureRoomTrackingCapacity(ctx, roomId);
      ctx.lastRoomSnapshotByRoomId.set(roomId, buildRoomSnapshot(payload));
      ctx.lastRoomStatusByRoomId.set(roomId, nextStatus);
    } catch (err) {
      await ctx.sendError(client, getErrorMessage(err, 'Erreur table'));
      try {
        client.close(4003, 'room not found');
      } catch {
        // ignore
      }
    }
  }

  private ensureRoomTrackingCapacity(ctx: StateContext, roomId: number): void {
    if (
      ctx.lastRoomStatusByRoomId.size >=
        RoomGatewayStateService.MAX_TRACKED_ROOMS &&
      !ctx.lastRoomStatusByRoomId.has(roomId)
    ) {
      const oldest = ctx.lastRoomStatusByRoomId.keys().next().value;
      if (typeof oldest === 'number') {
        ctx.lastRoomStatusByRoomId.delete(oldest);
        ctx.lastRoomSnapshotByRoomId.delete(oldest);
      }
    }
    if (
      ctx.lastRoomSnapshotByRoomId.size >=
        RoomGatewayStateService.MAX_TRACKED_ROOMS &&
      !ctx.lastRoomSnapshotByRoomId.has(roomId)
    ) {
      const oldest = ctx.lastRoomSnapshotByRoomId.keys().next().value;
      if (typeof oldest === 'number') {
        ctx.lastRoomSnapshotByRoomId.delete(oldest);
        ctx.lastRoomStatusByRoomId.delete(oldest);
      }
    }
  }

  private enqueuePublication(
    roomId: number,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.publicationQueues.get(roomId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    this.publicationQueues.set(roomId, current);
    const release = () => {
      if (this.publicationQueues.get(roomId) === current) {
        this.publicationQueues.delete(roomId);
      }
    };
    void current.then(release, release);
    return current;
  }
}
