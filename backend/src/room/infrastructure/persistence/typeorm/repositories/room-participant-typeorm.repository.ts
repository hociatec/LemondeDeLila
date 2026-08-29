import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type {
  RoomParticipantCreateRecord,
  RoomParticipantRepository,
} from '../../../../application/ports/room-participant.repository';
import type { RoomParticipantRecord } from '../../../../application/models/room-participant.model';
import { RoomParticipant } from '../entities/room-participant.entity';
import {
  toRoomParticipantEntity,
  toRoomParticipantRecord,
} from './room-typeorm.mappers';

@Injectable()
export class RoomParticipantTypeormRepository implements RoomParticipantRepository {
  constructor(
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  create(data: RoomParticipantCreateRecord): RoomParticipantRecord {
    return {
      id: data.id ?? 0,
      room: data.room ?? null,
      user: data.user,
      role: data.role ?? 'player',
      joinedAt: data.joinedAt ?? null,
      leftAt: data.leftAt ?? null,
    };
  }

  async save(
    participant: RoomParticipantRecord,
  ): Promise<RoomParticipantRecord> {
    const saved = await this.participants.save(
      this.participants.create(toRoomParticipantEntity(participant)),
    );
    return (
      toRoomParticipantRecord(
        await this.participants.findOne({
          where: { id: saved.id },
          relations: { room: true, user: true },
        }),
      ) ?? participant
    );
  }

  async countActiveByRoom(roomId: number): Promise<number> {
    const result = await this.participants
      .createQueryBuilder('participant')
      .select('COUNT(DISTINCT participant.user_id)', 'count')
      .where('participant.room_id = :roomId', { roomId })
      .andWhere('participant.left_at IS NULL')
      .andWhere('LOWER(participant.role) IN (:...roles)', {
        roles: ['owner', 'player', 'participant'],
      })
      .getRawOne<{ count?: string | number }>();
    const count = Number(result?.count ?? 0);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  }

  async findActiveByRoomAndUser(
    roomId: number,
    userId: number,
  ): Promise<RoomParticipantRecord | null> {
    return toRoomParticipantRecord(
      await this.participants.findOne({
        where: { room: { id: roomId }, user: { id: userId }, leftAt: IsNull() },
        relations: { room: true, user: true },
      }),
    );
  }

  async findActiveByRoomWithUsers(
    roomId: number,
  ): Promise<RoomParticipantRecord[]> {
    return (
      await this.participants.find({
        where: { room: { id: roomId }, leftAt: IsNull() },
        relations: { room: true, user: true },
        take: 100,
      })
    )
      .map((participant) => toRoomParticipantRecord(participant))
      .filter(
        (participant): participant is RoomParticipantRecord =>
          participant !== null,
      );
  }

  async findFirstActiveByRoomWithUser(
    roomId: number,
  ): Promise<RoomParticipantRecord | null> {
    return toRoomParticipantRecord(
      await this.participants.findOne({
        where: { room: { id: roomId }, leftAt: IsNull() },
        relations: { room: true, user: true },
        order: { joinedAt: 'ASC' },
      }),
    );
  }

  async findActiveByUserWithRooms(
    userId: number,
  ): Promise<RoomParticipantRecord[]> {
    return (
      await this.participants.find({
        where: { user: { id: userId }, leftAt: IsNull() },
        relations: { room: true, user: true },
        take: 100,
      })
    )
      .map((participant) => toRoomParticipantRecord(participant))
      .filter(
        (participant): participant is RoomParticipantRecord =>
          participant !== null,
      );
  }

  async findLatestActiveRoomForUser(
    userId: number,
  ): Promise<{ roomId: number; gameType: string } | null> {
    const startedParticipation = await this.participants
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.room', 'r')
      .where('p.user_id = :userId', { userId })
      .andWhere('p.left_at IS NULL')
      .andWhere('(r.started_at IS NOT NULL OR LOWER(r.status) = :started)', {
        started: 'started',
      })
      .orderBy('p.joined_at', 'DESC')
      .getOne();

    const participation =
      startedParticipation ??
      (await this.participants.findOne({
        where: { user: { id: userId }, leftAt: IsNull() },
        relations: { room: true },
        order: { joinedAt: 'DESC' },
      }));

    const roomId = participation?.room?.id ?? 0;
    const gameType = String(participation?.room?.gameType ?? '').trim();
    if (!Number.isFinite(roomId) || roomId <= 0 || !gameType) {
      return null;
    }
    return { roomId, gameType };
  }

  async createForRoom(
    roomId: number,
    userId: number,
    role: string,
  ): Promise<void> {
    const participant = this.participants.create({
      room: { id: roomId },
      user: { id: userId },
      role,
    });
    await this.participants.save(participant);
  }
}
