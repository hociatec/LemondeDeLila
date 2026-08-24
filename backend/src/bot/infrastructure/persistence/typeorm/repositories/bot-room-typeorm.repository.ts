import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type {
  BotRoomRepository,
  CreateBotForRoomInput,
} from '../../../../application/ports/bot-room.repository';
import type {
  BotManagedRoomRecord,
  BotRoomRecord,
} from '../../../../application/models/bot-room.record';
import { RoomBot } from '../../../../../room/infrastructure/persistence/typeorm/entities/room-bot.entity';
import { RoomParticipant } from '../../../../../room/infrastructure/persistence/typeorm/entities/room-participant.entity';
import { Room } from '../../../../../room/infrastructure/persistence/typeorm/entities/room.entity';

@Injectable()
export class BotRoomTypeormRepository implements BotRoomRepository {
  constructor(
    @InjectRepository(RoomBot)
    private readonly bots: Repository<RoomBot>,
    @InjectRepository(Room)
    private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
  ) {}

  async findRoomById(roomId: number): Promise<BotManagedRoomRecord | null> {
    const room = await this.rooms.findOne({
      where: { id: roomId },
      relations: ['owner'],
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
    const rows = await this.bots.find({ where: { room: { id: roomId } } });
    return rows.map((row) => this.toBotRecord(row));
  }

  async createBot(input: CreateBotForRoomInput): Promise<BotRoomRecord> {
    const entity = this.bots.create({
      room: { id: input.roomId } as Room,
      name: input.name,
    });
    const saved = await this.bots.save(entity);
    return this.toBotRecord(saved);
  }

  async findBotById(
    roomId: number,
    botId: number,
  ): Promise<BotRoomRecord | null> {
    const row = await this.bots.findOne({
      where: { id: botId, room: { id: roomId } },
    });
    return row ? this.toBotRecord(row) : null;
  }

  async findLastBotForRoom(roomId: number): Promise<BotRoomRecord | null> {
    const row = await this.bots.findOne({
      where: { room: { id: roomId } },
      order: { id: 'DESC' },
    });
    return row ? this.toBotRecord(row) : null;
  }

  async renameBot(botId: number, name: string): Promise<void> {
    await this.bots.save({
      id: botId,
      name,
    } as RoomBot);
  }

  async deleteBot(botId: number): Promise<void> {
    await this.bots.delete(botId);
  }

  async deleteAllBotsForRoom(roomId: number): Promise<void> {
    await this.bots
      .createQueryBuilder()
      .delete()
      .where('room_id = :roomId', { roomId })
      .execute();
  }

  countBotsForRoom(roomId: number): Promise<number> {
    return this.bots.count({ where: { room: { id: roomId } } });
  }

  countActiveHumansForRoom(roomId: number): Promise<number> {
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
