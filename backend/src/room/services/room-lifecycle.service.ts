import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { VaultRoomSnapshotEntity } from '../../vault/entities/vault-room-snapshot.entity';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { RoomRuntimeStateService } from './room-runtime-state.service';

export type RoomLifecycleContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<Room>;
  countActiveHumans: (roomId: number) => Promise<number>;
  countBots: (roomId: number) => Promise<number>;
  ensureOwner: (room: Room, userId: number) => void;
};

@Injectable()
export class RoomLifecycleService {
  constructor(
    private readonly rooms: Repository<Room>,
    private readonly participants: Repository<RoomParticipant>,
    private readonly vaultSnapshots: Repository<VaultRoomSnapshotEntity>,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    private readonly runtimeState: RoomRuntimeStateService,
  ) {}

  async togglePrivacy(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await context.requireRoom(roomId);
    context.ensureOwner(room, userId);
    room.isPrivate = !room.isPrivate;
    await this.rooms.save(room);
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    this.runtimeState.notifyLobbyChanged(room.id, 'privacy');
    return room;
  }

  async startRoom(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await context.requireRoom(roomId);
    context.ensureOwner(room, userId);

    const bots = await this.ensureStartable(context, room);
    this.applyStartedState(room);

    await this.rooms.save(room);
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    this.runtimeState.notifyLobbyChanged(room.id, 'started');

    try {
      const activeParticipants = await this.participants.find({
        where: { room: { id: room.id }, leftAt: IsNull() },
        relations: ['user'],
      });
      void this.stats
        .startMatch({
          roomId: room.id,
          gameType: room.gameType,
          humans: activeParticipants.map((participant) => ({
            id: participant.user.id,
            username: participant.user.username,
          })),
          botsCount: bots,
        })
        .catch(() => undefined);
    } catch {
      // best effort
    }

    return room;
  }

  async startRoomSystem(
    context: RoomLifecycleContext,
    roomId: number,
  ): Promise<Room> {
    const room = await context.requireRoom(roomId);
    await this.ensureStartable(context, room);
    this.applyStartedState(room);
    await this.rooms.save(room);
    await context.invalidateRoomPayloadCache(room.id);
    this.runtimeState.notifyLobbyChanged(room.id, 'started');
    return room;
  }

  async resetRoom(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<Room> {
    const room = await context.requireRoom(roomId);
    const known = await this.catalog.getGame(room.gameType);
    if (!known) {
      throw new BadRequestException('Type de jeu invalide');
    }
    context.ensureOwner(room, userId);

    if (String(room.status ?? '').toLowerCase() === 'started') {
      try {
        void this.stats.endMatchOnReset(room.id).catch(() => undefined);
      } catch {
        // best effort
      }
    }

    if (room.restoredFromSnapshotId) {
      await this.deleteLinkedRestoredSnapshot(room, userId);
      room.restoredFromSnapshotId = null;
      room.restoredOwnerUserId = null;
    }

    room.status = 'setup';
    room.startedAt = null;
    await this.rooms.save(room);
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    this.runtimeState.notifyLobbyChanged(room.id, 'reset');
    return room;
  }

  async resetRoomSystem(
    context: RoomLifecycleContext,
    roomId: number,
  ): Promise<Room> {
    const existing = await this.rooms.findOne({ where: { id: roomId } });
    if (!existing) {
      throw new NotFoundException('Table introuvable');
    }

    await this.rooms.update(
      { id: existing.id },
      { status: 'setup', startedAt: null },
    );

    const room = await context.requireRoom(existing.id);
    await context.invalidateRoomPayloadCache(room.id);
    this.runtimeState.notifyLobbyChanged(room.id, 'reset');
    return room;
  }

  private async ensureStartable(
    context: RoomLifecycleContext,
    room: Room,
  ): Promise<number> {
    const humans = await context.countActiveHumans(room.id);
    const bots = await context.countBots(room.id);
    if (humans + bots < 2) {
      throw new BadRequestException('Au moins deux participants sont requis');
    }
    return bots;
  }

  private applyStartedState(room: Room): void {
    room.status = 'started';
    if (!room.startedAt) {
      room.runId = Math.max(0, Number(room.runId ?? 0)) + 1;
      room.startedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    }
  }

  private async deleteLinkedRestoredSnapshot(
    room: Room,
    fallbackOwnerUserId: number,
  ): Promise<void> {
    const snapshotId = String(room.restoredFromSnapshotId ?? '').trim();
    if (!snapshotId) {
      return;
    }

    const ownerUserId =
      typeof room.restoredOwnerUserId === 'number' &&
      Number.isFinite(room.restoredOwnerUserId)
        ? Number(room.restoredOwnerUserId)
        : fallbackOwnerUserId;
    if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) {
      return;
    }

    try {
      await this.vaultSnapshots.delete({
        id: snapshotId,
        ownerUserId,
      } as any);
    } catch {
      // best effort
    }
  }
}
