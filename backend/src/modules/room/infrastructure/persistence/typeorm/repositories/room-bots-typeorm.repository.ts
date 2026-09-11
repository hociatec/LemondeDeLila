import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoomBot } from '../entities/room-bot.entity';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { IsNull, Repository } from 'typeorm';
import type {
  RoomBotsRepository,
  CreateBotForRoomInput,
} from '../../../../application/ports/room-bots.repository';
import type {
  BotManagedRoomRecord,
  BotRoomRecord,
} from '../../../../application/read-models/room-bot.record';

@Injectable()
export class RoomBotsTypeormRepository implements RoomBotsRepository {
  constructor(
    @InjectRepository(RoomBot)
    private readonly bots: Repository<RoomBot>,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  runRoomMutation<T>(
    roomId: number,
    operation: (rooms: RoomBotsRepository) => Promise<T>,
  ): Promise<T> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new RangeError('Identifiant de salle invalide');
    }
    return this.rooms.manager.transaction(async (manager) => {
      const transactionalRooms = manager.getRepository(this.rooms.target);
      await transactionalRooms.findOne({
        where: { id: roomId },
        lock: { mode: 'pessimistic_write' },
      });
      const transactionalRepository = new RoomBotsTypeormRepository(
        manager.getRepository(this.bots.target),
        transactionalRooms,
        manager.getRepository(this.participants.target),
      );
      return operation(transactionalRepository);
    });
  }

  async findRoomById(roomId: number): Promise<BotManagedRoomRecord | null> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return null;
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: { owner: true },
    });
    if (!room) {
      return null;
    }
    return {
      id: room.id,
      maxPlayers: room.maxPlayers,
      status: room.status,
      ownerId: room.owner?.id ?? null,
      startedAt: room.startedAt ?? null,
    };
  }

  async listBotsForRoom(roomId: number): Promise<BotRoomRecord[]> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return [];
    const rows = await this.bots.find({
      where: { room: { id: roomId } },
      order: { id: 'ASC' },
      take: 100,
    });
    return rows.map((row) => this.toBotRecord(row));
  }

  async createBot(input: CreateBotForRoomInput): Promise<BotRoomRecord> {
    if (
      !Number.isSafeInteger(input.roomId) ||
      input.roomId <= 0 ||
      typeof input.name !== 'string' ||
      !input.name.trim() ||
      input.name.length > 150
    ) {
      throw new RangeError('Parametres bot invalides');
    }
    const entity = this.bots.create({
      room: { id: input.roomId },
      name: input.name,
    });
    const saved = await this.bots.save(entity);
    return this.toBotRecord(saved);
  }

  async findBotById(
    roomId: number,
    botId: number,
  ): Promise<BotRoomRecord | null> {
    if (
      !Number.isSafeInteger(roomId) ||
      roomId <= 0 ||
      !Number.isSafeInteger(botId) ||
      botId <= 0
    )
      return null;
    const row = await this.bots.findOne({
      where: { id: botId, room: { id: roomId } },
    });
    return row ? this.toBotRecord(row) : null;
  }

  async findLastBotForRoom(roomId: number): Promise<BotRoomRecord | null> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return null;
    const row = await this.bots.findOne({
      where: { room: { id: roomId } },
      order: { id: 'DESC' },
    });
    return row ? this.toBotRecord(row) : null;
  }

  async renameBot(botId: number, name: string): Promise<void> {
    if (
      !Number.isSafeInteger(botId) ||
      botId <= 0 ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 150
    )
      return;
    await this.bots.save({
      id: botId,
      name,
    });
  }

  async deleteBot(botId: number): Promise<void> {
    if (!Number.isSafeInteger(botId) || botId <= 0) return;
    await this.bots.delete(botId);
  }

  async deleteAllBotsForRoom(roomId: number): Promise<void> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return;
    await this.bots
      .createQueryBuilder()
      .delete()
      .where('room_id = :roomId', { roomId })
      .execute();
  }

  countBotsForRoom(roomId: number): Promise<number> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return Promise.resolve(0);
    return this.bots.count({ where: { room: { id: roomId } } });
  }

  countActiveHumansForRoom(roomId: number): Promise<number> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return Promise.resolve(0);
    return this.participants.count({
      where: { room: { id: roomId }, leftAt: IsNull() },
    });
  }

  private toBotRecord(entity: RoomBot): BotRoomRecord {
    return {
      id: entity.id,
      name: entity.name,
      createdAt: entity.createdAt,
    };
  }
}
