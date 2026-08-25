import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { createAFondLesBallonsRuntime } from '../../a-fond-les-ballons.runtime';

describe('AFondLesBallons runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const contentLoader = {
      validators: {
        version: () => () => undefined,
        arrayField: () => () => undefined,
      },
      loadContent: () => ({
        pawns: [
          {
            id: 'capitaine-cacahuete',
            name: 'Capitaine Cacahuète',
            description: 'Test',
          },
        ],
      }),
    } as any;

    const { service } = createAFondLesBallonsRuntime({
      contentLoader,
    });

    const base: GameStateEntity = {
      status: 'started',
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
      pending: null as any,
    };

    const state = service.hydrateInitialState(base);

    expect((state.metadata as any).tiles?.length).toBeGreaterThan(0);
    expect(String((state.pending as any)?.type ?? '')).toBe('choose_pawn');
  });
});

