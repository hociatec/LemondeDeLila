import type { BotRoomRepository } from '../../ports/bot-room.repository';
import { BotNotFoundError } from '../../errors/bot-application.errors';
import type { BotRoomRecord } from '../../models/bot-room.record';
import { BotRoomPolicyService } from './bot-room-policy.service';

export class RemoveBotFromRoomService {
  constructor(
    private readonly rooms: BotRoomRepository,
    private readonly policy: BotRoomPolicyService,
  ) {}

  async execute(
    roomId: number,
    userId: number,
    botId: number,
  ): Promise<BotRoomRecord> {
    const room = this.policy.requireRoom(await this.rooms.findRoomById(roomId));
    this.policy.ensureOwner(room, userId);

    const [humans, bots] = await Promise.all([
      this.rooms.countActiveHumansForRoom(room.id),
      this.rooms.countBotsForRoom(room.id),
    ]);
    this.policy.ensureStartedRoomCanRemoveBot(room, humans, bots);

    const bot = await this.rooms.findBotById(room.id, botId);
    if (!bot) {
      throw new BotNotFoundError();
    }
    await this.rooms.deleteBot(bot.id);
    return bot;
  }
}
