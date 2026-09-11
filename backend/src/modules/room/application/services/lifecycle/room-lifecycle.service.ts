import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../shared/interfaces/public-api';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../../ports/room-event-publisher.port';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../../ports/room-participant.repository';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../ports/room.repository';
import {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from '../../ports/room-vault-snapshot.repository';
import type { RoomRecord } from '../../models/room-record.model';
import {
  ROOM_CATALOG_PORT,
  type RoomCatalogPort,
} from '../../ports/room-catalog.port';
import {
  ROOM_STATS_PORT,
  type RoomStatsPort,
} from '../../ports/room-stats.port';
import { bestEffort } from '../../../../../platform/observability/public-api';
import {
  buildMinimumParticipantsMessage,
  hasMinimumParticipants,
  resolveMinimumParticipants,
} from './room-start-policy';
import { buildUniqueActiveRoomPlayers } from '../membership/room-participant-roster';

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
    @Inject(ROOM_CATALOG_PORT)
    private readonly catalog: RoomCatalogPort,
    @Inject(ROOM_STATS_PORT)
    private readonly stats: RoomStatsPort,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly roomEvents: RoomEventPublisherPort,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  async togglePrivacy(
    context: RoomLifecycleContext,
    roomId: number,
    userId: number,
    invalidateCache = true,
  ): Promise<RoomRecord> {
    const room = await context.requireRoom(roomId);
    context.ensureOwner(room, userId);
    const toggled = await this.rooms.togglePrivacyOwned(roomId, userId);
    if (!toggled) {
      const latest = await context.requireRoom(roomId);
      context.ensureOwner(latest, userId);
      throw new NotFoundException('Table introuvable');
    }
    if (invalidateCache) {
      await context.invalidateRoomPayloadCache(toggled.id);
    }
    await this.roomEvents.publishLobbyChanged(toggled.id, 'privacy');
    return toggled;
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
      await bestEffort(
        this.stats.startMatch({
          roomId: room.id,
          gameType: room.gameType,
          humans: buildUniqueActiveRoomPlayers(activeParticipants),
          botsCount: bots,
        }),
        `création des statistiques room=${room.id}`,
      );
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
        await bestEffort(
          this.stats.endMatchOnReset(room.id),
          `finalisation des statistiques room=${room.id}`,
        );
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

  async prepareNextRun(
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
    await this.roomEvents.publishLobbyChanged(room.id, 'finished');
    await this.roomEvents.publishRoomStateUpdated(room.id);
    return room;
  }

  private async ensureStartable(
    context: RoomLifecycleContext,
    room: RoomRecord,
  ): Promise<number> {
    const [manifest, humans, bots] = await Promise.all([
      this.catalog.getGame(room.gameType),
      context.countActiveHumans(room.id),
      context.countBots(room.id),
    ]);
    const minimum = resolveMinimumParticipants(manifest?.minPlayers);
    if (!hasMinimumParticipants(humans, bots, minimum)) {
      throw new BadRequestException(buildMinimumParticipantsMessage(minimum));
    }
    return bots;
  }

  private applyStartedState(room: RoomRecord): void {
    room.status = 'started';
    if (!room.startedAt) {
      const currentRunId =
        Number.isSafeInteger(room.runId) && room.runId >= 0 ? room.runId : 0;
      room.runId =
        currentRunId >= Number.MAX_SAFE_INTEGER - 1 ? 1 : currentRunId + 1;
      room.startedAt = new Date(Math.floor(this.now() / 1000) * 1000);
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
      Number.isSafeInteger(room.restoredOwnerUserId)
        ? Number(room.restoredOwnerUserId)
        : fallbackOwnerUserId;
    if (!Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) {
      return;
    }

    try {
      await this.vaultSnapshots.deleteOwnedSnapshot(snapshotId, ownerUserId);
    } catch {
      // best effort
    }
  }

  private now(): number {
    return this.clock.now();
  }
}
/** Room application capability boundary. */
