import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../ports/room-event-publisher.port';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import { OPEN_ROOM_STATUSES } from '../models/room-status.model';
import type { RoomRecord } from '../models/room-record.model';
import type { RoomUserRecord } from '../models/room-user.model';
import { RoomRealtimeTrackerService } from './room-realtime-tracker.service';
import { RoomRuntimeStateService } from './room-runtime-state.service';

type RoomListItem = {
  id: number;
  name: string;
  gameType: string;
  status: string;
  isPrivate: boolean;
  maxPlayers: number;
  playersCount: number;
  botsCount: number;
  ownerUsername: string | null;
  activePlayers: number;
};

export type RoomAdminContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<RoomRecord>;
  requireUser: (userId: number) => Promise<RoomUserRecord>;
  ensureOwner: (room: RoomRecord, userId: number) => void;
  broadcastPresence: () => void;
};

@Injectable()
export class RoomAdminMaintenanceService {
  private readonly logger = new Logger(RoomAdminMaintenanceService.name);

  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly runtimeState: RoomRuntimeStateService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
  ) {}

  async adminDestroyRoom(
    ctx: RoomAdminContext,
    roomId: number,
  ): Promise<{ ok: true; roomId: number }> {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide.');
    }

    const existing = await this.rooms.exists(id);
    if (!existing) {
      throw new NotFoundException('Room introuvable.');
    }

    await this.roomEvents.publishRoomDeleted(id);
    await this.rooms.delete(id);
    this.runtimeState.clearRoomBans(id);
    await ctx.invalidateRoomPayloadCache(id);
    await this.roomEvents.publishLobbyChanged(id, 'deleted');
    ctx.broadcastPresence();
    return { ok: true, roomId: id };
  }

  async setOwner(
    ctx: RoomAdminContext,
    roomId: number,
    userId: number,
    newOwnerId: number,
  ): Promise<RoomRecord> {
    const room = await ctx.requireRoom(roomId);
    ctx.ensureOwner(room, userId);
    const user = await ctx.requireUser(newOwnerId);
    room.owner = user;
    await this.rooms.save(room);
    await ctx.invalidateRoomPayloadCache(room.id);
    await this.roomEvents.publishLobbyChanged(room.id, 'owner');
    ctx.broadcastPresence();
    return room;
  }

  async requireRoomForOwnerAction(
    ctx: RoomAdminContext,
    roomId: number,
    userId: number,
  ): Promise<RoomRecord> {
    const room = await ctx.requireRoom(roomId);
    ctx.ensureOwner(room, userId);
    return room;
  }

  async saveRoom(ctx: RoomAdminContext, room: RoomRecord): Promise<RoomRecord> {
    const saved = await this.rooms.save(room);
    await ctx.invalidateRoomPayloadCache(saved.id);
    await this.roomEvents.publishLobbyChanged(saved.id, 'updated');
    return saved;
  }

  async adminListRooms(opts?: {
    limit?: number;
    includePrivate?: boolean;
    includeStarted?: boolean;
    joinableOnly?: boolean;
  }): Promise<{ items: RoomListItem[] }> {
    const includePrivate = opts?.includePrivate !== false;
    const joinableOnly = opts?.joinableOnly === true;
    const includeStarted = joinableOnly ? false : opts?.includeStarted === true;
    const limit = Math.min(Math.max(1, opts?.limit ?? 200), 1000);

    const rooms = await this.rooms.listForAdmin({
      includePrivate,
      includeStarted,
      limit,
    });
    const items = rooms.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      gameType: r.gameType ?? '',
      status: r.status ?? '',
      isPrivate: Boolean(r.isPrivate),
      maxPlayers: Number(r.maxPlayers ?? 0) || 0,
      playersCount: r.participants?.length ?? 0,
      botsCount: r.bots?.length ?? 0,
      ownerUsername: r.owner?.username ?? null,
      activePlayers: this.realtimeTracker.countActivePlayers(r.id),
    }));

    if (!joinableOnly) {
      return { items };
    }

    const openStatuses = new Set(
      OPEN_ROOM_STATUSES.map((s) => (s ?? '').toLowerCase()),
    );
    return {
      items: items.filter((r) => {
        const status = (r.status ?? '').toLowerCase();
        return openStatuses.has(status) && r.activePlayers > 0;
      }),
    };
  }

  async adminCleanupRooms(
    ctx: RoomAdminContext,
    opts?: {
      includePrivate?: boolean;
      includeStarted?: boolean;
      olderThanMinutes?: number;
      limit?: number;
      dryRun?: boolean;
      excludeActivePlayers?: boolean;
    },
  ): Promise<{
    matched: number;
    deleted: number;
    roomIds: number[];
  }> {
    const includePrivate = opts?.includePrivate === true;
    const includeStarted = opts?.includeStarted === true;
    const dryRun = opts?.dryRun === true;
    const excludeActivePlayers = opts?.excludeActivePlayers !== false;
    const limit = Math.min(Math.max(1, opts?.limit ?? 1000), 5000);

    const olderThanMinutes =
      typeof opts?.olderThanMinutes === 'number' &&
      Number.isFinite(opts.olderThanMinutes) &&
      opts.olderThanMinutes > 0
        ? Math.floor(opts.olderThanMinutes)
        : null;

    const roomIds = await this.rooms.listCleanupCandidateIds({
      includePrivate,
      includeStarted,
      olderThanMinutes,
      limit,
    });

    const filteredRoomIds = excludeActivePlayers
      ? roomIds.filter((id) => !this.realtimeTracker.hasActivePlayers(id))
      : roomIds;

    if (dryRun) {
      return {
        matched: filteredRoomIds.length,
        deleted: 0,
        roomIds: filteredRoomIds,
      };
    }

    if (filteredRoomIds.length === 0) {
      return { matched: 0, deleted: 0, roomIds: [] };
    }

    await this.rooms.delete(filteredRoomIds);
    for (const id of filteredRoomIds) {
      await ctx.invalidateRoomPayloadCache(id);
      await this.roomEvents.publishLobbyChanged(id, 'deleted');
    }
    ctx.broadcastPresence();

    return {
      matched: filteredRoomIds.length,
      deleted: filteredRoomIds.length,
      roomIds: filteredRoomIds,
    };
  }
}
