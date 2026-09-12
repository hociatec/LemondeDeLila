import { compileJsonGame } from './json-game-compiler';
import { testGame } from '../../../core/testing/game-test-kit';
import { DeclarativeGameRuntime } from '../declarative-game.runtime';
import type { DeclarativeState } from '../state/declarative-state';
import manifest from '../../../testing/fixtures/json-course/manifest.json';
import document from '../../../testing/fixtures/json-course/game.json';

type State = DeclarativeState<Record<string, never>>;

it('restores an effect targeting a bot with a signed player identity', async () => {
  const definition = compileJsonGame(manifest, document);
  const game = await testGame(definition)
    .players([{ username: 'Human' }, { username: 'Bot', isBot: true }])
    .seed(42)
    .start();
  const source = game.state() as State;
  source.engine.effects.queue = [
    { kind: 'gain-score', amount: 1, target: { kind: 'player', playerId: -2 } },
  ];
  const runtime = new DeclarativeGameRuntime(definition);
  expect(() => runtime.applyActions(source, [])).not.toThrow();
});

const corruptions: [string, (state: State) => void][] = [
  [
    'unknown direct effect player',
    (s) => {
      s.engine.effects.queue = [
        {
          kind: 'gain-score',
          amount: 1,
          target: { kind: 'player', playerId: 999 },
        },
      ];
    },
  ],
  [
    'unknown chosen effect player',
    (s) => {
      s.engine.effects.queue = [
        {
          kind: 'gain-score',
          amount: 1,
          target: { kind: 'chosen-player', playerIds: [1, 999] },
        },
      ];
    },
  ],
  [
    'unknown effect chooser',
    (s) => {
      s.engine.effects.queue = [
        {
          kind: 'gain-score',
          amount: 1,
          target: { kind: 'chosen-opponent', chooserPlayerId: 999 },
        },
      ];
    },
  ],
  [
    'unknown conditional player',
    (s) => {
      s.engine.effects.queue = [
        {
          kind: 'conditional',
          condition: {
            kind: 'score',
            compare: 'gte',
            amount: 0,
            target: { kind: 'player', playerId: 999 },
          },
          then: [],
        },
      ];
    },
  ],
  [
    'unknown exchange player',
    (s) => {
      s.engine.effects.queue = [
        {
          kind: 'swap-hands',
          handId: 'hand',
          left: { kind: 'player', playerId: 1 },
          right: { kind: 'player', playerId: 999 },
        },
      ];
    },
  ],
  [
    'invalid receipt fingerprint',
    (s) => {
      s.engine.commands.receipts.push({
        commandId: 'command-123',
        actorId: 1,
        actionType: 'roll',
        acceptedAtMs: 1000,
        resultVersion: 1,
        requestFingerprint: 'invalid',
      });
    },
  ],
  [
    'unknown effect version',
    (s) => {
      s.engine.effects.schemaVersion = 999;
    },
  ],
  [
    'unknown queued track',
    (s) => {
      s.engine.effects.queue = [
        { kind: 'move', trackId: 'missing', spaces: 1 },
      ];
    },
  ],
  [
    'unknown queued custom effect',
    (s) => {
      s.engine.effects.queue = [{ kind: 'custom', effectId: 'missing' }];
    },
  ],
  [
    'missing pending effect choice',
    (s) => {
      s.engine.effects.awaitingChoiceId = 'missing';
      s.engine.effects.awaitingPlayerChoice = {
        choiceId: 'missing',
        optional: false,
      };
    },
  ],
  [
    'unknown reaction fallback deck',
    (s) => {
      s.pending = { data: { choiceId: 'reaction' } };
      s.engine.effects.awaitingChoiceId = 'reaction';
      s.engine.effects.awaitingReaction = {
        choiceId: 'reaction',
        reactions: {},
        fallback: [
          { kind: 'draw-cards', deckId: 'missing', handId: 'hand', count: 1 },
        ],
      };
    },
  ],
  [
    'unknown reaction branch track',
    (s) => {
      s.pending = { data: { choiceId: 'reaction' } };
      s.engine.effects.awaitingChoiceId = 'reaction';
      s.engine.effects.awaitingReaction = {
        choiceId: 'reaction',
        reactions: {
          accept: [{ kind: 'move', trackId: 'missing', spaces: 1 }],
        },
        fallback: [],
      };
    },
  ],
  [
    'unknown effect source player',
    (s) => {
      s.engine.effects.source = { playerId: 999 };
    },
  ],
  [
    'unknown phase',
    (s) => {
      s.phase = 'missing';
    },
  ],
  [
    'duplicate player',
    (s) => {
      s.players!.push({ ...s.players![0] });
    },
  ],
  [
    'unknown turn player',
    (s) => {
      s.turn!.currentPlayerId = 999;
    },
  ],
  [
    'negative round',
    (s) => {
      s.engine.round.number = -1;
    },
  ],
  [
    'unknown round participant',
    (s) => {
      s.engine.round.participantPlayerIds.push(999);
    },
  ],
  [
    'unsafe score',
    (s) => {
      s.engine.playerValues.scores['1'] = Number.MAX_SAFE_INTEGER + 1;
    },
  ],
  [
    'invalid position',
    (s) => {
      s.engine.kits.movement!.positions.board['1'] = -1;
    },
  ],
  [
    'unknown card',
    (s) => {
      s.engine.kits.cards!.hands.hand['1'].push('missing');
    },
  ],
];

it.each(corruptions)(
  'rejects %s on restoration and projection without mutation',
  async (_name, corrupt) => {
    const definition = compileJsonGame(manifest, document);
    const game = await testGame(definition).players(2).seed(42).start();
    const source = game.state() as State;
    corrupt(source);
    const before = structuredClone(source);
    const runtime = new DeclarativeGameRuntime(definition);
    expect(() => runtime.applyActions(source, [])).toThrow();
    expect(() => runtime.exposeStateForUser(source, 1)).toThrow();
    expect(source).toEqual(before);
  },
);
