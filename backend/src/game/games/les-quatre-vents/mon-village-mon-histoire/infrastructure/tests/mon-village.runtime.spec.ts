import type { GameStateEntity } from '../../../../../../application/models/game-state.model';
import { createMonVillageRuntime } from '../../mon-village.runtime';

describe('MonVillage runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createMonVillageRuntime({
      contentLoader: {
        validators: {
          version: () => () => undefined,
          arrayField: () => () => undefined,
        },
        loadContent: ({ filename }: { filename: string }) => {
          if (filename === 'board.json') {
            return { version: 1, tiles: [{ id: 'start', title: 'DÃ©part' }] };
          }
          return {
            version: 1,
            zones: [{ id: 1, cards: [{ id: 'c1', title: 'Carte 1' }] }],
          };
        },
      },
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
      players: [{ id: 1, username: 'Alice' } as any],
      metadata: {},
    };

    const state = service.hydrateInitialState(base);

    expect(state.phase).toBe('playing');
    expect((state.metadata as any).positions?.[1]).toBe(0);
    expect((state.metadata as any).collections?.[1]?.total).toBe(0);
  });
});

