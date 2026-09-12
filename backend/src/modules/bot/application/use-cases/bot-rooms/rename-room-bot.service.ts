import type { BotRoomRepository } from '../../ports/bot-room.repository';

export class RenameRoomBotService {
  constructor(private readonly rooms: BotRoomRepository) {}

  async execute(botId: number, name: string): Promise<void> {
    const normalizedBotId =
      typeof botId === 'number' && Number.isSafeInteger(botId) ? botId : 0;
    const normalizedName = String(name ?? '')
      .trim()
      .slice(0, 150);

    if (normalizedBotId <= 0 || !normalizedName) {
      return;
    }

    await this.rooms.renameBot(normalizedBotId, normalizedName);
  }
}
