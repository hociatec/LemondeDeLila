import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CleanupRoomsFilters,
  ListRoomsFilters,
  RoomRepository,
} from '../../../../application/ports/room.repository';
import type { RoomRecord } from '../../../../application/models/room-record.model';
import type { RoomUserRecord } from '../../../../application/models/room-user.model';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { toRoomEntity, toRoomRecord } from './room-typeorm.mappers';

@Injectable()
export class RoomTypeormRepository implements RoomRepository {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
  ) {}

  create(data: Partial<RoomRecord>): RoomRecord {
    return {
      id: data.id ?? 0,
      name: data.name ?? '',
      gameType: data.gameType ?? '',
      maxPlayers: data.maxPlayers ?? 4,
      isPrivate: data.isPrivate ?? false,
      status: data.status ?? 'setup',
      owner: data.owner ?? null,
      createdAt: data.createdAt ?? new Date(),
      startedAt: data.startedAt ?? null,
      runId: data.runId ?? 0,
      tableAmbienceSoundId: data.tableAmbienceSoundId ?? null,
      restoredFromSnapshotId: data.restoredFromSnapshotId ?? null,
      restoredOwnerUserId: data.restoredOwnerUserId ?? null,
      participants: data.participants ?? [],
      bots: data.bots ?? [],
    };
  }

  async save(room: RoomRecord): Promise<RoomRecord> {
    const saved = await this.rooms.save(this.rooms.create(toRoomEntity(room)));
    return (
      toRoomRecord(
        await this.rooms.findOne({
          where: { id: saved.id },
          relations: {
            owner: true,
            participants: { user: true },
            bots: true,
          },
        }),
      ) ?? room
    );
  }

  async update(id: number, patch: Partial<RoomRecord>): Promise<void> {
    await this.rooms.save(
      this.rooms.create(toRoomEntity(this.create({ ...patch, id }))),
    );
  }

  async delete(ids: number | number[]): Promise<void> {
    await this.rooms.delete(ids);
  }

  async exists(id: number): Promise<boolean> {
    const existing = await this.rooms.findOne({
      where: { id },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async findById(id: number): Promise<RoomRecord | null> {
    return toRoomRecord(await this.rooms.findOne({ where: { id } }));
  }

  async findByIdWithOwner(id: number): Promise<RoomRecord | null> {
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id },
        relations: { owner: true },
      }),
    );
  }

  async findByIdWithPayloadRelations(id: number): Promise<RoomRecord | null> {
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id },
        relations: {
          owner: true,
          participants: { user: true },
          bots: true,
        },
      }),
    );
  }

  async listForAdmin(filters: ListRoomsFilters): Promise<RoomRecord[]> {
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
      .orderBy('room.id', 'DESC')
      .limit(filters.limit);

    if (!filters.includePrivate) {
      qb.where('room.isPrivate = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!filters.includeStarted) {
      qb.andWhere('room.startedAt IS NULL');
    }

    return (await qb.getMany())
      .map((room) => toRoomRecord(room))
      .filter((room): room is RoomRecord => room !== null);
  }

  async listCleanupCandidateIds(
    filters: CleanupRoomsFilters,
  ): Promise<number[]> {
    const qb = this.rooms
      .createQueryBuilder('room')
      .select(['room.id'])
      .orderBy('room.id', 'ASC')
      .limit(filters.limit);

    if (!filters.includePrivate) {
      qb.where('room.is_private = :isPrivate', { isPrivate: false });
    } else {
      qb.where('1=1');
    }

    if (!filters.includeStarted) {
      qb.andWhere('room.started_at IS NULL');
      qb.andWhere('room.status IN (:...statuses)', {
        statuses: ['setup', 'waiting', 'ready'],
      });
    }

    if (filters.olderThanMinutes) {
      const cutoff = new Date(Date.now() - filters.olderThanMinutes * 60_000);
      qb.andWhere('room.created_at < :cutoff', { cutoff });
    }

    const rows = await qb.getRawMany<{ room_id: number }>();
    return rows
      .map((row) => Number(row.room_id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  async createOwnedRoom(input: {
    name: string;
    gameType: string;
    maxPlayers: number;
    isPrivate: boolean;
    status: string;
    owner: RoomUserRecord;
    createdAt: Date;
  }): Promise<RoomRecord> {
    const room = await this.rooms.manager.transaction(async (manager) => {
      const roomRepo = manager.getRepository(Room);
      const participantRepo = manager.getRepository(RoomParticipant);

      const room = roomRepo.create({
        name: input.name,
        gameType: input.gameType,
        maxPlayers: input.maxPlayers,
        isPrivate: input.isPrivate,
        status: input.status,
        owner: { id: input.owner.id },
        createdAt: input.createdAt,
      });
      await roomRepo.save(room);

      const participant = participantRepo.create({
        room,
        user: { id: input.owner.id },
        role: 'owner',
      });
      await participantRepo.save(participant);

      return room;
    });

    return (
      toRoomRecord(
        await this.rooms.findOne({
          where: { id: room.id },
          relations: {
            owner: true,
            participants: { user: true },
            bots: true,
          },
        }),
      ) ?? {
        id: room.id,
        name: input.name,
        gameType: input.gameType,
        maxPlayers: input.maxPlayers,
        isPrivate: input.isPrivate,
        status: input.status,
        owner: input.owner,
        createdAt: input.createdAt,
        startedAt: null,
        runId: 0,
        tableAmbienceSoundId: null,
        restoredFromSnapshotId: null,
        restoredOwnerUserId: null,
        participants: [],
        bots: [],
      }
    );
  }
}
