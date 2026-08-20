import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { OPEN_ROOM_STATUSES } from '../constants/room-status.constants';
import { User } from '../../user/entities/user.entity';
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

type AdminContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<Room>;
  requireUser: (userId: number) => Promise<User>;
  ensureOwner: (room: Room, userId: number) => void;
  broadcastPresence: () => void;
};

@Injectable()
export class RoomAdminMaintenanceService {
  private readonly logger = new Logger(RoomAdminMaintenanceService.name);

  constructor(
    private readonly rooms: Repository<Room>,
    private readonly realtimeTracker: RoomRealtimeTrackerService,
    private readonly runtimeState: RoomRuntimeStateService,
  ) {}

  async adminDestroyRoom(
    ctx: AdminContext,
    roomId: number,
  ): Promise<{ ok: true; roomId: number }> {
    const id =
      typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
        ? Math.floor(roomId)
        : 0;
    if (id <= 0) {
      throw new BadRequestException('roomId invalide.');
    }

    const existing = await this.rooms.findOne({
      where: { id },
      select: ['id'],
    });
    if (!existing) {
      throw new NotFoundException('Room introuvable.');
    }

    for (const notify of this.runtimeState.getRoomDeletedNotifiers()) {
      try {
        await notify(id);
      } catch {
        // best effort
      }
    }

    await this.rooms.delete(id);
    this.runtimeState.clearRoomBans(id);
    await ctx.invalidateRoomPayloadCache(id);
    this.runtimeState.notifyLobbyChanged(id, 'deleted');
    ctx.broadcastPresence();
    return { ok: true, roomId: id };
  }

  async setOwner(
    ctx: AdminContext,
    roomId: number,
    userId: number,
    newOwnerId: number,
  ): Promise<Room> {
    const room = await ctx.requireRoom(roomId);
    ctx.ensureOwner(room, userId);
    const user = await ctx.requireUser(newOwnerId);
    room.owner = user;
    await this.rooms.save(room);
    await ctx.invalidateRoomPayloadCache(room.id);
    this.runtimeState.notifyLobbyChanged(room.id, 'owner');
    ctx.broadcastPresence();
    return room;
  }

  async requireRoomForOwnerAction(
    ctx: AdminContext,
    roomId: number,
    userId: number,
  ): Promise<Room> {
    const room = await ctx.requireRoom(roomId);
    ctx.ensureOwner(room, userId);
    return room;
  }

  async saveRoom(ctx: AdminContext, room: Room): Promise<Room> {
    const saved = await this.rooms.save(room);
    await ctx.invalidateRoomPayloadCache(saved.id);
    this.runtimeState.notifyLobbyChanged(saved.id, 'updated');
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

    const qb = this.rooms
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect(
        'room.participants',
        'participant',
        'participant.leftAt IS NULL',
      )
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('room.bots', 'bot')
      .orderBy('room.id', 'DESC')
      .limit(limit);

    if (!includePrivate) {
      qb.where('room.isPrivate = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!includeStarted) {
      qb.andWhere('room.startedAt IS NULL');
    }

    const rooms = await qb.getMany();
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
    ctx: AdminContext,
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

    const qb = this.rooms
      .createQueryBuilder('room')
      .select(['room.id'])
      .orderBy('room.id', 'ASC');

    if (!includePrivate) {
      qb.where('room.is_private = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!includeStarted) {
      qb.andWhere('room.started_at IS NULL');
      const statuses = OPEN_ROOM_STATUSES.map((s) => s.toLowerCase());
      qb.andWhere('LOWER(room.status) IN (:...statuses)', { statuses });
    }

    const olderThanMinutes =
      typeof opts?.olderThanMinutes === 'number' &&
      Number.isFinite(opts.olderThanMinutes) &&
      opts.olderThanMinutes > 0
        ? Math.floor(opts.olderThanMinutes)
        : null;
    if (olderThanMinutes) {
      const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
      qb.andWhere('room.created_at < :cutoff', { cutoff });
    }

    qb.limit(limit);

    const rows = await qb.getRawMany<{ room_id: number }>();
    const roomIds = rows
      .map((r: any) => Number(r?.room_id ?? r?.id ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);

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
      this.runtimeState.notifyLobbyChanged(id, 'deleted');
    }
    ctx.broadcastPresence();

    return {
      matched: filteredRoomIds.length,
      deleted: filteredRoomIds.length,
      roomIds: filteredRoomIds,
    };
  }
}
