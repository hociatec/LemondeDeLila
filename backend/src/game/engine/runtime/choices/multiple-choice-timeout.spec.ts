import { defineGame } from '../definitions/game-definition';
import { defineAction, defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import { testGame } from '../../../core/testing/game-test-kit';
import type { ChoiceTimeout } from './game-choice-controller';

type State = { selected: number[] };
type Kind = 'many' | 'players' | 'ordering';

async function fixture(
  kind: Kind,
  strategy: ChoiceTimeout<readonly number[]>['strategy'],
  minimum = 2,
) {
  const definition = defineGame<State>()({
    id: 'multiple-choice-timeout',
    displayName: 'Choice timeout',
    category: 'test',
    players: { min: 3, max: 3 },
    setup: () => ({ selected: [] }),
    initialPhase: 'playing',
    phases: { playing: { actions: ['choose'], terminal: true } },
    actions: {
      choose: defineAction<State, Record<string, never>>({
        input: gameInput.object({}),
        execute: ({ actor, ctx }) => {
          const options = {
            id: 'selection',
            player: actor.id,
            options: [1, 2, 3],
            timeout: {
              afterMs: 10,
              strategy,
              ...(strategy === 'default' ? { value: [2, 3] } : {}),
            },
          };
          if (kind === 'ordering') ctx.choice.ordering(options);
          else if (kind === 'players')
            ctx.choice.players({ ...options, min: minimum, max: 3 });
          else ctx.choice.many({ ...options, min: minimum, max: 3 });
        },
      }),
    },
    choices: {
      selection: defineChoice<State, number[]>({
        input: gameInput.array(gameInput.number({ integer: true }), {
          min: 0,
          max: 3,
        }),
        resolve: ({ state, value }) => {
          state.selected = value;
        },
      }),
    },
  });
  const game = await testGame(definition).players(3).seed(42).start();
  await game.as(1).do('choose', {});
  game.advanceTime(10);
  return game;
}

describe.each<Kind>(['many', 'players', 'ordering'])('%s timeouts', (kind) => {
  it.each(['first', 'last', 'random'] as const)(
    'resolves %s with a valid complete selection',
    async (strategy) => {
      const game = await fixture(kind, strategy);
      await game.as(1).do('choice.timeout', {});
      const state = game.state();
      const count = kind === 'ordering' ? 3 : 2;
      expect(state).toHaveProperty('game.selected.length', count);
      if (strategy === 'first')
        expect(state).toHaveProperty(
          'game.selected',
          [1, 2, 3].slice(0, count),
        );
      if (strategy === 'last')
        expect(state).toHaveProperty('game.selected', [1, 2, 3].slice(-count));
      expect(await game.replay()).toEqual(state);
    },
  );
});

it.each(['first', 'last', 'random'] as const)(
  'permits an empty selection with %s and minimum zero',
  async (strategy) => {
    const game = await fixture('many', strategy, 0);
    await game.as(1).do('choice.timeout', {});
    expect(game.state()).toHaveProperty('game.selected', []);
  },
);

it('accepts a typed array as the default multiple-choice result', async () => {
  const game = await fixture('many', 'default');
  await game.as(1).do('choice.timeout', {});
  expect(game.state()).toHaveProperty('game.selected', [2, 3]);
});
