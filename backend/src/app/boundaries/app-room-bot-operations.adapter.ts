import { Injectable } from '@nestjs/common';
import {
  AddSystemBotToRoomService,
  RemoveAllRoomBotsService,
} from '../../modules/bot/public-api';
import type { RoomBotOperationsPort } from '../../modules/room/public-api';

@Injectable()
export class AppRoomBotOperationsAdapter implements RoomBotOperationsPort {
  constructor(
    private readonly addBot: AddSystemBotToRoomService,
    private readonly removeBots: RemoveAllRoomBotsService,
  ) {}

  async addSystemBot(roomId: number): Promise<void> {
    await this.addBot.execute(roomId);
  }

  async removeAll(roomId: number): Promise<void> {
    await this.removeBots.execute(roomId);
  }
}
