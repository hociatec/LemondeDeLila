import { recipeBot, selectedRecipeBot } from './json-program-bots';

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
