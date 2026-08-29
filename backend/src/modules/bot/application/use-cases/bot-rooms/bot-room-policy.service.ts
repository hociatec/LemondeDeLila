import {
  BotMinimumParticipantsError,
  BotRoomAlreadyStartedError,
  BotRoomFullError,
  BotRoomNotFoundError,
  BotRoomOwnerRequiredError,
} from '../../errors/bot-application.errors';
import type { BotManagedRoomRecord } from '../../models/bot-room.record';
import { OPEN_BOT_MANAGED_ROOM_STATUSES } from '../../models/bot-room-status';

export class BotRoomPolicyService {
  requireRoom(room: BotManagedRoomRecord | null): BotManagedRoomRecord {
    if (!room) {
      throw new BotRoomNotFoundError();
    }
    return room;
  }

  ensureOwner(room: BotManagedRoomRecord, userId: number): void {
    if (room.ownerId !== userId) {
      throw new BotRoomOwnerRequiredError();
    }
  }

  ensureRoomOpen(room: BotManagedRoomRecord): void {
    if (!this.isRoomOpen(room)) {
      throw new BotRoomAlreadyStartedError();
    }
  }

  ensureCapacity(
    room: BotManagedRoomRecord,
    humans: number,
    bots: number,
  ): void {
    if (humans + bots >= room.maxPlayers) {
      throw new BotRoomFullError();
    }
  }

  ensureStartedRoomCanRemoveBot(
    room: BotManagedRoomRecord,
    humans: number,
    bots: number,
  ): void {
    if (this.isRoomOpen(room)) {
      return;
    }
    if (humans + bots - 1 < 2) {
      throw new BotMinimumParticipantsError();
    }
  }

  private isRoomOpen(room: BotManagedRoomRecord): boolean {
    if (room.startedAt) {
      return false;
    }
    const status = (room.status || '').toLowerCase();
    return OPEN_BOT_MANAGED_ROOM_STATUSES.includes(
      status as (typeof OPEN_BOT_MANAGED_ROOM_STATUSES)[number],
    );
  }
}
