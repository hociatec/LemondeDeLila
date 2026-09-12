import type { BotRoomRepository } from '../../ports/bot-room.repository';
import type { BotRoomRecord } from '../../read-models/bot-room.record';
import { BotNameSelectionService } from '../bot-names/bot-name-selection.service';
import { BotRoomPolicyService } from './bot-room-policy.service';

export class AddSystemBotToRoomService {
  constructor(
    private readonly rooms: BotRoomRepository,
    private readonly names: BotNameSelectionService,
    private readonly policy: BotRoomPolicyService,
  ) {}

  async execute(roomId: number): Promise<BotRoomRecord> {
    return this.rooms.runRoomMutation(roomId, (rooms) =>
      this.executeLocked(rooms, roomId),
    );
  }

  private async executeLocked(
    rooms: BotRoomRepository,
    roomId: number,
  ): Promise<BotRoomRecord> {
    this.policy.requireAllowed(
      await rooms.assessBotMutation(roomId, { kind: 'restore' }),
    );
    const existingBots = await rooms.listBotsForRoom(roomId);
    const name = await this.names.pickName(existingBots);
    return rooms.createBot({ roomId: roomId, name });
  }
}
