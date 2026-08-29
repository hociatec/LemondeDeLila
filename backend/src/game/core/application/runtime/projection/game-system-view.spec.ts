import { projectEventsForPlayer } from './game-system-view';
import type { GamePendingEvent } from '../../models/game-event.model';

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

    const other = projectEventsForPlayer(events, 3).latestByType;
    expect(other).toHaveProperty('public');
    expect(other).not.toHaveProperty('private');
    expect(other).not.toHaveProperty('internal');
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

    expect(projectEventsForPlayer(events, 1).latestByType.split?.data).toEqual({
      count: 2,
      card: 'mine',
    });
    expect(
      projectEventsForPlayer(events, null).latestByType.split?.data,
    ).toEqual({ count: 2 });
  });
});
