import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import { getErrorMessage } from '@common/utils/public-api';
import { RoomClientPolicyService } from '../../../application/services/room-client-policy.service';
import type { RoomPayload } from '../../../application/models/room-payload.model';
import { RoomStateService } from '../../../application/services/room-state.service';
import {
  buildRoomSnapshot,
  collectRoomAnnouncementMessages,
  type RoomSnapshot,
} from './room-announcement.helpers';
import { emitRoomAnnouncementDiff } from './room-announcement-diff.helpers';
import type { RoomFocusIntent } from './dto/room-focus-intent.ws.dto';
import type {
  RoomIntent,
  RoomStartWizardIntent,
} from './dto/room-intent.ws.dto';
import { RoomGatewayStatePresenter } from './room-gateway-state.presenter';
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
  constructor(
    private readonly roomState: RoomStateService,
    private readonly clientPolicy: RoomClientPolicyService,
    private readonly presenter: RoomGatewayStatePresenter,
  ) {}

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
    await ctx.broadcast(roomId, 'room.intent', intent);
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
    const focusIntent = this.computeStatusFocusIntent(ctx, roomId, payload);
    await this.broadcastRoomUpdated(ctx, roomId, payload);
    if (focusIntent) {
      await ctx.broadcast(roomId, 'room.focus', focusIntent);
      await this.broadcastRoomIntent(
        ctx,
        roomId,
        this.presenter.presentFocusIntent(focusIntent),
      );
      await this.broadcastRoomIntent(
        ctx,
        roomId,
        this.presenter.presentFocusAnnouncement(focusIntent),
      );
    }

    const previousSnapshot = ctx.lastRoomSnapshotByRoomId.get(roomId);
    const nextSnapshot = buildRoomSnapshot(payload);
    await this.emitRoomAnnouncementsFromDiff(
      ctx,
      roomId,
      previousSnapshot,
      nextSnapshot,
    );
    ctx.lastRoomSnapshotByRoomId.set(roomId, nextSnapshot);

    const startWizardIntent = this.buildStartWizardIntent(
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

      const focusIntent = this.computeStatusFocusIntent(ctx, roomId, payload);
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
        this.sendFocusIntent(ctx, client, roomId, focusIntent);
      }
      const startWizardIntent = this.buildStartWizardIntent(
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

  private sendFocusIntent(
    ctx: StateContext,
    client: WebSocket,
    roomId: number,
    focusIntent: RoomFocusIntent,
  ): void {
    ctx.safeSend(client, this.presenter.presentRoomFocus(roomId, focusIntent));
    ctx.safeSend(
      client,
      this.presenter.presentRoomIntent(
        roomId,
        this.presenter.presentFocusIntent(focusIntent),
      ),
    );
    ctx.safeSend(
      client,
      this.presenter.presentRoomIntent(
        roomId,
        this.presenter.presentFocusAnnouncement(focusIntent),
      ),
    );
  }

  private async broadcastRoomUpdated(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): Promise<void> {
    const targets = ctx.rooms.get(roomId);
    const silentTargets = ctx.silentRooms.get(roomId);

    const sendToSet = (set?: Set<WebSocket>) => {
      if (!set) return;
      for (const socket of Array.from(set)) {
        const meta = ctx.clients.get(socket);
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
            JSON.stringify(
              this.presenter.presentRoomUpdated(roomId, payloadForClient),
            ),
          );
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
        message: "Choisissez rapidement l'ambiance et la configuration.",
      };
    }

    return null;
  }

  private computeStatusFocusIntent(
    ctx: StateContext,
    roomId: number,
    payload: RoomPayload,
  ): RoomFocusIntent | null {
    const previousStatus = (ctx.lastRoomStatusByRoomId.get(roomId) ?? '')
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

  private async emitRoomAnnouncementsFromDiff(
    ctx: StateContext,
    roomId: number,
    previous: RoomSnapshot | undefined,
    next: RoomSnapshot,
  ): Promise<void> {
    const messages = collectRoomAnnouncementMessages(previous, next);
    if (!previous || messages.length > 0) {
      for (const message of messages) {
        await this.broadcastRoomAnnouncement(ctx, roomId, message);
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
      announce: (message) =>
        this.broadcastRoomAnnouncement(ctx, roomId, message),
    });
  }

  private async broadcastRoomAnnouncement(
    ctx: StateContext,
    roomId: number,
    message: string,
    priority: 'polite' | 'assertive' = 'polite',
  ): Promise<void> {
    const normalized = (message ?? '').trim();
    if (normalized.length === 0) {
      return;
    }

    await this.broadcastRoomIntent(
      ctx,
      roomId,
      this.presenter.presentAnnouncement(normalized, priority),
    );
  }
}
