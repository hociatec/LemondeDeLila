import {
  declarativeBot,
  recipeBot,
  selectedRecipeBot,
} from './json-program-bots';

const document = {
  actions: {
    unavailable: { recipe: 'play' },
    first: { recipe: 'play' },
    second: { recipe: 'play' },
    pass: { recipe: 'pass' },
  },
};
const input = { availableActions: ['pass', 'second', 'first'] };

it.each([
  [['play', 'pass'], ['pass', 'second', 'first'], 'second'],
  [['play', 'pass'], ['pass'], 'pass'],
  [['missing', 'play'], ['first', 'second'], 'first'],
  ['play', ['pass', 'second', 'first'], 'second'],
  [['missing'], ['pass'], null],
  [[], ['pass'], null],
  [['play', 'pass'], [], null],
] as const)(
  'respects recipe priority %j for available actions %j',
  (recipes, availableActions, expected) => {
    const bot = recipeBot(document as never, recipes);
    expect(bot.choose?.({ availableActions } as never)).toEqual(
      expected === null ? null : { type: expected, payload: {} },
    );
  },
);

it('keeps available action ordering and the selected payload', () => {
  const payload = { cardId: 'card-42' };
  const select = jest.fn(() => ({ recipe: 'play', payload }));
  const bot = selectedRecipeBot(document as never, select);
  expect(bot.choose?.(input as never)).toEqual({ type: 'second', payload });
  expect(select).toHaveBeenCalledWith(input);
  expect(input.availableActions).toEqual(['pass', 'second', 'first']);
});

it.each([null, { recipe: 'missing', payload: {} }])(
  'does not substitute an unavailable selection: %j',
  (selection) => {
    const bot = selectedRecipeBot(document as never, () => selection);
    expect(bot.choose?.(input as never)).toBeNull();
  },
);

it('chooses scored legal payloads and resolves ties with the deterministic game RNG', () => {
  const legalActions = [
    { type: 'pass', payload: {} },
    { type: 'play', payload: { cardId: 'a' } },
    { type: 'play', payload: { cardId: 'b' } },
  ];
  const pick = jest.fn((values: typeof legalActions) => values.at(-1));
  const bot = declarativeBot({
    kind: 'scored',
    actionScores: { play: 10, pass: -1 },
    ties: 'random',
  });

  expect(
    bot.choose({ legalActions, ctx: { random: { pick } } } as never),
  ).toEqual({ type: 'play', payload: { cardId: 'b' } });
  expect(pick).toHaveBeenCalledWith(legalActions.slice(1));
});

it('keeps first strategy idempotent and does not consume RNG', () => {
  const pick = jest.fn();
  const legalActions = [
    { type: 'play', payload: { cardId: 'a' } },
    { type: 'play', payload: { cardId: 'b' } },
  ];
  const bot = declarativeBot({ kind: 'first' });
  const input = { legalActions, ctx: { random: { pick } } } as never;

  expect(bot.choose(input)).toEqual(legalActions[0]);
  expect(bot.choose(input)).toEqual(legalActions[0]);
  expect(pick).not.toHaveBeenCalled();
});
