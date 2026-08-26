import { Inject, Injectable } from '@nestjs/common';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import type { PresenceRoomParticipantRepository } from '../../../../application/ports/presence-room-participant.repository';
import type { PresenceActiveRoomParticipant } from '../../../../application/models/presence-active-room-participant.model';

export const PRESENCE_ROOM_PARTICIPANTS_TYPEORM_REPOSITORY = Symbol(
  'PRESENCE_ROOM_PARTICIPANTS_TYPEORM_REPOSITORY',
);

type PresenceRoomParticipantRow = {
  leftAt: Date | null;
  joinedAt: Date;
  user: { id: number };
  room: {
    id: number;
    name: string;
    status: string | null;
    startedAt: Date | null;
  } | null;
};

@Injectable()
export class PresenceRoomParticipantTypeormRepository implements PresenceRoomParticipantRepository {
  constructor(
    @Inject(PRESENCE_ROOM_PARTICIPANTS_TYPEORM_REPOSITORY)
    private readonly participants: Repository<PresenceRoomParticipantRow>,
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
      } as FindOptionsWhere<PresenceRoomParticipantRow>,
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
