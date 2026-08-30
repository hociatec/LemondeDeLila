import type { RoomBotRecord } from '../../../../application/contracts/room-bot.model';
import type { RoomParticipantRecord } from '../../../../application/contracts/room-participant.model';
import type { RoomRecord } from '../../../../application/contracts/room-record.model';
import type { RoomUserRecord } from '../../../../application/contracts/room-user.model';
import { RoomBot } from '../entities/room-bot.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { Room } from '../entities/room.entity';
import { User } from '../../../../../user/public-api';

export function toRoomUserRecord(
  user: User | null | undefined,
): RoomUserRecord | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    roles: Array.isArray(user.roles) ? [...user.roles] : [],
  };
}

export function toRoomBotRecord(
  bot: RoomBot | null | undefined,
): RoomBotRecord | null {
  if (!bot) {
    return null;
  }

  return {
    id: bot.id,
    name: bot.name,
  };
}

export function toRoomParticipantRecord(
  participant: RoomParticipant | null | undefined,
): RoomParticipantRecord | null {
  const user = toRoomUserRecord(participant?.user);
  if (!participant || !user) {
    return null;
  }

  return {
    id: participant.id,
    room: participant.room
      ? {
          id: participant.room.id,
          gameType: participant.room.gameType,
        }
      : null,
    user,
    role: participant.role,
    joinedAt: participant.joinedAt ?? null,
    leftAt: participant.leftAt ?? null,
  };
}

export function toRoomRecord(room: Room | null | undefined): RoomRecord | null {
  if (!room) {
    return null;
  }

  return {
    id: room.id,
    name: room.name,
    gameType: room.gameType,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    status: room.status,
    owner: toRoomUserRecord(room.owner ?? null),
    createdAt: room.createdAt,
    startedAt: room.startedAt ?? null,
    runId: room.runId,
    tableAmbienceSoundId: room.tableAmbienceSoundId ?? null,
    restoredFromSnapshotId: room.restoredFromSnapshotId ?? null,
    restoredOwnerUserId: room.restoredOwnerUserId ?? null,
    participants: Array.isArray(room.participants)
      ? room.participants
          .map((participant) => toRoomParticipantRecord(participant))
          .filter(
            (participant): participant is RoomParticipantRecord =>
              participant !== null,
          )
      : [],
    bots: Array.isArray(room.bots)
      ? room.bots
          .map((bot) => toRoomBotRecord(bot))
          .filter((bot): bot is RoomBotRecord => bot !== null)
      : [],
  };
}

export function toRoomEntity(room: RoomRecord): Partial<Room> {
  const owner = room.owner
    ? ({
        id: room.owner.id,
      } as User)
    : null;

  return {
    id: room.id > 0 ? room.id : undefined,
    name: room.name,
    gameType: room.gameType,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    status: room.status,
    owner,
    createdAt: room.createdAt,
    startedAt: room.startedAt,
    runId: room.runId,
    tableAmbienceSoundId: room.tableAmbienceSoundId,
    restoredFromSnapshotId: room.restoredFromSnapshotId,
    restoredOwnerUserId: room.restoredOwnerUserId,
  };
}

export function toRoomParticipantEntity(
  participant: RoomParticipantRecord,
): Partial<RoomParticipant> {
  return {
    id: participant.id > 0 ? participant.id : undefined,
    room: participant.room
      ? ({
          id: participant.room.id,
          gameType: participant.room.gameType,
        } as Room)
      : undefined,
    user: {
      id: participant.user.id,
    } as User,
    role: participant.role,
    joinedAt: participant.joinedAt ?? undefined,
    leftAt: participant.leftAt ?? null,
  };
}
