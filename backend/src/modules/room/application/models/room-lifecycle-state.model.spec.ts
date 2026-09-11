import { resolveRoomLifecycleState } from './room-lifecycle-state.model';

describe('room lifecycle state', () => {
  it.each([
    [{ status: 'setup' }, 'open'],
    [{ status: 'waiting' }, 'open'],
    [{ status: 'started' }, 'started'],
    [{ status: 'finished', startedAt: '2026-01-01T00:00:00.000Z' }, 'started'],
    [{ status: 'finished' }, 'finished'],
  ])('normalizes %j to %s', (input, kind) => {
    expect(resolveRoomLifecycleState(input)).toEqual({ kind });
  });
});
