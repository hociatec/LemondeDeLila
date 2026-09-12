import { BotRoomPolicyService } from './bot-room-policy.service';
import type { BotMutationDecision } from '../../models/bot-mutation.model';

it.each<[BotMutationDecision, string]>([
  ['room-not-found', 'BOT_ROOM_NOT_FOUND'],
  ['owner-required', 'BOT_ROOM_OWNER_REQUIRED'],
  ['room-started', 'BOT_ROOM_ALREADY_STARTED'],
  ['room-full', 'BOT_ROOM_FULL'],
  ['minimum-participants', 'BOT_MINIMUM_PARTICIPANTS'],
])('preserves the Bot error contract for %s', (decision, code) => {
  expect(() => new BotRoomPolicyService().requireAllowed(decision)).toThrow(
    expect.objectContaining({ code }),
  );
});

it('accepts the owning domain permission', () => {
  expect(() =>
    new BotRoomPolicyService().requireAllowed('allowed'),
  ).not.toThrow();
});
