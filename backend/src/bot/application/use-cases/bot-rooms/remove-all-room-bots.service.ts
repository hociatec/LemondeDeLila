import type { BotRoomRepository } from '../../ports/bot-room.repository';

export class RemoveAllRoomBotsService {
  constructor(private readonly rooms: BotRoomRepository) {}

  execute(roomId: number): Promise<void> {
    return this.rooms.deleteAllBotsForRoom(roomId);
  }
}
