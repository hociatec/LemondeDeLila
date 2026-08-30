import type { BotRoomRepository } from '../../ports/bot-room.repository';
import type { BotRoomRecord } from '../../contracts/bot-room.record';

export class GetLastRoomBotService {
  constructor(private readonly rooms: BotRoomRepository) {}

  execute(roomId: number): Promise<BotRoomRecord | null> {
    return this.rooms.findLastBotForRoom(roomId);
  }
}
