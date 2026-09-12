import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/les-quatre-vents/panier-express/manifest.json';
import { resolveJsonContent } from '../../../engine/json/public-api';
import composition from '../../../games/les-quatre-vents/panier-express/game.json';
import board from '../../../games/les-quatre-vents/panier-express/content/board.json';
import cards from '../../../games/les-quatre-vents/panier-express/content/cards.json';
import pawns from '../../../games/les-quatre-vents/panier-express/content/pawns.json';
import products from '../../../games/les-quatre-vents/panier-express/content/products.json';
import quizzes from '../../../games/les-quatre-vents/panier-express/content/quizzes.json';
import { parseJsonGame } from './json-game-parser';

const document = resolveJsonContent(composition, {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
  'content/products.json': products,
  'content/quizzes.json': quizzes,
});

const mutations: Array<[string, string[], unknown]> = [
  ['duplicate tiles', ['board', 'tiles', '1', 'id'], 'case-1-entree'],
  ['unknown track', ['board', 'trackId'], 'absent'],
  ['unknown dice', ['board', 'diceId'], 'absent'],
  ['unknown quiz bank', ['board', 'quiz', 'bankId'], 'absent'],
  [
    'unknown inventory',
    ['board', 'collection', 'requiredInventoryId'],
    'absent',
  ],
  ['unknown pawn set', ['board', 'pawnSelection', 'setId'], 'absent'],
  ['duplicate choices', ['board', 'exchange', 'giveChoiceId'], 'panier.quiz'],
  ['unknown phase', ['board', 'playingPhase'], 'absent'],
  ['unreachable phase', ['phases', 'setup', 'transitions'], []],
  ['missing quiz', ['board', 'quiz'], undefined],
  ['missing collection', ['board', 'collection'], undefined],
  ['missing exchange', ['board', 'exchange'], undefined],
  ['missing direction', ['board', 'directionChoiceId'], undefined],
  ['unknown source', ['board', 'collection', 'defaultSourceId'], 'absent'],
  ['empty distribution', ['board', 'distribution', 'groups'], []],
  ['unknown item', ['board', 'distribution', 'groups', '0', '0'], 'absent'],
  ['excessive recursion', ['board', 'maxDepth'], 10000],
  [
    'unknown binding',
    ['board', 'bindings', 'new-effect'],
    { kind: 'execute-code' },
  ],
  ['unknown field', ['board', 'execute'], 'arbitrary code'],
  [
    'unknown operation',
    ['board', 'tiles', '0', 'operations'],
    [{ kind: 'execute-code' }],
  ],
  [
    'inverted range',
    ['board', 'tiles', '0', 'operations'],
    [{ kind: 'random-move', minimum: 5, maximum: 2, direction: 1 }],
  ],
  [
    'unknown deck',
    ['board', 'tiles', '0', 'operations'],
    [{ kind: 'draw', deckId: 'absent' }],
  ],
  [
    'unknown collection source',
    ['board', 'tiles', '0', 'operations'],
    [{ kind: 'collect', sourceId: 'absent' }],
  ],
  [
    'unknown tag',
    ['board', 'bindings', 'panier.nearest-stand', 'tag'],
    'absent',
  ],
  ['unknown shortcut', ['shortcuts', '0', 'actionType'], 'absent'],
  ['missing board', ['board'], undefined],
  [
    'missing card effects',
    ['components', '4', 'cards', '0', 'effects'],
    undefined,
  ],
  [
    'unknown card effect',
    ['components', '4', 'cards', '0', 'effects'],
    [{ kind: 'custom', effectId: 'absent', data: {} }],
  ],
  [
    'invalid custom data',
    ['components', '4', 'cards', '0', 'effects'],
    [
      {
        kind: 'custom',
        effectId: 'panier.draw-course',
        data: { count: 0, everyone: true },
      },
    ],
  ],
];

it('accepts the fully assembled fixture before mutations', () => {
  expect(() => compileJsonGame(manifest, document)).not.toThrow();
});

it.each([1, 2])(
  'rejects insufficient pawn capacity with %i pawns per player',
  (perPlayer) => {
    const source = parseJsonGame(document);
    const components = source.components.map((component) =>
      component.component === 'pawn.set'
        ? {
            ...component,
            perPlayer,
            pawns: component.pawns.slice(
              0,
              manifest.maxPlayers * perPlayer - 1,
            ),
          }
        : component,
    );
    expect(() => compileJsonGame(manifest, { ...source, components })).toThrow(
      /not enough pawns/,
    );
  },
);

it.each(mutations)(
  'rejects %s before installing a board runtime',
  (_name, path, value) => {
    const source = structuredClone(document);
    let target = source;
    for (const key of path.slice(0, -1)) {
      if (!target || typeof target !== 'object' || !Object.hasOwn(target, key))
        throw new Error(`Missing fixture path: ${path.join('/')}`);
      target = Reflect.get(target, key);
    }
    const key = path.at(-1);
    if (!target || typeof target !== 'object' || key === undefined)
      throw new Error('Invalid fixture target');
    if (value === undefined) Reflect.deleteProperty(target, key);
    else Reflect.set(target, key, value);
    expect(() => compileJsonGame(manifest, source)).toThrow();
  },
);
