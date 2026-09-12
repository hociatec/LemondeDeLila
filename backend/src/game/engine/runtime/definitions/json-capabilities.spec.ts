import { compileJsonGame } from './json-game-compiler';
import type {
  EffectCondition,
  GameEffectInstruction,
} from '../contracts/effect-ir';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

const pair = { left: { kind: 'self' }, right: { kind: 'next' } } as const;
const transfer = { from: { kind: 'self' }, to: { kind: 'next' } } as const;
type Intrinsic =
  | 'conditional'
  | 'reaction'
  | 'custom'
  | 'choose-player'
  | 'gain-score'
  | 'skip-turn'
  | 'extra-turn'
  | 'add-status'
  | 'remove-status'
  | 'reverse-turn-order'
  | 'start-round'
  | 'end-round'
  | 'eliminate-player'
  | 'complete-turn';

// A new component-dependent instruction must add a case here to compile.
const effects = {
  move: { kind: 'move', trackId: 'board', spaces: 1 },
  'move-to': { kind: 'move-to', trackId: 'board', position: 1 },
  'swap-positions': { kind: 'swap-positions', trackId: 'board', ...pair },
  'draw-cards': {
    kind: 'draw-cards',
    deckId: 'deck',
    handId: 'hand',
    count: 1,
  },
  'discard-random': {
    kind: 'discard-random',
    deckId: 'deck',
    handId: 'hand',
    count: 1,
  },
  'give-card': { kind: 'give-card', handId: 'hand', cardId: 'a', ...transfer },
  'steal-card': { kind: 'steal-card', handId: 'hand', ...transfer },
  'swap-hands': { kind: 'swap-hands', handId: 'hand', ...pair },
  'exchange-random-cards': {
    kind: 'exchange-random-cards',
    handId: 'hand',
    ...pair,
  },
  'discard-random-inventory': {
    kind: 'discard-random-inventory',
    inventoryId: 'bag',
    count: 1,
  },
  'steal-random-inventory': {
    kind: 'steal-random-inventory',
    inventoryId: 'bag',
    ...transfer,
  },
  'swap-inventories': { kind: 'swap-inventories', inventoryId: 'bag', ...pair },
  'exchange-random-inventory': {
    kind: 'exchange-random-inventory',
    inventoryId: 'bag',
    ...pair,
  },
  'gain-resource': { kind: 'gain-resource', resource: 'stars', amount: 1 },
  'lose-resource': { kind: 'lose-resource', resource: 'stars', amount: 1 },
  'transfer-resource': {
    kind: 'transfer-resource',
    resource: 'stars',
    amount: 1,
    ...transfer,
  },
  'exchange-resources': {
    kind: 'exchange-resources',
    ...pair,
    leftOffer: { resource: 'stars', amount: 1 },
    rightOffer: { resource: 'stars', amount: 1 },
  },
  'roll-dice': { kind: 'roll-dice', diceId: 'main' },
} satisfies Record<
  Exclude<GameEffectInstruction['kind'], Intrinsic>,
  GameEffectInstruction
>;

const components = [
  ...document.components,
  { component: 'inventory.set', id: 'bag', items: ['item'] },
  { component: 'dice.set', id: 'main', count: 1, sides: 6 },
  { component: 'ownership.registry', id: 'property', assets: ['house'] },
];

function source(effect: GameEffectInstruction, installed: boolean) {
  return {
    ...document,
    setup: {},
    components: installed ? components : [],
    resourceIds: installed ? ['stars'] : [],
    victory: { kind: 'score-at-least', amount: 10 },
    actions: { advance: { effects: [effect] } },
  };
}

const wrappers: Record<
  string,
  (effect: GameEffectInstruction) => GameEffectInstruction
> = {
  direct: (effect) => effect,
  conditional: (effect) => ({
    kind: 'conditional',
    condition: { kind: 'score', compare: 'gte', amount: 0 },
    then: [],
    else: [effect],
  }),
  reaction: (effect) => ({
    kind: 'reaction',
    reactor: { kind: 'self' },
    options: ['yes'],
    reactions: { yes: [effect] },
  }),
  fallback: (effect) => ({
    kind: 'reaction',
    reactor: { kind: 'self' },
    options: ['yes'],
    reactions: {},
    fallback: [effect],
  }),
};

const conditions = {
  resource: { kind: 'resource', resource: 'stars', compare: 'gte', amount: 1 },
  'has-resource': { kind: 'has-resource', resource: 'stars', amount: 1 },
  'has-card': { kind: 'has-card', handId: 'hand', cardId: 'a' },
  'track-position': { kind: 'track-position', trackId: 'board', position: 0 },
  'inventory-count': {
    kind: 'inventory-count',
    inventoryId: 'bag',
    compare: 'gte',
    amount: 1,
  },
  'owns-asset': {
    kind: 'owns-asset',
    registryId: 'property',
    assetId: 'house',
  },
} satisfies Record<
  Exclude<
    EffectCondition['kind'],
    'score' | 'has-status' | 'not' | 'all' | 'any'
  >,
  EffectCondition
>;

it.each(Object.entries(conditions))(
  'validates capabilities inside nested %s conditions',
  (_kind, condition) => {
    const effect: GameEffectInstruction = {
      kind: 'conditional',
      condition: {
        kind: 'not',
        condition: {
          kind: 'all',
          conditions: [{ kind: 'any', conditions: [condition] }],
        },
      },
      then: [],
    };
    expect(() => compileJsonGame(manifest, source(effect, true))).not.toThrow();
    expect(() => compileJsonGame(manifest, source(effect, false))).toThrow(
      /unknown|inconnue/,
    );
  },
);

it.each(['cards', 'resources'] as const)(
  'validates the %s capability in reaction availability',
  (kind) => {
    const effect: GameEffectInstruction = {
      kind: 'reaction',
      reactor: { kind: 'self' },
      options: kind === 'cards' ? ['a'] : ['stars'],
      reactions: {},
      availability:
        kind === 'cards'
          ? { kind, handId: 'hand', owner: { kind: 'self' } }
          : { kind, owner: { kind: 'self' } },
    };
    expect(() => compileJsonGame(manifest, source(effect, true))).not.toThrow();
    expect(() => compileJsonGame(manifest, source(effect, false))).toThrow(
      /unknown|inconnue/,
    );
  },
);

describe.each(Object.entries(wrappers))(
  '%s capability validation',
  (_name, wrap) => {
    it.each(Object.entries(effects))(
      'requires the capability for %s before runtime',
      (_kind, effect) => {
        expect(() =>
          compileJsonGame(manifest, source(wrap(effect), true)),
        ).not.toThrow();
        expect(() =>
          compileJsonGame(manifest, source(wrap(effect), false)),
        ).toThrow(/unknown|inconnue/);
      },
    );
  },
);
