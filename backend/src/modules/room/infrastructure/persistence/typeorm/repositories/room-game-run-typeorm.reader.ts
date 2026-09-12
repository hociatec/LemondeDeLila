import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { RoomGameRunReader } from '../../../../application/ports/room-game-run-reader.port';
import { isCurrentRoomGameRun } from '../../../../application/services/lifecycle/room-game-run-policy';
import { Room } from '../entities/room.entity';

@Injectable()
export class RoomGameRunTypeormReader implements RoomGameRunReader {
  constructor(
    @InjectRepository(Room)
    private readonly rooms: Pick<Repository<Room>, 'findOne'>,
  ) {}

  async isCurrent(
    roomId: number,
    gameType: string,
    runId: number | null,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0)
      throw new RangeError('Invalid room identifier');
    const room = await this.rooms.findOne({
      where: { id: roomId },
      select: { id: true, gameType: true, status: true, runId: true },
      loadEagerRelations: false,
    });
    return isCurrentRoomGameRun(room, gameType, runId);
  }
}
