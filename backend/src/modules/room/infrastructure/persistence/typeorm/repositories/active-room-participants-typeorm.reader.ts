import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import type {
  ActiveRoomParticipantsReader,
  ActiveRoomParticipant,
} from '../../../../application/ports/active-room-participants-reader.port';
import { RoomParticipant } from '../entities/room-participant.entity';

@Injectable()
export class ActiveRoomParticipantsTypeormReader implements ActiveRoomParticipantsReader {
  constructor(
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  async listActiveRoomsByUserIds(
    userIds: number[],
  ): Promise<ActiveRoomParticipant[]> {
    const normalizedUserIds = Array.isArray(userIds)
      ? [
          ...new Set(
            userIds.filter(
              (userId) => Number.isSafeInteger(userId) && userId > 0,
            ),
          ),
        ].slice(0, 1_000)
      : [];
    if (normalizedUserIds.length === 0) {
      return [];
    }

    const participants = await this.participants.find({
      where: {
        leftAt: IsNull(),
        user: { id: In(normalizedUserIds) },
      },
      relations: { room: true, user: true },
      order: { joinedAt: 'DESC' },
      take: Math.min(1_000, normalizedUserIds.length * 10),
    });

    return participants.map((participant) => ({
      userId: participant.user.id,
      room: participant.room
        ? {
            id: participant.room.id,
            name: participant.room.name,
            status: participant.room.status ?? null,
            startedAt: participant.room.startedAt ?? null,
          }
        : null,
    }));
  }
}
