import type { BotManagedRoomRecord } from '../../read-models/room-bot.record';
import type {
  BotMutationRequest,
  BotMutationDecision,
} from '../../models/bot-mutation.model';
import { resolveRoomLifecycleState } from '../../models/room-lifecycle-state.model';

export function assessRoomBotMutation(
  room: BotManagedRoomRecord | null,
  request: BotMutationRequest,
  humans: number,
  bots: number,
): BotMutationDecision {
  if (!room) return 'room-not-found';
  if (request.kind !== 'restore' && room.ownerId !== request.actorId)
    return 'owner-required';
  const open = resolveRoomLifecycleState(room).kind === 'open';
  if (request.kind === 'add' && !open) return 'room-started';
  if (request.kind !== 'remove' && humans + bots >= room.maxPlayers)
    return 'room-full';
  if (request.kind === 'remove' && !open && humans + bots - 1 < 2)
    return 'minimum-participants';
  return 'allowed';
}
