import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import type { RoomPayloadRecord } from '../../../../application/read-models/room-payload.record';
import type { RoomPayloadReader } from '../../../../application/ports/room-payload.reader';
import { RoomBot } from '../entities/room-bot.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { Room } from '../entities/room.entity';

@Injectable()
export class RoomPayloadTypeormReader implements RoomPayloadReader {
  constructor(
    @InjectRepository(Room) private readonly rooms: Repository<Room>,
    @InjectRepository(RoomParticipant)
    private readonly participants: Repository<RoomParticipant>,
    @InjectRepository(RoomBot) private readonly bots: Repository<RoomBot>,
  ) {}

  async findPayload(roomId: number): Promise<RoomPayloadRecord | null> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) return null;
    const room = await this.rooms.findOne({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        gameType: true,
        maxPlayers: true,
        isPrivate: true,
        status: true,
        startedAt: true,
        runId: true,
        tableAmbienceSoundId: true,
        owner: { id: true, username: true },
      },
      relations: { owner: true },
    });
    if (!room) return null;

    const [participants, bots] = await Promise.all([
      this.participants.find({
        where: { room: { id: roomId }, leftAt: IsNull() },
        select: {
          role: true,
          leftAt: true,
          user: { id: true, username: true },
        },
        relations: { user: true },
        order: { joinedAt: 'ASC', id: 'ASC' },
        take: 64,
      }),
      this.bots.find({
        where: { room: { id: roomId } },
        select: { id: true, name: true },
        order: { id: 'ASC' },
        take: 64,
      }),
    ]);

    return {
      id: room.id,
      name: room.name,
      gameType: room.gameType,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      status: room.status,
      startedAt: room.startedAt ?? null,
      runId: room.runId,
      tableAmbienceSoundId: room.tableAmbienceSoundId ?? null,
      owner: room.owner
        ? { id: room.owner.id, username: room.owner.username }
        : null,
      participants: participants.map((participant) => ({
        role: participant.role,
        leftAt: participant.leftAt ?? null,
        user: {
          id: participant.user.id,
          username: participant.user.username,
        },
      })),
      bots: bots.map((bot) => ({ id: bot.id, name: bot.name })),
    };
  }
}
