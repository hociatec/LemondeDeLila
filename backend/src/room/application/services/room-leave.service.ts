import { Inject, Injectable } from '@nestjs/common';
import { AddSystemBotToRoomService } from '../../../bot/public-api';
import { PresenceService } from '../../../presence/public-api';
import { GameStatsService } from '../../../stats/public-api';
import { bestEffort } from '../../../common/utils/public-api';
import type {
  RoomLeaveOptions,
  RoomMembershipContext,
} from '../models/room-membership-context.model';
import type { RoomRecord } from '../models/room-record.model';
import {
  ROOM_EVENT_PUBLISHER,
  type RoomEventPublisherPort,
} from '../ports/room-event-publisher.port';
import {
  ROOM_PARTICIPANT_REPOSITORY,
  type RoomParticipantRepository,
} from '../ports/room-participant.repository';
import { ROOM_REPOSITORY, type RoomRepository } from '../ports/room.repository';
import { isStartedRoom } from './room-membership.utils';
import { RoomEmptyCleanupService } from './room-empty-cleanup.service';

@Injectable()
export class RoomLeaveService {
  constructor(
    @Inject(ROOM_REPOSITORY)
    private readonly rooms: RoomRepository,
    @Inject(ROOM_PARTICIPANT_REPOSITORY)
    private readonly participants: RoomParticipantRepository,
    private readonly addSystemBot: AddSystemBotToRoomService,
    private readonly presence: PresenceService,
    private readonly stats: GameStatsService,
    @Inject(ROOM_EVENT_PUBLISHER)
    private readonly events: RoomEventPublisherPort,
    private readonly emptyCleanup: RoomEmptyCleanupService,
  ) {}

  async leave(
    context: RoomMembershipContext,
    roomId: number,
    userId: number,
    options?: RoomLeaveOptions,
  ): Promise<RoomRecord | null> {
    const room = await context.requireRoom(roomId);
    const user = await context.requireUser(userId);
    const participant = await this.participants.findActiveByRoomAndUser(
      room.id,
      user.id,
    );
    if (options?.disconnectOnly) {
      this.presence.broadcastPresence();
      return room;
    }
    if (participant) {
      participant.leftAt = new Date();
      await this.participants.save(participant);
    }
    await context.invalidateRoomPayloadCache(room.id);
    if (
      await this.emptyCleanup.abandonRestoredRoomIfEmpty(
        context,
        room,
        userId,
        Boolean(participant),
      )
    ) {
      return null;
    }
    await this.recordQuit(room, user.id, Boolean(participant));
    await this.transferOwnership(context, room, userId, options);
    await this.replacePlayerWithBot(
      context,
      room,
      Boolean(participant),
      options,
    );
    if (options?.preserveRoom) {
      await this.notifyLeft(room.id);
      return room;
    }
    if (await this.emptyCleanup.deleteRoomIfEmpty(context, room, userId)) {
      return null;
    }
    await this.notifyLeft(room.id);
    return room;
  }

  private async recordQuit(
    room: RoomRecord,
    userId: number,
    participantLeft: boolean,
  ): Promise<void> {
    if (participantLeft && isStartedRoom(room)) {
      await bestEffort(
        this.stats.markQuit(room.id, userId),
        `statistique de départ room=${room.id} user=${userId}`,
      );
    }
  }

  private async transferOwnership(
    context: RoomMembershipContext,
    room: RoomRecord,
    userId: number,
    options?: RoomLeaveOptions,
  ): Promise<void> {
    if (room.owner?.id !== userId || options?.preserveOwner === true) {
      return;
    }
    const next = await this.participants.findFirstActiveByRoomWithUser(room.id);
    if (next?.user) {
      room.owner = next.user;
      await this.rooms.save(room);
      await context.invalidateRoomPayloadCache(room.id);
    }
  }

  private async replacePlayerWithBot(
    context: RoomMembershipContext,
    room: RoomRecord,
    participantLeft: boolean,
    options?: RoomLeaveOptions,
  ): Promise<void> {
    if (
      !participantLeft ||
      !isStartedRoom(room) ||
      options?.replaceWithBot === false
    ) {
      return;
    }
    try {
      if ((await context.countActiveHumans(room.id)) > 0) {
        await this.addSystemBot.execute(room.id);
        await context.invalidateRoomPayloadCache(room.id);
      }
    } catch {
      // Bot replacement is best effort.
    }
  }

  private async notifyLeft(roomId: number): Promise<void> {
    this.presence.broadcastPresence();
    await this.events.publishLobbyChanged(roomId, 'left');
  }
}
