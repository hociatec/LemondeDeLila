import type { BotRoomRepository } from '../../ports/bot-room.repository';
import type { BotRoomRecord } from '../../models/bot-room.record';
import { BotNameSelectionService } from '../bot-names/bot-name-selection.service';
import { BotRoomPolicyService } from './bot-room-policy.service';

export class AddBotToRoomService {
  constructor(
    private readonly rooms: BotRoomRepository,
    private readonly names: BotNameSelectionService,
    private readonly policy: BotRoomPolicyService,
  ) {}

  async execute(roomId: number, userId: number): Promise<BotRoomRecord> {
    const room = this.policy.requireRoom(await this.rooms.findRoomById(roomId));
    this.policy.ensureOwner(room, userId);
    this.policy.ensureRoomOpen(room);

    const [humans, existingBots] = await Promise.all([
      this.rooms.countActiveHumansForRoom(room.id),
      this.rooms.listBotsForRoom(room.id),
    ]);
    this.policy.ensureCapacity(room, humans, existingBots.length);

    const name = await this.names.pickName(existingBots);
    return this.rooms.createBot({ roomId: room.id, name });
  }
}
