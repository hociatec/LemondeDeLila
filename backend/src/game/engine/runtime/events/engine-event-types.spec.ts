import type { GamePendingEvent } from '../../../core/application/models/game-event.model';
import { GameContextEvents } from './game-context-events';
import type { EnginePendingEvent } from './engine-event-registry';

describe('engine event compile-time contracts', () => {
  it('keeps known events typed and game events explicitly opaque', () => {
    const events = new GameContextEvents([], () => '2026-01-01T00:00:00.000Z');

    events.api.engine('dice.rolled', {
      diceId: 'main',
      values: [4],
      total: 4,
      attempts: 1,
      selection: 'first',
    });
    events.api.emit('my-game.custom-event', { custom: true });

    const invalidCallsRejectedByTypeScript = () => {
      // @ts-expect-error a known event must use the typed engine channel
      events.api.emit('dice.rolled', { total: 'four' });
      // @ts-expect-error values is mandatory and total is numeric
      events.api.engine('dice.rolled', { total: 'four' });
    };

    const pending: GamePendingEvent<'dice.rolled', { total: number }> = {
      actorId: 1,
      type: 'dice.rolled',
      data: { total: 4 },
      visibility: { kind: 'public' },
      occurredAtMs: 1,
    };
    expect(pending.data.total).toBe(4);
    expect(invalidCallsRejectedByTypeScript).toEqual(expect.any(Function));
  });

  it('provides a discriminated pending-event union for engine consumers', () => {
    const event = {
      actorId: null,
      type: 'timer.cancelled',
      data: { id: 'turn' },
      visibility: { kind: 'internal' },
      occurredAtMs: 1,
    } satisfies EnginePendingEvent;

    expect(event.data.id).toBe('turn');
  });
});
