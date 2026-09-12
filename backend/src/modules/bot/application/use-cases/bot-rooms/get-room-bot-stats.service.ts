import type { BotRoomReader } from '../../ports/bot-room-reader.port';

export class GetRoomBotStatsService {
  constructor(private readonly rooms: BotRoomReader) {}

  async execute(roomId: number) {
    const total = await this.rooms.countBotsForRoom(roomId);
    return { roomId, total };
  }
}
