import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { createFouleesFantastiquesRuntime } from '../../foulees-fantastiques.runtime';

describe('FouleesFantastiques runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createFouleesFantastiquesRuntime({
      contentLoader: {
        validators: {
          version: () => () => undefined,
          arrayField: () => () => undefined,
          positiveNumber: () => () => undefined,
        } as any,
        loadContent: () => ({
          version: 1,
          trackLength: 40,
          homeLength: 4,
          tiles: [{ id: 'start', label: 'Départ' }],
        }),
      },
      core: { appendLog: (state: any) => state } as any,
    });

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Alice' } as any,
        { id: 2, username: 'Bob' } as any,
      ],
      metadata: {},
    };

    const state = service.hydrateInitialState(base);

    expect(Array.isArray((state.metadata as any).tiles)).toBe(true);
    expect((state.metadata as any).trackLength).toBe(40);
    expect(Array.isArray((state.metadata as any).pawnsByPlayer?.[1])).toBe(true);
  });
});

