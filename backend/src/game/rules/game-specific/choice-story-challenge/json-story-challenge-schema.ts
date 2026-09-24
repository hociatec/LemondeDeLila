import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import {
  authoringFailure,
  authoringProperty,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { StoryChallengeProgram } from './program';
import { effectJsonSchema } from '../../../engine/sdk/extension-api';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const cardType = id;
const card = object({
  id: { type: 'integer', minimum: 1, maximum: 1000000 },
  type: cardType,
  title: text,
  text,
  effects: effectJsonSchema,
});

export const jsonStoryChallengeSchema: AuthorSchema = object({
  finishReason: id,
  diceId: id,
  deckRoles: object({ reward: id, penalty: id, event: id, story: id }),
  tokens: array({
    oneOf: [object({ id, resource: id }), object({ id, status: id })],
  }),
  targetRules: record({
    oneOf: [
      object({
        kind: { enum: ['move', 'follow'] },
        delta: { type: 'integer' },
      }),
      object({
        kind: { enum: ['swap-turns', 'swap-positions', 'steal-token'] },
      }),
      object({ kind: { const: 'give-card' }, deck: id }),
      object({ kind: { const: 'option' }, optionId: id }),
    ],
  }),
  optionRules: record(
    array(
      {
        oneOf: [
          object({ id, kind: { const: 'move' }, delta: { type: 'integer' } }),
          object({ id, kind: { const: 'target' }, effect: id }),
          object(
            {
              id,
              kind: { const: 'draw' },
              deck: id,
              target: { enum: ['actor', 'selected'] },
              consumeStatus: id,
            },
            ['id', 'kind', 'deck', 'target'],
          ),
        ],
      },
      1,
    ),
  ),
  giftTargetEffect: id,
  conditionalTargetEffect: id,
  numberOptions: array({ type: 'integer' }, 1),
  numberAdvance: { type: 'integer' },
  choiceDrawCount: { type: 'integer', minimum: 1, maximum: 100 },
  randomDrawDecks: array(id, 1),
  randomDrawCount: { type: 'integer', minimum: 1, maximum: 100 },
  forcedRoll: { type: 'integer', minimum: 1 },
  replacementRoll: { type: 'integer', minimum: 1 },
  lowRollThreshold: { type: 'integer', minimum: 1 },
  protectionAdvance: { type: 'integer' },
  trackId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  resolutionFlag: id,
  maxChainDepth: { type: 'integer', minimum: 1, maximum: 100 },
  resources: object({ reroll: id, shield: id }),
  statuses: object({
    protectNextMalus: id,
    cape: id,
    replaceOne: id,
    noBonus: id,
    forcedOne: id,
    reverseNextTurn: id,
    blocked: id,
    keyOfGold: id,
  }),
  tiles: array(
    object({
      id,
      type: id,
      label: text,
      description: text,
    }),
    2,
  ),
  pawns: array(object({ id: text, label: text, description: text }), 2),
  decks: record(array(card, 1)),
});

export function assertStoryChallengeReferences(
  program: StoryChallengeProgram,
  resources?: ReadonlySet<string>,
): void {
  const fail = authoringFailure(
    'game.json.storyChallenge',
    program,
    'StoryChallenge: ',
  );
  if (program.tiles[0]?.type !== 'start')
    fail('tiles[0].type', 'track requires a start boundary');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail(
      `tiles[${program.tiles.length - 1}].type`,
      'track requires a finish boundary',
    );
  assertUniqueAuthorIds(program.pawns, 'pawns', fail);
  const hasDeck = (key: string, field: string) => {
    if (!Object.hasOwn(program.decks, key)) fail(field, 'unknown deck ' + key);
  };
  for (const [field, resource] of Object.entries(program.resources))
    if (resources && !resources.has(resource))
      fail(`resources.${field}`, 'unknown resource ' + resource);
  for (const [index, token] of program.tokens.entries())
    if (resources && 'resource' in token && !resources.has(token.resource))
      fail(`tokens[${index}].resource`, 'unknown resource ' + token.resource);
  for (const [role, deck] of Object.entries(program.deckRoles))
    hasDeck(deck, `deckRoles.${role}`);
  program.randomDrawDecks.forEach((deck, index) =>
    hasDeck(deck, `randomDrawDecks[${index}]`),
  );
  if (program.randomDrawCount > program.randomDrawDecks.length)
    fail('randomDrawCount', 'draw count exceeds available decks');
  for (const field of ['giftTargetEffect', 'conditionalTargetEffect'] as const)
    if (!Object.hasOwn(program.targetRules, program[field]))
      fail(field, 'unknown target binding');
  for (const [key, rule] of Object.entries(program.targetRules)) {
    const path = authoringProperty('targetRules', key);
    if (rule.kind === 'give-card') hasDeck(rule.deck, `${path}.deck`);
    if (
      rule.kind === 'option' &&
      !Object.hasOwn(program.optionRules, rule.optionId)
    )
      fail(`${path}.optionId`, 'unknown options binding');
  }
  for (const [key, rules] of Object.entries(program.optionRules)) {
    const path = authoringProperty('optionRules', key);
    assertUniqueAuthorValues(
      rules.map((rule) => rule.id),
      (i) => `${path}[${i}].id`,
      fail,
    );
    for (const [index, rule] of rules.entries()) {
      if (rule.kind === 'draw') hasDeck(rule.deck, `${path}[${index}].deck`);
      if (
        rule.kind === 'target' &&
        !Object.hasOwn(program.targetRules, rule.effect)
      )
        fail(`${path}[${index}].effect`, 'unknown target option');
    }
  }
  assertUniqueAuthorIds(program.tokens, 'tokens', fail);
  assertUniqueAuthorValues(
    program.numberOptions,
    (i) => `numberOptions[${i}]`,
    fail,
  );
  for (const [index, tile] of program.tiles.entries())
    if (!['start', 'finish'].includes(tile.type))
      hasDeck(tile.type, `tiles[${index}].type`);
  for (const [type, cards] of Object.entries(program.decks)) {
    const path = authoringProperty('decks', type);
    assertUniqueAuthorValues(
      cards.map((entry) => entry.id),
      (i) => `${path}[${i}].id`,
      fail,
    );
    for (const [index, card] of cards.entries())
      if (card.type !== type)
        fail(`${path}[${index}].type`, 'card type must match its deck');
  }
}
