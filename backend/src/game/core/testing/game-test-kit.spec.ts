import {
  defineAction,
  defineGame,
} from '../application/runtime/game-definition';
import { gameInput } from '../application/runtime/game-input-schema';
import { testGame } from './game-test-kit';

type RaceState = { scores: Record<string, number> };

const race = defineGame({
  id: 'test-race',
  displayName: 'Test Race',
  category: 'test',
  players: { min: 2, max: 4 },
  setup: () => ({ scores: {} }),
  actions: {
    advance: defineAction<RaceState, { steps: number }>({
      input: gameInput.object({
        steps: gameInput.number({ integer: true, min: 1, max: 3 }),
      }),
      execute: ({ state, actor, input, ctx }) => {
        state.scores[String(actor.id)] =
          (state.scores[String(actor.id)] ?? 0) + input.steps;
        ctx.turn.end();
      },
    }),
  },
  view: ({ state }) => structuredClone(state),
});

describe('GameTestKit', () => {
  it('provides a fluent typed driver and deterministic replay', async () => {
    const game = testGame(race).players(['alice', 'bob']).seed(42);
    await game.start();

    game.as('alice').expectAction('advance');
    await game.as('alice').do('advance', { steps: 2 });
    game.as('bob').expectAction('advance');
    await game.as('bob').do('advance', { steps: 1 });

    expect(game.view('alice').scores).toEqual({ '1': 2, '2': 1 });
    expect(game.replay()).toEqual(game.state());
  });

  it('rejects invalid player counts and actions through the real runtime', async () => {
    await expect(testGame(race).players(1).start()).rejects.toThrow(
      'Nombre de joueurs hors limites',
    );
    const game = testGame(race);
    await game.start();
    await expect(game.as('alice').do('advance', { steps: 10 })).rejects.toThrow(
      'maximum 3',
    );
  });
});
