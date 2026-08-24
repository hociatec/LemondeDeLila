import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import type { PresenceRoomParticipantRepository } from '../../../../application/ports/presence-room-participant.repository';
import type { PresenceActiveRoomParticipant } from '../../../../application/models/presence-active-room-participant.model';
import { RoomParticipant } from '../../../../../room/infrastructure/persistence/typeorm/entities/room-participant.entity';

@Injectable()
export class PresenceRoomParticipantTypeormRepository
  implements PresenceRoomParticipantRepository
{
  constructor(
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  async listActiveRoomsByUserIds(
    userIds: number[],
  ): Promise<PresenceActiveRoomParticipant[]> {
    const normalizedUserIds = userIds.filter(
      (userId) => Number.isFinite(userId) && userId > 0,
    );
    if (normalizedUserIds.length === 0) {
      return [];
    }

    const participants = await this.participants.find({
      where: {
        leftAt: IsNull(),
        user: { id: In(normalizedUserIds) },
      } as FindOptionsWhere<RoomParticipant>,
      relations: ['room', 'user'],
      order: { joinedAt: 'DESC' },
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
