import type { GameStateEntity } from '../../../../../../application/models/game-state.model';
import { createEntreRitesRuntime } from '../../entre-rites.runtime';

describe('EntreRites runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createEntreRitesRuntime({
      random: {
        shuffle: (meta: any, values: any[]) => ({ meta, values }),
      } as any,
      core: { appendLog: (state: any) => state } as any,
      turns: {} as any,
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

    expect(Array.isArray((state.metadata as any).deck)).toBe(true);
    expect(Array.isArray((state.metadata as any).hands?.[1])).toBe(true);
    expect(Array.isArray((state.metadata as any).hands?.[2])).toBe(true);
  });
});

