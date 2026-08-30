import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RoomLobbyRepository } from '../../../../application/ports/room-lobby.repository';
import type { RoomRecord } from '../../../../application/contracts/room-record.model';
import { OPEN_ROOM_STATUSES } from '../../../../application/contracts/room-status.model';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { toRoomRecord } from './room-typeorm.mappers';

@Injectable()
export class RoomLobbyTypeormRepository implements RoomLobbyRepository {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  async listPublicRooms(filters?: {
    gameType?: string | null;
  }): Promise<RoomRecord[]> {
    const statuses = OPEN_ROOM_STATUSES.map((status) => status.toLowerCase());
    const qb = this.rooms
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.owner', 'owner')
      .leftJoinAndSelect(
        'room.participants',
        'participant',
        'participant.leftAt IS NULL',
      )
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('room.bots', 'bot')
      .where('room.isPrivate = :isPrivate', { isPrivate: false })
      .andWhere(
        '(room.startedAt IS NOT NULL OR LOWER(room.status) IN (:...statuses))',
        { statuses },
      )
      .limit(500);

    if (filters?.gameType) {
      qb.andWhere('room.gameType = :gameType', { gameType: filters.gameType });
    }

    return (await qb.getMany())
      .map((room) => toRoomRecord(room))
      .filter((room): room is RoomRecord => room !== null);
  }

  async findRoomWithOwner(roomId: number): Promise<RoomRecord | null> {
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id: roomId },
        relations: { owner: true },
      }),
    );
  }

  async hasActiveParticipant(roomId: number, userId: number): Promise<boolean> {
    const participant = await this.participants.findOne({
      where: {
        room: { id: roomId },
        user: { id: userId },
        leftAt: IsNull(),
      },
      select: { id: true },
    });
    return Boolean(participant);
  }

  async listActiveParticipantUserIds(roomId: number): Promise<number[]> {
    const rows = await this.participants
      .createQueryBuilder('p')
      .select('p.user_id', 'userId')
      .where('p.room_id = :roomId', { roomId })
      .andWhere('p.left_at IS NULL')
      .limit(500)
      .getRawMany<{ userId: number }>();

    return rows
      .map((row) => Number(row.userId))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
}
