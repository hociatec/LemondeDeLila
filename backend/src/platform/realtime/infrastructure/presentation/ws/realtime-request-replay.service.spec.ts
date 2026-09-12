import { RealtimeRequestReplayService } from './realtime-request-replay.service';
import type { RealtimeClientSession } from './realtime-api.types';
import type { WebSocket } from 'ws';
import { operationalSettings } from '../../../../config/public-api';

const session: RealtimeClientSession = {
  socket: {} as WebSocket,
  user: { id: 7, username: 'test', roles: ['admin'] },
  connectionId: 'one',
  clientVersion: null,
  clientProduct: null,
  scope: 'game',
  roomId: 1,
  gameType: 'test',
};

afterEach(() => jest.useRealTimers());

it('replays equal payloads across reconnects and refuses conflicting content or permissions', async () => {
  const replay = new RealtimeRequestReplayService({ now: () => Date.now() });
  const first = replay.begin(session, 'command', 'id', { a: 1, b: 2 });
  if (first.kind !== 'execute') throw new Error('Expected execution');
  first.complete([{ type: 'response', payload: 'ok' }]);
  const same = replay.begin(
    { ...session, connectionId: 'two' },
    'command',
    'id',
    { b: 2, a: 1 },
  );
  if (same.kind !== 'replay') throw new Error('Expected replay');
  await expect(same.frames).resolves.toEqual([
    { type: 'response', payload: 'ok' },
  ]);
  expect(replay.begin(session, 'command', 'id', { a: 2, b: 2 }).kind).toBe(
    'collision',
  );
  expect(
    replay.begin(
      { ...session, user: { id: 7, username: 'test', roles: [] } },
      'command',
      'id',
      { a: 1, b: 2 },
    ).kind,
  ).toBe('collision');
  expect(
    replay.begin({ ...session, roomId: 2 }, 'command', 'id', { a: 1, b: 2 })
      .kind,
  ).toBe('execute');
});

it('starts its five-minute TTL at completion and never expires an in-flight command', () => {
  jest.useFakeTimers().setSystemTime(0);
  const replay = new RealtimeRequestReplayService({ now: () => Date.now() });
  const first = replay.begin(session, 'command', 'id');
  if (first.kind !== 'execute') throw new Error('Expected execution');
  jest.setSystemTime(600_000);
  expect(replay.begin(session, 'command', 'id').kind).toBe('replay');
  first.complete([]);
  jest.setSystemTime(899_999);
  expect(replay.begin(session, 'command', 'id').kind).toBe('replay');
  jest.setSystemTime(900_000);
  expect(replay.begin(session, 'command', 'id').kind).toBe('execute');
});

it('rejects overload rather than evicting an in-flight command', () => {
  const replay = new RealtimeRequestReplayService({ now: () => Date.now() });
  for (let id = 0; id < 10_000; id++)
    expect(replay.begin(session, 'command', String(id)).kind).toBe('execute');
  expect(replay.begin(session, 'command', 'new').kind).toBe('busy');
  expect(replay.begin(session, 'command', '0').kind).toBe('replay');
});

it('does not let an old failed execution delete a newer entry with the same key', () => {
  const replay = new RealtimeRequestReplayService({ now: () => Date.now() });
  const first = replay.begin(session, 'command', 'id');
  if (first.kind !== 'execute') throw new Error('Expected execution');
  first.fail();
  expect(replay.begin(session, 'command', 'id').kind).toBe('execute');
  first.fail();
  expect(replay.begin(session, 'command', 'id').kind).toBe('replay');
});

it('retains completed receipts under saturation until their TTL expires', () => {
  let now = 0;
  const replay = new RealtimeRequestReplayService({ now: () => now });
  for (
    let id = 0;
    id < operationalSettings.realtimeRequestReplayMaxEntries;
    id++
  ) {
    const entry = replay.begin(session, 'command', String(id), { value: 1 });
    if (entry.kind !== 'execute') throw new Error('Expected execution');
    entry.complete([]);
  }
  expect(replay.begin(session, 'command', 'new').kind).toBe('busy');
  expect(replay.begin(session, 'command', '0', { value: 1 }).kind).toBe(
    'replay',
  );
  expect(replay.begin(session, 'command', '0', { value: 2 }).kind).toBe(
    'collision',
  );
  now = operationalSettings.realtimeRequestReplayTtlMs;
  expect(replay.begin(session, 'command', 'new').kind).toBe('execute');
});

it('cannot revoke a completed receipt through a late failure callback', async () => {
  const replay = new RealtimeRequestReplayService({ now: () => 1000 });
  const first = replay.begin(session, 'command', 'id');
  if (first.kind !== 'execute') throw new Error('Expected execution');
  first.complete([{ type: 'success' }]);
  first.fail();
  const retry = replay.begin(session, 'command', 'id');
  if (retry.kind !== 'replay') throw new Error('Expected replay');
  await expect(retry.frames).resolves.toEqual([{ type: 'success' }]);
});
