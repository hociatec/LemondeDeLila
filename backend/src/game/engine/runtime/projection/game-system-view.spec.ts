import { projectEventsForPlayer } from './game-system-view';
import type { GamePendingEvent } from '../../../core/application/contracts/game-event.model';

describe('game system view event visibility', () => {
  const event = (
    type: string,
    visibility: GamePendingEvent['visibility'],
    data: Record<string, unknown>,
  ): GamePendingEvent => ({
    type,
    visibility,
    data,
    actorId: 1,
    occurredAtMs: 100,
  });

  it('never exposes internal events and restricts private events', () => {
    const events = [
      event('public', { kind: 'public' }, { value: 'shared' }),
      event('internal', { kind: 'internal' }, { secret: 'engine' }),
      event('private', { kind: 'private', playerIds: [2] }, { hand: ['a'] }),
    ];

    const owner = projectEventsForPlayer(events, 2).latestByType;
    expect(owner).toHaveProperty('public');
    expect(owner).toHaveProperty('private');
    expect(owner).not.toHaveProperty('internal');
    const identified = owner as Record<string, { id: string } | undefined>;
    expect(identified.public?.id).toBe('0:0');
    expect(identified.private?.id).toBe('0:2');

    const other = projectEventsForPlayer(events, 3).latestByType;
    expect(other).toHaveProperty('public');
    expect(other).not.toHaveProperty('private');
    expect(other).not.toHaveProperty('internal');
  });

  it('keeps a stable event identity across repeated projections', () => {
    const events = [event('dice.rolled', { kind: 'public' }, { total: 7 })];
    const first = projectEventsForPlayer(events, 1, 42).latestByType;
    const refreshed = projectEventsForPlayer(events, 1, 42).latestByType;
    const nextVersion = projectEventsForPlayer(events, 1, 43).latestByType;

    expect(first['dice.rolled']?.id).toBe('42:0');
    expect(refreshed['dice.rolled']?.id).toBe('42:0');
    expect(nextVersion['dice.rolled']?.id).toBe('43:0');
  });

  it('keeps every repeated event in emission order', () => {
    const events = [
      event('score.changed', { kind: 'public' }, { playerId: 1, delta: 2 }),
      event('score.changed', { kind: 'public' }, { playerId: 2, delta: 4 }),
    ];
    const projected = projectEventsForPlayer(events, 1, 9);

    expect(projected.recent.map((item) => item.id)).toEqual(['9:0', '9:1']);
    expect(projected.recent.map((item) => item.sequence)).toEqual([0, 1]);
    expect(projected.latestByType['score.changed']?.data).toMatchObject({
      playerId: 2,
      delta: 4,
    });
  });

  it('adds only the viewer-specific part of split events', () => {
    const events = [
      event(
        'split',
        {
          kind: 'split',
          privateDataByPlayer: {
            '1': { card: 'mine' },
            '2': { card: 'theirs' },
          },
        },
        { count: 2 },
      ),
    ];

    type SplitEvents = { split: { count: number; card?: string } };
    expect(
      projectEventsForPlayer<SplitEvents>(events, 1).latestByType.split?.data,
    ).toEqual({ count: 2, card: 'mine' });
    expect(
      projectEventsForPlayer<SplitEvents>(events, null).latestByType.split
        ?.data,
    ).toEqual({ count: 2 });
  });
});
