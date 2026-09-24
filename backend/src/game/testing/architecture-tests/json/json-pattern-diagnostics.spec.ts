import { compileJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import { jsonPatternComponentPath } from '../../../engine/runtime/definitions/json-pattern-diagnostics';
import manifest from '../../fixtures/json-course/manifest.json';
import document from '../../fixtures/json-course/game.json';

const race = { kind: 'race', trackId: 'generated', spaces: 5 };
const pawnRace = {
  kind: 'pawn-race',
  pawnSetId: 'pawns',
  spaces: 5,
  pawns: [{ id: 'a' }],
};
const market = {
  kind: 'market',
  marketId: 'market',
  inventoryId: 'inventory',
  items: ['item.one'],
  currency: 'coins',
  prices: { 'item.one': 2 },
  startingCurrency: 10,
  minPrice: 0,
  maxPrice: 10,
  turnsCounterId: 'turns',
  maxRounds: 3,
  winnerReason: 'winner',
};

it.each([
  [{ ...race, finish: 5 }, 'finish', 5],
  [{ ...race, homeStretch: { from: 5 } }, 'homeStretch.from', 5],
  [{ ...race, landingEffects: { '7': [] } }, 'landingEffects.7', []],
  [
    {
      ...race,
      landingEffects: {
        '2': [{ kind: 'move', trackId: 'missing', spaces: 1 }],
      },
    },
    'landingEffects.2[0].trackId',
    'missing',
  ],
  [{ ...pawnRace, perPlayer: 2 }, 'perPlayer', 2],
  [{ ...pawnRace, pawns: [{ id: 'a' }, { id: 'a' }] }, 'pawns[1].id', 'a'],
  [{ ...pawnRace, entryPosition: 5 }, 'entryPosition', 5],
  [{ ...market, items: ['item.one', 'item.one'] }, 'items[1]', 'item.one'],
  [{ ...market, maxPrice: 1 }, 'prices["item.one"]', 2],
  [{ ...market, minPrice: 3, maxPrice: 2 }, 'maxPrice', 2],
  [{ ...market, prices: { 'missing.item': 2 } }, 'prices["missing.item"]', 2],
] as const)(
  'locates pattern compilation errors at the source field %#',
  (pattern, field, received) => {
    const source = {
      ...document,
      patterns: [{ kind: 'push-your-luck' }, pattern],
    };
    let caught: unknown;
    try {
      compileJsonGame(manifest, source);
    } catch (error) {
      caught = error;
    }
    const path = `game.json.patterns[1].${field}`;
    expect(caught).toBeInstanceOf(AuthoringError);
    expect(caught).toMatchObject({ path, received });
    expect(authoringValueAt(source, path.slice('game.json.'.length))).toEqual(
      received,
    );
  },
);

it('does not invent provenance for an ambiguous component or a pack-generated component', () => {
  expect(
    jsonPatternComponentPath(
      [race, race],
      { component: 'movement.track', id: 'generated' },
      'finish',
    ),
  ).toBeUndefined();
  expect(
    jsonPatternComponentPath(
      [race],
      { component: 'movement.track', id: 'other' },
      'finish',
    ),
  ).toBeUndefined();
});

it.each([
  ['movement.track', 'generated', 'id', 'trackId'],
  ['dice.set', 'main', 'count', 'diceCount'],
  ['dice.set', 'main', 'sides', 'diceSides'],
] as const)(
  'maps renamed %s fields without parsing messages',
  (component, id, field, mapped) => {
    expect(jsonPatternComponentPath([race], { component, id }, field)).toBe(
      `patterns[0].${mapped}`,
    );
  },
);
