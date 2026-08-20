import { Injectable } from '@nestjs/common';
import { Server, WebSocket } from 'ws';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PerfMetricsService } from '../../common/services/perf-metrics.service';
import type { RoomPayload } from '../dto/room-response.dto';
import { RoomService } from '../services/room.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { buildCreatedRoomState } from './room-created-state.helpers';
import { extractTraceMeta } from './room-command.helpers';
import {
  addSocketToRoomMembership,
  removeSocketFromRoomMembership,
} from './room-socket-membership.helpers';
import {
  parseRoomCreateRequest,
  parseRoomJoinRequest,
} from './room-request.helpers';
import type { RoomIntent } from '../dto/room-intent.dto';
import type {
  AuthedClient,
  ClientMeta,
  ClientRole,
  RoomWithOptionalRuntimeFields,
} from './room-gateway.types';

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
  broadcast: (roomId: number, type: string, payload: any) => Promise<void>;
  broadcastRoomIntent: (roomId: number, payload: RoomIntent) => Promise<void>;
  broadcastRoomPayload: (roomId: number, payload: RoomPayload) => Promise<void>;
  sendError: (client: WebSocket, message: string) => Promise<void>;
  safeSend: (client: WebSocket, payload: unknown) => void;
  tryUpdateRoomPayload: (
    roomId: number,
    updater: (payload: RoomPayload) => RoomPayload | null,
  ) => Promise<RoomPayload | null>;
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
  asRecord: (value: unknown) => Record<string, any>;
};

