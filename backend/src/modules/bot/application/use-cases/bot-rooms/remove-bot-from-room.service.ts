import type { BotRoomRepository } from '../../ports/bot-room.repository';
import { BotNotFoundError } from '../../errors/bot-application.errors';
import type { BotRoomRecord } from '../../read-models/bot-room.record';
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
    return this.rooms.runRoomMutation(roomId, (rooms) =>
      this.executeLocked(rooms, roomId, userId, botId),
    );
  }

  private async executeLocked(
    rooms: BotRoomRepository,
    roomId: number,
    userId: number,
    botId: number,
  ): Promise<BotRoomRecord> {
    this.policy.requireAllowed(
      await rooms.assessBotMutation(roomId, {
        kind: 'remove',
        actorId: userId,
      }),
    );
    const bot = await rooms.findBotById(roomId, botId);
    if (!bot) {
      throw new BotNotFoundError();
    }
    await rooms.deleteBot(bot.id);
    return bot;
  }
}
