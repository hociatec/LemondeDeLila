import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { getErrorMessage } from '@shared/utils/public-api';
import { RoomClientPolicyService } from '../../../application/services/membership/room-client-policy.service';
import type { RoomPayload } from '../../../application/contracts/room-payload.model';
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
  addHiddenSelf,
  listConnectedPlayers,
  listVisibleSpectators,
  mergePlayers,
} from './room-roster';

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
};

@Injectable()
export class RoomGatewayStateService {
  private readonly announcements: RoomGatewayAnnouncements;

  constructor(
    private readonly roomState: RoomStateService,
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly presenter: RoomGatewayStatePresenter,
  ) {
    this.announcements = new RoomGatewayAnnouncements(presenter);
  }

  async sendRoomState(ctx: StateContext, roomId: number): Promise<void> {
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
      ctx.lastRoomStatusByRoomId.set(roomId, nextStatus);

      this.applySpectators(ctx, roomId, payload);
      await this.broadcastRoomUpdated(ctx, roomId, payload);
    } catch {
      // la table a peut-etre ete supprimee, on ignore
    }
  }

  applySpectators(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): void {
    payload.room.spectators = listVisibleSpectators(
      ctx.clients.values(),
      roomId,
    );
    payload.room.counts.spectators = payload.room.spectators.length;

    const started =
      (payload.room.status || '').toLowerCase() === 'started' ||
      Boolean(payload.room.startedAt);
    if (
      !started &&
      payload.room.players?.length &&
      payload.room.spectators?.length
    ) {
      const spectatorIds = new Set(
        payload.room.spectators.map((spectator) => spectator.id),
      );
      payload.room.players = payload.room.players.filter(
        (player) => !spectatorIds.has(player.id),
      );
      payload.room.counts.players = payload.room.players.length;
    }

    if (payload.room.players?.length && payload.room.spectators?.length) {
      const playerIds = new Set(
        payload.room.players.map((player) => player.id),
      );
      payload.room.spectators = payload.room.spectators.filter(
        (spectator) => !playerIds.has(spectator.id),
      );
      payload.room.counts.spectators = payload.room.spectators.length;
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
    const previousStatus = (ctx.lastRoomStatusByRoomId.get(roomId) ?? '')
      .toLowerCase()
      .trim();
    const nextStatus = String(payload.room.status ?? '')
      .toLowerCase()
      .trim();

    this.applySpectators(ctx, roomId, payload);
    const focusIntent = this.announcements.focusIntent(ctx, roomId, payload);
    await this.broadcastRoomUpdated(ctx, roomId, payload);
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
    opts?: {
      includeRealtimePlayers?: boolean;
      includeHiddenSelf?: { userId: number; username: string };
    },
  ): Promise<void> {
    try {
      const payload = await this.roomState.getRoomPayload(roomId);
      this.applySpectators(ctx, roomId, payload);
      if (opts?.includeHiddenSelf) {
        payload.room.spectators = addHiddenSelf(
          payload.room.spectators,
          opts.includeHiddenSelf,
        );
        payload.room.counts.spectators = payload.room.spectators.length;
      }
      if (opts?.includeRealtimePlayers) {
        const connected = listConnectedPlayers(ctx.clients.values(), roomId);
        payload.room.players = mergePlayers(payload.room.players, connected);
        payload.room.counts.players = payload.room.players.length;
      }
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
        this.presenter.presentRoomUpdated(roomId, payloadForClient),
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

  private async broadcastRoomUpdated(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const targets = ctx.rooms.get(roomId);
    const silentTargets = ctx.silentRooms.get(roomId);

    const serializedByActions = new Map<string, string>();
    const messageFor = (meta: ClientMeta): string => {
      const actions = this.clientPolicy.listAllowedActions(
        payload,
        meta.userId,
      );
      const cacheKey = JSON.stringify(actions);
      const cached = serializedByActions.get(cacheKey);
      if (cached) return cached;
      const message = JSON.stringify(
        this.presenter.presentRoomUpdated(roomId, {
          ...payload,
          room: { ...payload.room, allowedActions: actions },
        }),
      );
      serializedByActions.set(cacheKey, message);
      return message;
    };

    const sendToSet = (set?: Set<WebSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        const meta = ctx.clients.get(socket);
        if (!meta || socket.readyState !== WebSocket.OPEN) {
          set.delete(socket);
          continue;
        }
        try {
          socket.send(messageFor(meta));
        } catch {
          set.delete(socket);
          try {
            socket.close();
          } catch {
            // ignore
          }
        }
      }
      if (set.size === 0) {
        if (set === targets) ctx.rooms.delete(roomId);
        if (set === silentTargets) ctx.silentRooms.delete(roomId);
      }
    };

    sendToSet(targets);
    sendToSet(silentTargets);
  }
}
