import { compileJsonGame } from './json-game-compiler';
import manifest from '../../../games/les-quatre-vents/panier-express/manifest.json';
import document from '../../../games/les-quatre-vents/panier-express/game.json';

type Document = typeof document;
const mutations: Array<{ name: string; mutate: (source: Document) => void }> = [
  {
    name: 'duplicate tiles',
    mutate: (d) => {
      d.board.tiles[1].id = d.board.tiles[0].id;
    },
  },
  {
    name: 'unknown track',
    mutate: (d) => {
      d.board.trackId = 'absent';
    },
  },
  {
    name: 'unknown dice',
    mutate: (d) => {
      d.board.diceId = 'absent';
    },
  },
  {
    name: 'unknown quiz bank',
    mutate: (d) => {
      d.board.quiz.bankId = 'absent';
    },
  },
  {
    name: 'unknown inventory',
    mutate: (d) => {
      d.board.collection.requiredInventoryId = 'absent';
    },
  },
  {
    name: 'unknown pawn set',
    mutate: (d) => {
      d.board.pawnSelection.setId = 'absent';
    },
  },
  {
    name: 'duplicate choices',
    mutate: (d) => {
      d.board.exchange.giveChoiceId = d.board.quiz.choiceId;
    },
  },
  {
    name: 'unknown phase',
    mutate: (d) => {
      d.board.playingPhase = 'absent';
    },
  },
  {
    name: 'unreachable playing phase',
    mutate: (d) => {
      d.phases.setup.transitions = [];
    },
  },
  {
    name: 'missing quiz capability',
    mutate: (d) => {
      Reflect.deleteProperty(d.board, 'quiz');
    },
  },
  {
    name: 'missing collection capability',
    mutate: (d) => {
      Reflect.deleteProperty(d.board, 'collection');
    },
  },
  {
    name: 'missing exchange capability',
    mutate: (d) => {
      Reflect.deleteProperty(d.board, 'exchange');
    },
  },
  {
    name: 'missing direction choice',
    mutate: (d) => {
      Reflect.deleteProperty(d.board, 'directionChoiceId');
    },
  },
  {
    name: 'unknown default source',
    mutate: (d) => {
      d.board.collection.defaultSourceId = 'absent';
    },
  },
  {
    name: 'empty distribution',
    mutate: (d) => {
      d.board.distribution.groups = [];
    },
  },
  {
    name: 'unknown distribution item',
    mutate: (d) => {
      d.board.distribution.groups[0][0] = 'absent';
    },
  },
  {
    name: 'excessive recursion',
    mutate: (d) => {
      d.board.maxDepth = 10000;
    },
  },
  {
    name: 'unknown custom effect',
    mutate: (d) => {
      Reflect.set(d.board.bindings, 'new-effect', { kind: 'execute-code' });
    },
  },
  {
    name: 'unknown board field',
    mutate: (d) => {
      Reflect.set(d.board, 'execute', 'arbitrary code');
    },
  },
  {
    name: 'unknown landing operation',
    mutate: (d) => {
      Reflect.set(d.board.tiles[0], 'operations', [{ kind: 'execute-code' }]);
    },
  },
  {
    name: 'inverted random movement',
    mutate: (d) => {
      Reflect.set(d.board.tiles[0], 'operations', [
        { kind: 'random-move', minimum: 5, maximum: 2, direction: 1 },
      ]);
    },
  },
  {
    name: 'unknown draw deck',
    mutate: (d) => {
      Reflect.set(d.board.tiles[0], 'operations', [
        { kind: 'draw', deckId: 'absent' },
      ]);
    },
  },
  {
    name: 'unknown landing source',
    mutate: (d) => {
      Reflect.set(d.board.tiles[0], 'operations', [
        { kind: 'collect', sourceId: 'absent' },
      ]);
    },
  },
  {
    name: 'unknown destination tag',
    mutate: (d) => {
      d.board.bindings['panier.nearest-stand'].tag = 'absent';
    },
  },
  {
    name: 'unknown shortcut action',
    mutate: (d) => {
      Reflect.set(d.shortcuts[0], 'actionType', 'absent');
    },
  },
  {
    name: 'missing board',
    mutate: (d) => {
      Reflect.deleteProperty(d, 'board');
    },
  },
  {
    name: 'missing card effects',
    mutate: (d) => {
      const card = d.components.find((c) => c.id === 'events')?.cards?.[0];
      if (!card) throw new Error('Missing fixture card');
      Reflect.deleteProperty(card, 'effects');
    },
  },
  {
    name: 'unknown card effect',
    mutate: (d) => {
      const card = d.components.find((c) => c.id === 'events')?.cards?.[0];
      if (!card) throw new Error('Missing fixture card');
      Reflect.set(card, 'effects', [
        { kind: 'custom', effectId: 'absent', data: {} },
      ]);
    },
  },
];

it.each(mutations)(
  'rejects $name before installing a board runtime',
  ({ mutate }) => {
    const source = structuredClone(document);
    mutate(source);
    expect(() => compileJsonGame(manifest, source)).toThrow();
  },
);

it('rejects invalid custom effect data before any action executes', () => {
  const source = structuredClone(document);
  const card = source.components.find((c) => c.id === 'events')?.cards?.[0];
  if (!card) throw new Error('Missing fixture card');
  Reflect.set(card, 'effects', [
    {
      kind: 'custom',
      effectId: 'panier.draw-course',
      data: { count: 0, everyone: true },
    },
  ]);
  expect(() => compileJsonGame(manifest, source)).toThrow();
});
