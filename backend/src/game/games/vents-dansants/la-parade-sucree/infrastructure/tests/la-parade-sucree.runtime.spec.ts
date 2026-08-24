import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { createLaParadeSucreeRuntime } from '../../la-parade-sucree.runtime';

describe('LaParadeSucree runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createLaParadeSucreeRuntime({
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

    expect(state.status).toBe('started');
    expect(Array.isArray((state.metadata as any).hands?.[1])).toBe(true);
    expect(Array.isArray((state.metadata as any).hands?.[2])).toBe(true);
  });
});

