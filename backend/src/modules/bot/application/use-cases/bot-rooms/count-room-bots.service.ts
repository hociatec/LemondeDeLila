import type { BotRoomReader } from '../../ports/bot-room-reader.port';

export class CountRoomBotsService {
  constructor(private readonly rooms: BotRoomReader) {}

  execute(roomId: number): Promise<number> {
    return this.rooms.countBotsForRoom(roomId);
  }
}
