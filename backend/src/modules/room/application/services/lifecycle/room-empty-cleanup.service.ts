import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { bestEffort } from '../../../../../platform/observability/public-api';
import type { RoomMembershipContext } from '../../models/room-membership-context.model';
import type { RoomRecord } from '../../models/room-record.model';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../../ports/room-event-publisher.port';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
} from '../../ports/room.repository';
import {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from '../../ports/room-vault-snapshot.repository';
import {
  ROOM_PRESENCE_PORT,
  type RoomPresencePort,
} from '../../ports/room-presence.port';
import {
  ROOM_BOT_OPERATIONS_PORT,
  type RoomBotOperationsPort,
} from '../../ports/room-bot-operations.port';
import { RoomRuntimeStateService } from '../state/room-runtime-state.service';

@Injectable()
export class RoomEmptyCleanupService {
  private readonly logger = new Logger(RoomEmptyCleanupService.name);

  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_VAULT_SNAPSHOT_REPOSITORY)
    private readonly vaultSnapshots: RoomVaultSnapshotRepository,
    @Inject(ROOM_BOT_OPERATIONS_PORT)
    private readonly botOperations: RoomBotOperationsPort,
    @Inject(ROOM_PRESENCE_PORT)
    private readonly presence: RoomPresencePort,
    private readonly runtimeState: RoomRuntimeStateService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly events: RoomEventPublisherPort,
  ) {}

  async abandonRestoredRoomIfEmpty(
    context: RoomMembershipContext,
    room: RoomRecord,
    userId: number,
    participantLeft: boolean,
  ): Promise<boolean> {
    requirePositiveSafeId(room?.id, 'Identifiant de table invalide');
    requirePositiveSafeId(userId, 'Identifiant utilisateur invalide');
    const snapshotId = String(room.restoredFromSnapshotId ?? '').trim();
    if (
      !participantLeft ||
      !snapshotId ||
      room.restoredOwnerUserId !== userId ||
      (await context.countActiveHumans(room.id)) > 0
    ) {
      return false;
    }
    this.logger.log('Restored room abandoned (no humans left => delete room)', {
      roomId: room.id,
      userId,
      snapshotId,
    });
    await bestEffort(
      this.vaultSnapshots.deleteOwnedSnapshot(snapshotId, userId),
      `suppression snapshot room=${room.id}`,
      this.logger,
    );
    await context.destroyRoom(room.id);
    return true;
  }

  async deleteRoomIfEmpty(
    context: RoomMembershipContext,
    room: RoomRecord,
    userId: number,
  ): Promise<boolean> {
    requirePositiveSafeId(room?.id, 'Identifiant de table invalide');
    requirePositiveSafeId(userId, 'Identifiant utilisateur invalide');
    let activeHumans = await context.countActiveHumans(room.id);
    if (activeHumans === 0) {
      await this.botOperations.removeAll(room.id);
      activeHumans = await context.countActiveHumans(room.id);
    }
    const bots = await context.countBots(room.id);
    if (activeHumans + bots > 0) {
      return false;
    }
    this.logger.log('Room deleted (empty)', {
      roomId: room.id,
      userId,
      activeHumans,
      bots,
    });
    await this.rooms.delete(room.id);
    await this.events.publishRoomDeleted(room.id);
    this.runtimeState.clearRoomBans(room.id);
    await context.invalidateRoomPayloadCache(room.id);
    this.presence.broadcastPresence();
    await this.events.publishLobbyChanged(room.id, 'deleted');
    return true;
  }
}

function requirePositiveSafeId(value: unknown, message: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException(message);
  }
}
/** Room application capability boundary. */
