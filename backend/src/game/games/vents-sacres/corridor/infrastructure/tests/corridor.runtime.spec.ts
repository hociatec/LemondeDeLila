import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { createCorridorRuntime } from '../../corridor.runtime';

describe('Corridor runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createCorridorRuntime({
      core: { appendLog: (state: any) => state } as any,
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
    };

    const state = service.hydrateInitialState(base);

    expect(String((state.metadata as any).setupStep ?? '')).toBe('setup_config');
    expect(String((state.pending as any)?.type ?? '')).toBe('config_prompt');
  });
});

