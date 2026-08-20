import type { BotRoomRepository } from '../../ports/bot-room.repository';

export class CountRoomBotsService {
  constructor(private readonly rooms: BotRoomRepository) {}

  execute(roomId: number): Promise<number> {
    return this.rooms.countBotsForRoom(roomId);
  }
}
