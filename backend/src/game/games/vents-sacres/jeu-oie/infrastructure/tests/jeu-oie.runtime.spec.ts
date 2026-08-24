import type { GameStateEntity } from '../../../../../../application/models/game-state.model';
import { createJeuOieRuntime } from '../../jeu-oie.runtime';

describe('JeuOie runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createJeuOieRuntime({
      contentLoader: {
        validators: {
          version: () => () => undefined,
          arrayField: () => () => undefined,
        },
        loadContent: () => ({
          version: 1,
          cases: [{ index: 1, title: 'DÃ©part', text: 'Go' }],
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

    expect(state.turn?.currentPlayerId).toBeDefined();
    expect(Array.isArray((state.metadata as any).tiles)).toBe(true);
    expect(Array.isArray((state.metadata as any).pawns)).toBe(true);
  });
});