@Injectable()
export class RoomGatewayLifecycleService {
  constructor(
    private readonly roomsService: RoomService,
    private readonly catalog: CatalogService,
    private readonly perf: PerfMetricsService,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
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
          await this.roomsService.leaveRoom(roomId, userId, {
            preserveRoom: remainingTotalConnections > 0,
            disconnectOnly: false,
          });
        } else {
          if (!userStillConnected) {
            await this.roomsService.transferOwnerIfCurrent(roomId, userId);
          }
          if (remainingTotalConnections === 0) {
            await this.roomsService.leaveRoom(roomId, userId, {
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
        const room = await this.roomsService.startRoom(
          meta.roomId,
          meta.userId,
          false,
        );
        await ctx.broadcast(meta.roomId, 'state-updated', {
          roomId: meta.roomId,
        });
        const updated = await ctx.tryUpdateRoomPayload(meta.roomId, (state) => {
          state.room.status = room.status;
          state.room.startedAt = room.startedAt
            ? room.startedAt.toISOString()
            : null;
          const roomWithRuntime = room as unknown as RoomWithOptionalRuntimeFields;
          state.room.runId =
            typeof roomWithRuntime.runId === 'number'
              ? roomWithRuntime.runId
              : null;
          state.generatedAt = new Date().toISOString();
          return state;
        });
        if (!updated) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
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
        await this.roomsService.resetRoom(meta.roomId, meta.userId, false);
        await this.promoteConnectedSpectatorsToParticipants(ctx, meta.roomId);
        await this.roomsService.invalidateRoomPayloadCache(meta.roomId);

        await ctx.broadcast(meta.roomId, 'state-updated', {
          roomId: meta.roomId,
        });
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
        const room = await this.roomsService.togglePrivacy(
          meta.roomId,
          meta.userId,
          false,
        );
        let state = await this.roomsService.updateRoomPayloadCache(
          meta.roomId,
          (roomState) => {
            roomState.room.isPrivate = room.isPrivate;
            roomState.generatedAt = new Date().toISOString();
            return roomState;
          },
        );
        if (!state) {
          await this.roomsService.invalidateRoomPayloadCache(meta.roomId);
          state = await this.roomsService.getRoomPayload(meta.roomId);
        }
        await ctx.broadcast(meta.roomId, 'room.privacy', {
          isPrivate: state.room.isPrivate,
          room: state.room,
        });
        await ctx.broadcastRoomIntent(meta.roomId, {
          type: 'announcement',
          payload: {
            message: state.room.isPrivate ? 'Table privÃ©e.' : 'Table publique.',
          },
        } satisfies RoomIntent);
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
        const room = await this.roomsService.createRoom(
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
        const message = {
          type: 'room.created',
          roomId: room.id,
          payload: ctx.withAllowedActionsForClient(state, meta),
        };
        if (previousRoomId > 0 && previousRoomId !== room.id) {
          await ctx.leavePreviousRoomOnSwitch(
            previousRoomId,
            meta.userId,
            previousRole,
          );
        }
        await this.roomsService.primeRoomPayloadCache(room.id, state);
        ctx.safeSend(client, message);
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
        const row = ctx.asRecord(payload);
        const { roomId, spectator, silent } = parseRoomJoinRequest(row);

        if (!Number.isFinite(roomId) || roomId <= 0) {
          throw new Error('roomId invalide');
        }

        if (this.roomsService.isBanned(roomId, meta.userId)) {
          await ctx.sendError(client, 'Banni de cette table.');
          return;
        }

        const effectiveSilent = Boolean(silent);
        if (effectiveSilent && !meta.isAdmin) {
          client.close(4003, 'Mode caché réservé aux admins');
          return;
        }

        let effectiveSpectator = spectator || effectiveSilent;
        if (effectiveSpectator && !effectiveSilent) {
          const allowed = await ctx.canSpectate(roomId, meta.userId);
          if (!allowed) {
            client.close(4003, 'Spectateur non autorise sur cette table');
            return;
          }
        }

        if (!effectiveSpectator) {
          try {
            await this.roomsService.joinRoom(roomId, meta.userId);
          } catch (err) {
            const reason = (err as Error).message;
            const state = await this.roomsService.getRoomPayload(roomId);
            const isOwner = state.room.owner?.id === meta.userId;
            const isParticipant =
              state.room.players?.some((p) => p?.id === meta.userId) ?? false;
            const started =
              (state.room.status || '').toLowerCase() === 'started' ||
              Boolean(state.room.startedAt);
            if (started) {
              if (!isOwner && !isParticipant) {
                const allowed = await ctx.canSpectate(roomId, meta.userId);
                if (!allowed) {
                  throw new Error(reason);
                }
                effectiveSpectator = true;
              }
            } else {
              throw err;
            }
          }
        }

        const previousRoomId = meta.roomId;
        const previousRole = meta.role;
        const previousSilent = meta.silent === true;
        if (previousRoomId !== roomId || previousSilent !== effectiveSilent) {
          removeSocketFromRoomMembership(
            ctx.rooms,
            ctx.silentRooms,
            previousRoomId,
            client,
          );
          addSocketToRoomMembership(
            ctx.rooms,
            ctx.silentRooms,
            roomId,
            client,
            effectiveSilent,
          );
        }

        meta.roomId = roomId;
        meta.role = effectiveSpectator ? 'spectator' : 'participant';
        meta.silent = effectiveSilent;
        this.realtimeTracker.setSocketParticipantRoom(
          client,
          meta.role === 'participant' && meta.silent !== true
            ? meta.roomId
            : null,
        );
        if (effectiveSilent) {
          await ctx.sendRoomStateToClient(client, roomId, {
            includeRealtimePlayers: true,
            includeHiddenSelf: { userId: meta.userId, username: meta.username },
          });
        } else {
          await ctx.sendRoomState(roomId);
        }

        if (
          Number.isFinite(previousRoomId) &&
          previousRoomId > 0 &&
          previousRoomId !== roomId
        ) {
          await ctx.leavePreviousRoomOnSwitch(
            previousRoomId,
            meta.userId,
            previousRole,
          );
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

  private async promoteConnectedSpectatorsToParticipants(
    ctx: LifecycleContext,
    roomId: number,
  ): Promise<void> {
    if (!Number.isFinite(roomId) || roomId <= 0) {
      return;
    }

    let isPrivate = false;
    try {
      const state = await this.roomsService.getRoomPayload(roomId);
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
        await this.roomsService.joinRoom(roomId, meta.userId, {
          allowPrivate: isPrivate,
        });
      } catch {
        continue;
      }

      meta.role = 'participant';
      this.realtimeTracker.setSocketParticipantRoom(socket, roomId);

      try {
        ctx.safeSend(socket, {
          type: 'room.role',
          roomId,
          payload: {
            spectator: false,
            message: 'Mode spectateur dÃ©sactivÃ©.',
          },
        });
      } catch {
        // ignore
      }
    }
  }
}
