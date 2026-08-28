import {
  defineAction,
  defineGame,
} from '../application/runtime/game-definition';
import { gameInput } from '../application/runtime/game-input-schema';
import { testGame } from './game-test-kit';

type RaceState = Record<string, never>;

const race = defineGame({
  id: 'test-race',
  displayName: 'Test Race',
  category: 'test',
  players: { min: 2, max: 4 },
  setup: () => ({}),
  actions: {
    advance: defineAction<RaceState, { steps: number }>({
      input: gameInput.object({
        steps: gameInput.number({ integer: true, min: 1, max: 3 }),
      }),
      execute: ({ actor, input, ctx }) => {
        ctx.score.add(actor.id, input.steps);
        ctx.turn.end();
      },
    }),
  },
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
    expect(await game.replay()).toEqual(game.state());
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
