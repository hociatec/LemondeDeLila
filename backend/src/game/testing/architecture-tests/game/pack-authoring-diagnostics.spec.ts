import { compileJsonGame } from '../../../rules/public-api';
import {
  AuthoringError,
  authoringValueAt,
} from '../../../engine/runtime/contracts/authoring-error';
import { createAuthorCodec } from '../../../engine/runtime/contracts/json-author-codec';
import { jsonStoryChallengeSchema } from '../../../rules/game-specific/choice-story-challenge/json-story-challenge-schema';
import type { StoryChallengeProgram } from '../../../rules/game-specific/choice-story-challenge/program';
import manifest from '../../../games/les-quatre-vents/contes-et-cacahuetes/manifest.json';
import document from '../../../games/les-quatre-vents/contes-et-cacahuetes/game.json';
import catalogue from '../../../games/les-quatre-vents/contes-et-cacahuetes/content/catalogue.json';
import hazardManifest from '../../../games/les-quatre-vents/ca-derape/manifest.json';
import rally from '../../fixtures/second-game-attempts/checkpoint-rally.json';

const base = createAuthorCodec<StoryChallengeProgram>(
  jsonStoryChallengeSchema,
).parse(
  {
    ...document.extensions[0].config,
    ...catalogue,
  },
  'storyChallenge',
);

type Case = {
  name: string;
  change: (program: StoryChallengeProgram) => void;
  field: string;
};
const cases: Case[] = [
  {
    name: 'registered resource',
    change: (p) => {
      p.resources.reroll = 'absent';
    },
    field: 'resources.reroll',
  },
  {
    name: 'token resource',
    change: (p) => {
      p.tokens = [{ id: 'unknown', resource: 'absent' }];
    },
    field: 'tokens[0].resource',
  },
  {
    name: 'start boundary',
    change: (p) => {
      p.tiles = [{ ...p.tiles[0], type: 'bonus' }, ...p.tiles.slice(1)];
    },
    field: 'tiles[0].type',
  },
  {
    name: 'finish boundary',
    change: (p) => {
      p.tiles = p.tiles.map((tile, i) =>
        i === p.tiles.length - 1 ? { ...tile, type: 'bonus' } : tile,
      );
    },
    field: `tiles[${base.tiles.length - 1}].type`,
  },
  {
    name: 'duplicate pawn',
    change: (p) => {
      p.pawns = [p.pawns[0], p.pawns[0]];
    },
    field: 'pawns[1].id',
  },
  {
    name: 'duplicate token',
    change: (p) => {
      p.tokens = [p.tokens[0], p.tokens[0]];
    },
    field: 'tokens[1].id',
  },
  {
    name: 'duplicate number',
    change: (p) => {
      p.numberOptions = [2, 2];
    },
    field: 'numberOptions[1]',
  },
  {
    name: 'target deck',
    change: (p) => {
      p.targetRules = {
        ...p.targetRules,
        ['rule.with.dot']: { kind: 'give-card', deck: 'absent' },
      };
    },
    field: 'targetRules["rule.with.dot"].deck',
  },
  {
    name: 'target options',
    change: (p) => {
      p.targetRules = {
        ...p.targetRules,
        ['rule.with.dot']: { kind: 'option', optionId: 'absent' },
      };
    },
    field: 'targetRules["rule.with.dot"].optionId',
  },
  {
    name: 'duplicate option',
    change: (p) => {
      p.optionRules = {
        ...p.optionRules,
        ['a["b"]']: [
          { id: 'same', kind: 'move', delta: 1 },
          { id: 'same', kind: 'move', delta: 2 },
        ],
      };
    },
    field: 'optionRules["a[\\"b\\"]"][1].id',
  },
  {
    name: 'option deck',
    change: (p) => {
      p.optionRules = {
        ...p.optionRules,
        ['rule.with.dot']: [
          { id: 'draw', kind: 'draw', deck: 'absent', target: 'actor' },
        ],
      };
    },
    field: 'optionRules["rule.with.dot"][0].deck',
  },
  {
    name: 'option target',
    change: (p) => {
      p.optionRules = {
        ...p.optionRules,
        ['rule.with.dot']: [{ id: 'select', kind: 'target', effect: 'absent' }],
      };
    },
    field: 'optionRules["rule.with.dot"][0].effect',
  },
  {
    name: 'duplicate card',
    change: (p) => {
      const card = { ...p.decks.bonus[0], type: 'deck.with.dot' };
      p.decks = { ...p.decks, ['deck.with.dot']: [card, card] };
    },
    field: 'decks["deck.with.dot"][1].id',
  },
  {
    name: 'card type',
    change: (p) => {
      p.decks = { ...p.decks, ['deck.with.dot']: [p.decks.bonus[0]] };
    },
    field: 'decks["deck.with.dot"][0].type',
  },
];

function expectDiagnostic(
  compile: () => unknown,
  source: unknown,
  field: string,
) {
  const path = `game.json.extensions[0].config.${field}`;
  try {
    compile();
    throw new Error('Expected authoring failure');
  } catch (error) {
    expect(error).toBeInstanceOf(AuthoringError);
    expect(error).toMatchObject({
      code: 'GAME_AUTHORING_ERROR',
      path,
      received: authoringValueAt(source, path.slice('game.json.'.length)),
    });
    expect(
      authoringValueAt(source, path.slice('game.json.'.length)),
    ).not.toBeUndefined();
  }
}

it.each(cases)(
  'pinpoints story $name in the public extension JSON',
  ({ change, field }) => {
    const config = structuredClone(base);
    change(config);
    const source = {
      ...document,
      extensions: [{ type: 'storyChallenge', config }],
    };
    expectDiagnostic(() => compileJsonGame(manifest, source), source, field);
  },
);

it.each(['lastRoll', 'lastMove', 'idleTurns'] as const)(
  'pinpoints hazard resource %s',
  (field) => {
    const source = structuredClone(rally);
    source.extensions[0].config.resources[field] = 'absent';
    expectDiagnostic(
      () => compileJsonGame(hazardManifest, source),
      source,
      `resources.${field}`,
    );
  },
);

it('accepts the unchanged story document', () => {
  expect(() =>
    compileJsonGame(manifest, document, {
      'content/catalogue.json': catalogue,
    }),
  ).not.toThrow();
});
