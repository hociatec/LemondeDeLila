import type { BotRoomReader } from '../../ports/bot-room-reader.port';
import type { BotRoomRecord } from '../../read-models/bot-room.record';

export class GetLastRoomBotService {
  constructor(private readonly rooms: BotRoomReader) {}

  execute(roomId: number): Promise<BotRoomRecord | null> {
    return this.rooms.findLastBotForRoom(roomId);
  }
}
