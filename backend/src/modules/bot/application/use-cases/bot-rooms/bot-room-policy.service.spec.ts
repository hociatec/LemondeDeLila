import {
  BotMinimumParticipantsError,
  BotRoomAlreadyStartedError,
  BotRoomFullError,
  BotRoomOwnerRequiredError,
} from '../../errors/bot-application.errors';
import type { BotManagedRoomRecord } from '../../contracts/bot-room.record';
import { BotRoomPolicyService } from './bot-room-policy.service';

describe('BotRoomPolicyService', () => {
  const room = (overrides: Partial<BotManagedRoomRecord> = {}) =>
    ({
      ownerId: 1,
      maxPlayers: 4,
      status: 'open',
      startedAt: null,
      ...overrides,
    }) as BotManagedRoomRecord;
  const policy = new BotRoomPolicyService();

  it('enforces owner, room lifecycle and capacity', () => {
    expect(() => policy.ensureOwner(room(), 2)).toThrow(
      BotRoomOwnerRequiredError,
    );
    expect(() => policy.ensureRoomOpen(room({ status: 'started' }))).toThrow(
      BotRoomAlreadyStartedError,
    );
    expect(() => policy.ensureCapacity(room(), 3, 1)).toThrow(BotRoomFullError);
  });

  it('keeps at least two participants when removing a bot after start', () => {
    expect(() =>
      policy.ensureStartedRoomCanRemoveBot(room({ status: 'started' }), 1, 1),
    ).toThrow(BotMinimumParticipantsError);
  });
});
