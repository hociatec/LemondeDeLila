import {
  BUSINESS_CLOCK,
  type BusinessClock,
} from '../../../../../../shared/interfaces/public-api';
import { businessMsToDate } from '@shared/utils/public-api';
import { Inject, Injectable } from '@nestjs/common';
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
import {
  toRoomEntity,
  toRoomEntityPatch,
  toRoomRecord,
} from './room-typeorm.mappers';

@Injectable()
export class RoomTypeormRepository implements RoomRepository {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @Inject(BUSINESS_CLOCK) private readonly clock: BusinessClock,
  ) {}

  create(data: Partial<RoomRecord>): RoomRecord {
    if (
      data.id !== undefined &&
      (!Number.isSafeInteger(data.id) || data.id < 0)
    ) {
      throw new RangeError('Identifiant de salle invalide');
    }
    return {
      id: data.id ?? 0,
      name: typeof data.name === 'string' ? data.name.slice(0, 255) : '',
      gameType:
        typeof data.gameType === 'string' ? data.gameType.slice(0, 128) : '',
      maxPlayers:
        typeof data.maxPlayers === 'number' &&
        Number.isSafeInteger(data.maxPlayers)
          ? Math.max(1, Math.min(64, data.maxPlayers))
          : 4,
      isPrivate: data.isPrivate ?? false,
      status: data.status ?? 'setup',
      owner: data.owner ?? null,
      createdAt: data.createdAt ?? businessMsToDate(this.clock.now()),
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
    if (!Number.isSafeInteger(id) || id <= 0) return;
    await this.rooms.save(
      this.rooms.create({ id, ...toRoomEntityPatch(patch) }),
    );
  }

  async delete(ids: number | number[]): Promise<void> {
    const normalized = Array.isArray(ids)
      ? ids.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 1_000)
      : Number.isSafeInteger(ids) && ids > 0
        ? ids
        : null;
    if (
      normalized !== null &&
      (!Array.isArray(normalized) || normalized.length > 0)
    ) {
      await this.rooms.delete(normalized);
    }
  }

  async exists(id: number): Promise<boolean> {
    if (!Number.isSafeInteger(id) || id <= 0) return false;
    const existing = await this.rooms.findOne({
      where: { id },
      select: { id: true },
    });
    return Boolean(existing);
  }

  async findById(id: number): Promise<RoomRecord | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return toRoomRecord(await this.rooms.findOne({ where: { id } }));
  }

  async findByIdWithOwner(id: number): Promise<RoomRecord | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id },
        relations: { owner: true },
      }),
    );
  }

  async findByIdWithPayloadRelations(id: number): Promise<RoomRecord | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return toRoomRecord(
      await this.rooms.findOne({
        where: { id },
        select: {
          id: true,
          name: true,
          gameType: true,
          maxPlayers: true,
          isPrivate: true,
          status: true,
          createdAt: true,
          startedAt: true,
          runId: true,
          tableAmbienceSoundId: true,
          restoredFromSnapshotId: true,
          restoredOwnerUserId: true,
          owner: { id: true, username: true, roles: true },
          participants: {
            id: true,
            role: true,
            joinedAt: true,
            leftAt: true,
            user: { id: true, username: true, roles: true },
          },
          bots: { id: true, name: true },
        },
        relations: {
          owner: true,
          participants: { user: true },
          bots: true,
        },
      }),
    );
  }

  async togglePrivacyOwned(
    roomId: number,
    ownerUserId: number,
  ): Promise<RoomRecord | null> {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !Number.isSafeInteger(ownerUserId) ||
      ownerUserId <= 0
    )
      return null;
    return this.rooms.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Room);
      const room = await repository.findOne({
        where: { id: roomId },
        relations: { owner: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room || Number(room.owner?.id) !== ownerUserId) return null;
      room.isPrivate = !room.isPrivate;
      await repository.save(room);
      return toRoomRecord(
        await repository.findOne({
          where: { id: roomId },
          relations: {
            owner: true,
            participants: { user: true },
            bots: true,
          },
        }),
      );
    });
  }

  async listForAdmin(filters: ListRoomsFilters): Promise<RoomRecord[]> {
    const limit = Number.isSafeInteger(filters?.limit)
      ? Math.min(1_000, Math.max(1, filters.limit))
      : 100;
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
      .limit(limit);

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
    const limit = Number.isSafeInteger(filters?.limit)
      ? Math.min(1_000, Math.max(1, filters.limit))
      : 100;
    const qb = this.rooms
      .createQueryBuilder('room')
      .select(['room.id'])
      .orderBy('room.id', 'ASC')
      .limit(limit);

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
      const cutoff = new Date(
        this.clock.now() - filters.olderThanMinutes * 60_000,
      );
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
    if (
      !input ||
      typeof input.name !== 'string' ||
      input.name.length > 255 ||
      typeof input.gameType !== 'string' ||
      !input.gameType ||
      input.gameType.length > 128 ||
      !Number.isSafeInteger(input.maxPlayers) ||
      input.maxPlayers < 1 ||
      input.maxPlayers > 64 ||
      !input.owner ||
      !Number.isSafeInteger(input.owner.id) ||
      input.owner.id <= 0
    ) {
      throw new RangeError('Parametres de salle invalides');
    }
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
