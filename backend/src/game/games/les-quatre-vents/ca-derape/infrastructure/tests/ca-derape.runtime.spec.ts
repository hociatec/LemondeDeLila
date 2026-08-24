import type { GameStateEntity } from '../../../../../../../application/models/game-state.model';
import { createCaDerapeRuntime } from '../../ca-derape.runtime';

describe('CaDerape runtime', () => {
  it('hydrates initial state without Nest module', () => {
    const { service } = createCaDerapeRuntime();

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

    expect(String(state.phase ?? '')).toBe('playing');
    expect((state.metadata as any).tiles?.length).toBeGreaterThan(0);
    expect((state.metadata as any).positions?.['1'] ?? (state.metadata as any).positions?.[1]).toBe(0);
  });
});

