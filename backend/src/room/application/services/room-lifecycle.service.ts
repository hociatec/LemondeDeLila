import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../ports/room-event-publisher.port';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../ports/room-participant.repository';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from '../ports/room-vault-snapshot.repository';
import type { RoomRecord } from '../models/room-record.model';
import { CatalogService } from '../../../catalog/public-api';
import { GameStatsService } from '../../../stats/public-api';

export type RoomLifecycleContext = {
  invalidateRoomPayloadCache: (roomId: number) => Promise<void>;
  requireRoom: (roomId: number) => Promise<RoomRecord>;
  countActiveHumans: (roomId: number) => Promise<number>;
  countBots: (roomId: number) => Promise<number>;
  ensureOwner: (room: RoomRecord, userId: number) => void;
};

@Injectable()
export class RoomLifecycleService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: RoomParticipantRepository,
    @Inject(ROOM_VAULT_SNAPSHOT_REPOSITORY)
    private readonly vaultSnapshots: RoomVaultSnapshotRepository,
    private readonly catalog: CatalogService,
    private readonly stats: GameStatsService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
  ) {}

  async togglePrivacy(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    const room = await context.requireRoom(roomId);
    context.ensureOwner(room, userId);
    room.isPrivate = !room.isPrivate;
    await this.rooms.save(room);
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    await this.roomEvents.publishLobbyChanged(room.id, 'privacy');
    return room;
  }

  async startRoom(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    const room = await context.requireRoom(roomId);
    context.ensureOwner(room, userId);

    const bots = await this.ensureStartable(context, room);
    this.applyStartedState(room);

    await this.rooms.save(room);
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(room.id);
    }
    await this.roomEvents.publishLobbyChanged(room.id, 'started');

    try {
      const activeParticipants =
        await this.participants.findActiveByRoomWithUsers(room.id);
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
  ): Promise<RoomRecord> {
    const room = await context.requireRoom(roomId);
    await this.ensureStartable(context, room);
    this.applyStartedState(room);
    await this.rooms.save(room);
    await context.invalidateRoomPayloadCache(room.id);
    await this.roomEvents.publishLobbyChanged(room.id, 'started');
    return room;
  }

  async resetRoom(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
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
    await this.roomEvents.publishLobbyChanged(room.id, 'reset');
    return room;
  }

  async resetRoomSystem(
    context: RoomLifecycleContext,
    roomId: number,
  ): Promise<RoomRecord> {
    const existing = await this.rooms.findById(roomId);
    if (!existing) {
      throw new NotFoundException('Table introuvable');
    }

    await this.rooms.update(existing.id, { status: 'setup', startedAt: null });

    const room = await context.requireRoom(existing.id);
    await context.invalidateRoomPayloadCache(room.id);
    await this.roomEvents.publishLobbyChanged(room.id, 'reset');
    return room;
  }

  private async ensureStartable(
    context: RoomLifecycleContext,
    room: RoomRecord,
  ): Promise<number> {
    const humans = await context.countActiveHumans(room.id);
    const bots = await context.countBots(room.id);
    if (humans + bots < 2) {
      throw new BadRequestException('Au moins deux participants sont requis');
    }
    return bots;
  }

  private applyStartedState(room: RoomRecord): void {
    room.status = 'started';
    if (!room.startedAt) {
      room.runId = Math.max(0, Number(room.runId ?? 0)) + 1;
      room.startedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    }
  }

  private async deleteLinkedRestoredSnapshot(
    room: RoomRecord,
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
      await this.vaultSnapshots.deleteOwnedSnapshot(snapshotId, ownerUserId);
    } catch {
      // best effort
    }
  }
}
