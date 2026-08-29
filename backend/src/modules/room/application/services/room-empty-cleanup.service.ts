import { Inject, Injectable, Logger } from '@nestjs/common';
import { RemoveAllRoomBotsService } from '../../../bot/public-api';
import { PresenceService } from '../../../presence/public-api';
import { bestEffort } from '../../../../shared/utils/public-api';
import type { RoomMembershipContext } from '../models/room-membership-context.model';
import type { RoomRecord } from '../models/room-record.model';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../ports/room-event-publisher.port';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import {
  ROOM_VAULT_SNAPSHOT_REPOSITORY,
  type RoomVaultSnapshotRepository,
} from '../ports/room-vault-snapshot.repository';
import { RoomRuntimeStateService } from './room-runtime-state.service';

@Injectable()
export class RoomEmptyCleanupService {
  private readonly logger = new Logger(RoomEmptyCleanupService.name);

  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_VAULT_SNAPSHOT_REPOSITORY)
    private readonly vaultSnapshots: RoomVaultSnapshotRepository,
    private readonly removeAllRoomBots: RemoveAllRoomBotsService,
    private readonly presence: PresenceService,
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
    let activeHumans = await context.countActiveHumans(room.id);
    if (activeHumans === 0) {
      await this.removeAllRoomBots.execute(room.id);
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
    await this.events.publishRoomDeleted(room.id);
    await this.rooms.delete(room.id);
    this.runtimeState.clearRoomBans(room.id);
    await context.invalidateRoomPayloadCache(room.id);
    this.presence.broadcastPresence();
    await this.events.publishLobbyChanged(room.id, 'deleted');
    return true;
  }
}
