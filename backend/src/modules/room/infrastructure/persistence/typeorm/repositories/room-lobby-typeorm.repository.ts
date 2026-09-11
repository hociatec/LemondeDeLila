import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RoomLobbyRepository } from '../../../../application/ports/room-lobby.repository';
import type { RoomRecord } from '../../../../application/models/room-record.model';
import { OPEN_ROOM_STATUSES } from '../../../../application/models/room-status.model';
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
      .orderBy('room.id', 'ASC')
      .limit(500);

    if (
      typeof filters?.gameType === 'string' &&
      filters.gameType.trim() &&
      filters.gameType.length <= 128
    ) {
      qb.andWhere('room.gameType = :gameType', {
        gameType: filters.gameType.trim(),
      });
    }

    return (await qb.getMany())
      .map((room) => toRoomRecord(room))
      .filter((room): room is RoomRecord => room !== null);
  }

  async findRoomWithOwner(roomId: number): Promise<RoomRecord | null> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return null;
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id: roomId },
        relations: { owner: true },
      }),
    );
  }

  async hasActiveParticipant(roomId: number, userId: number): Promise<boolean> {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    )
      return false;
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
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return [];
    const rows = await this.participants
      .createQueryBuilder('p')
      .select('p.user_id', 'userId')
      .where('p.room_id = :roomId', { roomId })
      .andWhere('p.left_at IS NULL')
      .limit(500)
      .getRawMany<{ userId: number }>();

    const ids = new Set<number>();
    for (const row of rows) {
      const id = Number(row.userId);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      ids.add(id);
    }
    return Array.from(ids);
  }
}
