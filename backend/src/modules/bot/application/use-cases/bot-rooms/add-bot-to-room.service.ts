import type { BotRoomRepository } from '../../ports/bot-room.repository';
import type { BotRoomRecord } from '../../read-models/bot-room.record';
import { BotNameSelectionService } from '../bot-names/bot-name-selection.service';
import { BotRoomPolicyService } from './bot-room-policy.service';

export class AddBotToRoomService {
  constructor(
    private readonly rooms: BotRoomRepository,
    private readonly names: BotNameSelectionService,
    private readonly policy: BotRoomPolicyService,
  ) {}

  async execute(roomId: number, userId: number): Promise<BotRoomRecord> {
    return this.rooms.runRoomMutation(roomId, (rooms) =>
      this.executeLocked(rooms, roomId, userId),
    );
  }

  private async executeLocked(
    rooms: BotRoomRepository,
    roomId: number,
    userId: number,
  ): Promise<BotRoomRecord> {
    this.policy.requireAllowed(
      await rooms.assessBotMutation(roomId, { kind: 'add', actorId: userId }),
    );
    const existingBots = await rooms.listBotsForRoom(roomId);
    const name = await this.names.pickName(existingBots);
    return rooms.createBot({ roomId: roomId, name });
  }
}
