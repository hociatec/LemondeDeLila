import type { GameStateEntity } from '../../../../../../application/models/game-state.model';
import { createMorpionRuntime } from '../../morpion.runtime';

describe('Morpion runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createMorpionRuntime({
      core: { appendLog: (state: any) => state } as any,
    });

    const base: GameStateEntity = {
      status: 'created',
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

    expect(String(state.status ?? '')).toBe('started');
    expect((state.metadata as any).size).toBe(3);
  });
});

