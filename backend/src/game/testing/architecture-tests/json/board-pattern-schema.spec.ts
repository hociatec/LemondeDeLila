import { compileJsonGame } from '../../../rules/public-api';
import manifest from '../../../games/les-quatre-vents/panier-express/manifest.json';
import { resolveJsonContent } from '../../../rules/public-api';
import compositionExtensionSource from '../../../games/les-quatre-vents/panier-express/game.json';
import board from '../../../games/les-quatre-vents/panier-express/content/board.json';
import cards from '../../../games/les-quatre-vents/panier-express/content/cards.json';
import pawns from '../../../games/les-quatre-vents/panier-express/content/pawns.json';
import products from '../../../games/les-quatre-vents/panier-express/content/products.json';
import quizzes from '../../../games/les-quatre-vents/panier-express/content/quizzes.json';
import { parseJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
const composition = structuredClone(compositionExtensionSource);

const document = resolveJsonContent(composition, {
  'content/board.json': board,
  'content/cards.json': cards,
  'content/pawns.json': pawns,
  'content/products.json': products,
  'content/quizzes.json': quizzes,
});

const mutations: Array<[string, string[], unknown]> = [
  [
    'duplicate tiles',
    ['patterns', '0', 'config', 'tiles', '1', 'id'],
    'case-1-entree',
  ],
  ['unknown track', ['patterns', '0', 'config', 'trackId'], 'absent'],
  ['unknown dice', ['patterns', '0', 'config', 'diceId'], 'absent'],
  [
    'unknown quiz bank',
    ['patterns', '0', 'config', 'quiz', 'bankId'],
    'absent',
  ],
  [
    'unknown inventory',
    ['patterns', '0', 'config', 'collection', 'requiredInventoryId'],
    'absent',
  ],
  [
    'unknown pawn set',
    ['patterns', '0', 'config', 'pawnSelection', 'setId'],
    'absent',
  ],
  [
    'duplicate choices',
    ['patterns', '0', 'config', 'exchange', 'giveChoiceId'],
    'panier.quiz',
  ],
  ['unknown phase', ['patterns', '0', 'config', 'playingPhase'], 'absent'],
  ['unreachable phase', ['phases', 'setup', 'transitions'], []],
  ['missing quiz', ['patterns', '0', 'config', 'quiz'], undefined],
  ['missing collection', ['patterns', '0', 'config', 'collection'], undefined],
  ['missing exchange', ['patterns', '0', 'config', 'exchange'], undefined],
  [
    'missing direction',
    ['patterns', '0', 'config', 'directionChoiceId'],
    undefined,
  ],
  [
    'unknown source',
    ['patterns', '0', 'config', 'collection', 'defaultSourceId'],
    'absent',
  ],
  [
    'empty distribution',
    ['patterns', '0', 'config', 'distribution', 'groups'],
    [],
  ],
  [
    'unknown item',
    ['patterns', '0', 'config', 'distribution', 'groups', '0', '0'],
    'absent',
  ],
  ['excessive recursion', ['patterns', '0', 'config', 'maxDepth'], 10000],
  [
    'unknown binding',
    ['patterns', '0', 'config', 'bindings', 'new-effect'],
    { kind: 'execute-code' },
  ],
  ['unknown field', ['patterns', '0', 'config', 'execute'], 'arbitrary code'],
  [
    'unknown operation',
    ['patterns', '0', 'config', 'tiles', '0', 'operations'],
    [{ kind: 'execute-code' }],
  ],
  [
    'inverted range',
    ['patterns', '0', 'config', 'tiles', '0', 'operations'],
    [{ kind: 'random-move', minimum: 5, maximum: 2, direction: 1 }],
  ],
  [
    'unknown deck',
    ['patterns', '0', 'config', 'tiles', '0', 'operations'],
    [{ kind: 'draw', deckId: 'absent' }],
  ],
  [
    'unknown collection source',
    ['patterns', '0', 'config', 'tiles', '0', 'operations'],
    [{ kind: 'collect', sourceId: 'absent' }],
  ],
  [
    'unknown tag',
    ['patterns', '0', 'config', 'bindings', 'panier.nearest-stand', 'tag'],
    'absent',
  ],
  ['unknown shortcut', ['shortcuts', '0', 'actionType'], 'absent'],
  ['missing board', ['patterns', '0', 'config'], undefined],
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

const precisePaths: Record<string, string> = {
  'duplicate tiles': 'patterns[0].config.tiles[1].id',
  'unknown track': 'patterns[0].config.trackId',
  'unknown dice': 'patterns[0].config.diceId',
  'unknown quiz bank': 'patterns[0].config.quiz.bankId',
  'unknown inventory': 'patterns[0].config.collection.requiredInventoryId',
  'unknown pawn set': 'patterns[0].config.pawnSelection.setId',
  'duplicate choices': 'patterns[0].config.exchange.giveChoiceId',
  'unknown phase': 'patterns[0].config.playingPhase',
  'unreachable phase': 'patterns[0].config.playingPhase',
  'missing quiz': 'patterns[0].config.quiz',
  'missing collection': 'patterns[0].config.collection',
  'missing exchange': 'patterns[0].config.exchange',
  'missing direction': 'patterns[0].config.directionChoiceId',
  'unknown source': 'patterns[0].config.collection.defaultSourceId',
  'unknown item': 'patterns[0].config.distribution.groups[0][0]',
  'inverted range': 'patterns[0].config.tiles[0].operations[0].minimum',
  'unknown deck': 'patterns[0].config.tiles[0].operations[0].deckId',
  'unknown collection source':
    'patterns[0].config.tiles[0].operations[0].sourceId',
  'unknown tag': 'patterns[0].config.bindings["panier.nearest-stand"].tag',
};

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
  (name, path, value) => {
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
    if (precisePaths[name]) {
      try {
        compileJsonGame(manifest, source);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthoringError);
        expect(error).toMatchObject({
          path: `game.json.${precisePaths[name]}`,
          received: authoringValueAt(source, precisePaths[name]),
        });
      }
    }
  },
);
