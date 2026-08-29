import { Injectable } from '@nestjs/common';
import { BotApplicationError } from '../../../bot/public-api';
import { AddSystemBotToRoomService } from '../../../bot/public-api';
import { RenameRoomBotService } from '../../../bot/public-api';
import type { VaultBotPort } from '../../application/ports/vault-bot.port';

@Injectable()
export class VaultBotAdapter implements VaultBotPort {
  constructor(
    private readonly addSystemBotToRoom: AddSystemBotToRoomService,
    private readonly renameRoomBot: RenameRoomBotService,
  ) {}

  async addSystemBot(roomId: number): Promise<{ id: number }> {
    try {
      const bot = await this.addSystemBotToRoom.execute(roomId);
      return { id: bot.id };
    } catch (error) {
      if (error instanceof BotApplicationError) {
        throw error;
      }
      throw error;
    }
  }

  renameBot(botId: number, name: string): Promise<void> {
    return this.renameRoomBot.execute(botId, name);
  }
}
