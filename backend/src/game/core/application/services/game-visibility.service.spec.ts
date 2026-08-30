import type { GameStateEntity } from '../contracts/game-state.model';
import { GameVisibilityService } from './game-visibility.service';

describe('GameVisibilityService', () => {
  it('removes engine metadata and another player pending details', () => {
    const internal = {
      status: 'started',
      phase: 'turn',
      log: [],
      players: [
        { id: 1, username: 'Alice' },
        { id: 2, username: 'Bob' },
      ],
      metadata: { rng: { seed: 12, counter: 3 } },
      pending: {
        type: 'choose',
        label: 'Choisir',
        playerId: 2,
        question: 'question privée',
        choices: ['x'],
        data: { answer: 1 },
      },
      engine: { secret: true },
    } as GameStateEntity & { engine: { secret: boolean } };

    const view = new GameVisibilityService().project(internal, internal, 1);

    expect(view).not.toHaveProperty('engine');
    expect(view.metadata).toEqual({});
    expect(view.pending).toEqual({
      type: 'choose',
      label: 'Choisir',
      playerId: 2,
    });
    expect(internal.metadata?.rng).toEqual({ seed: 12, counter: 3 });
  });
});
