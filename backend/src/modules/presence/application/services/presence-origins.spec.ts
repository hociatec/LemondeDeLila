import { PresenceOrigins } from './presence-origins';
import type { PresenceEvent } from '../ports/presence-transport.port';

function event(sequence: number, at = 1): PresenceEvent {
  return {
    origin: 'process-a',
    at,
    sequence,
    players: [
      {
        id: sequence,
        username: 'Player',
        activity: 'home',
        currentRoom: null,
        lastInteractionAt: at,
        roomStarted: false,
      },
    ],
  };
}

it('ignores duplicate and reordered snapshots without refreshing their lifetime', () => {
  let now = 1_000;
  const origins = new PresenceOrigins(() => now, 100);
  expect(origins.accept(event(2))).toBe(true);
  now = 1_099;
  expect(origins.accept(event(1))).toBe(false);
  expect(origins.accept(event(2))).toBe(false);
  expect(origins.snapshot().get('process-a')?.players[0].id).toBe(2);
  now = 1_100;
  expect(origins.snapshot().size).toBe(0);
  expect(origins.accept(event(2))).toBe(false);
  expect(origins.snapshot().size).toBe(0);
  expect(origins.accept(event(3))).toBe(true);
});

it('expires a future-dated announcement using local reception time', () => {
  let now = 0;
  const origins = new PresenceOrigins(() => now, 100);
  origins.accept(event(1, 9_999_999_999));
  now = 100;
  expect(origins.snapshot().size).toBe(0);
});

it('recovers from a lost update with a later complete snapshot', () => {
  const origins = new PresenceOrigins(() => 0);
  origins.accept(event(1));
  origins.accept(event(3));
  expect(
    origins
      .snapshot()
      .get('process-a')
      ?.players.map((p) => p.id),
  ).toEqual([3]);
});

it('accepts legacy timestamp ordering but never downgrades a sequenced origin', () => {
  const origins = new PresenceOrigins(() => 0);
  const legacy = { ...event(1, 10), sequence: undefined };
  expect(origins.accept(legacy)).toBe(true);
  expect(origins.accept({ ...legacy, at: 9 })).toBe(false);
  expect(origins.accept(event(2, 1))).toBe(true);
  expect(origins.accept({ ...legacy, at: 100 })).toBe(false);
});

it('captures public data without retaining received objects or extra fields', () => {
  const origins = new PresenceOrigins(() => 0);
  const input = event(1);
  const room = { id: 3, name: 'Original', internalToken: 'secret' };
  input.players[0].currentRoom = room;
  Object.assign(input.players[0], { privateToken: 'secret' });
  expect(origins.accept(input)).toBe(true);
  input.players[0].username = 'Changed';
  room.name = 'Changed';
  input.players.length = 0;
  const captured = origins.snapshot().get('process-a')!;
  expect(captured.players[0].username).toBe('Player');
  expect(captured.players[0].currentRoom).toEqual({ id: 3, name: 'Original' });
  expect(JSON.stringify(captured)).not.toContain('secret');
  expect(Object.isFrozen(captured)).toBe(true);
  expect(Object.isFrozen(captured.players)).toBe(true);
  expect(Object.isFrozen(captured.players[0])).toBe(true);
  expect(Object.isFrozen(captured.players[0].currentRoom)).toBe(true);
});

it('rejects invalid or duplicate players without consuming the sequence', () => {
  const origins = new PresenceOrigins(() => 0);
  origins.accept(event(1));
  const invalid = event(2);
  invalid.players[0].id = 0;
  expect(origins.accept(invalid)).toBe(false);
  const duplicate = event(2);
  duplicate.players.push({ ...duplicate.players[0] });
  expect(origins.accept(duplicate)).toBe(false);
  expect(origins.snapshot().get('process-a')?.sequence).toBe(1);
  expect(origins.accept(event(2))).toBe(true);
});
