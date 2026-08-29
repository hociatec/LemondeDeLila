import type { BotRoomRepository } from '../../ports/bot-room.repository';

export class GetRoomBotStatsService {
  constructor(private readonly rooms: BotRoomRepository) {}

  async execute(roomId: number) {
    const total = await this.rooms.countBotsForRoom(roomId);
    return { roomId, total };
  }
}
