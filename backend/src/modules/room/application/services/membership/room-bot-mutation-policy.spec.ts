import { assessRoomBotMutation } from './room-bot-mutation-policy';
import type { BotManagedRoomRecord } from '../../read-models/room-bot.record';

const room: BotManagedRoomRecord = {
  id: 4,
  ownerId: 1,
  maxPlayers: 4,
  status: 'waiting',
  startedAt: null,
};

it.each(['open', 'waiting', 'setup'])(
  'allows bot admission in the Room lifecycle status %s',
  (status) => {
    expect(
      assessRoomBotMutation(
        { ...room, status },
        { kind: 'add', actorId: 1 },
        1,
        0,
      ),
    ).toBe('allowed');
  },
);

it('checks ownership, lifecycle, capacity and minimum participants', () => {
  expect(assessRoomBotMutation(null, { kind: 'add', actorId: 1 }, 1, 0)).toBe(
    'room-not-found',
  );
  expect(assessRoomBotMutation(room, { kind: 'add', actorId: 2 }, 1, 0)).toBe(
    'owner-required',
  );
  const started = { ...room, startedAt: new Date(0) };
  expect(
    assessRoomBotMutation(started, { kind: 'add', actorId: 1 }, 1, 0),
  ).toBe('room-started');
  expect(assessRoomBotMutation(room, { kind: 'add', actorId: 1 }, 3, 1)).toBe(
    'room-full',
  );
  expect(
    assessRoomBotMutation(started, { kind: 'remove', actorId: 1 }, 1, 1),
  ).toBe('minimum-participants');
  expect(
    assessRoomBotMutation(started, { kind: 'remove', actorId: 1 }, 1, 2),
  ).toBe('allowed');
});

it('allows internal restoration into a started room while respecting capacity', () => {
  const started = { ...room, status: 'started' };
  expect(assessRoomBotMutation(started, { kind: 'restore' }, 1, 0)).toBe(
    'allowed',
  );
  expect(assessRoomBotMutation(started, { kind: 'restore' }, 3, 1)).toBe(
    'room-full',
  );
});
