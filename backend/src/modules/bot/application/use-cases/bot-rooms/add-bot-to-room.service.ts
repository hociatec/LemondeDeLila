import type { BotRoomRepository } from '../../ports/bot-room.repository';
import type { BotRoomRecord } from '../../contracts/bot-room.record';
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
    const room = this.policy.requireRoom(await rooms.findRoomById(roomId));
    this.policy.ensureOwner(room, userId);
    this.policy.ensureRoomOpen(room);

    const [humans, existingBots] = await Promise.all([
      rooms.countActiveHumansForRoom(room.id),
      rooms.listBotsForRoom(room.id),
    ]);
    this.policy.ensureCapacity(room, humans, existingBots.length);

    const name = await this.names.pickName(existingBots);
    return rooms.createBot({ roomId: room.id, name });
  }
}
