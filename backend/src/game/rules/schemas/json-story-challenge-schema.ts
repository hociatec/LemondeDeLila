import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';
import type { StoryChallengeProgram } from '../effect-packs/choice-story-challenge/program';
import { effectJsonSchema } from '../../engine/runtime/contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
} from '../../engine/runtime/contracts/json-author-schema';

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
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('StoryChallenge: ' + reason);
  };
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('track requires start and finish boundaries');
  if (
    new Set(program.pawns.map((pawn) => pawn.id)).size !== program.pawns.length
  )
    fail('pawn identifiers must be unique');
  const hasDeck = (key: string) => {
    if (!Object.hasOwn(program.decks, key)) fail('unknown deck ' + key);
  };
  for (const resource of [
    ...Object.values(program.resources),
    ...program.tokens.flatMap((token) =>
      'resource' in token ? [token.resource] : [],
    ),
  ])
    if (!resources.has(resource)) fail('unknown resource ' + resource);
  Object.values(program.deckRoles).forEach(hasDeck);
  program.randomDrawDecks.forEach(hasDeck);
  if (program.randomDrawCount > program.randomDrawDecks.length)
    fail('draw count exceeds available decks');
  if (
    !Object.hasOwn(program.targetRules, program.giftTargetEffect) ||
    !Object.hasOwn(program.targetRules, program.conditionalTargetEffect)
  )
    fail('unknown target binding');
  for (const rule of Object.values(program.targetRules)) {
    if (rule.kind === 'give-card') hasDeck(rule.deck);
    if (
      rule.kind === 'option' &&
      !Object.hasOwn(program.optionRules, rule.optionId)
    )
      fail('unknown options binding');
  }
  for (const rules of Object.values(program.optionRules)) {
    if (new Set(rules.map((rule) => rule.id)).size !== rules.length)
      fail('duplicate option');
    for (const rule of rules) {
      if (rule.kind === 'draw') hasDeck(rule.deck);
      if (
        rule.kind === 'target' &&
        !Object.hasOwn(program.targetRules, rule.effect)
      )
        fail('unknown target option');
    }
  }
  if (
    new Set(program.tokens.map((token) => token.id)).size !==
      program.tokens.length ||
    new Set(program.numberOptions).size !== program.numberOptions.length
  )
    fail('duplicate choice option');
  for (const tile of program.tiles)
    if (!['start', 'finish'].includes(tile.type)) hasDeck(tile.type);
  for (const [type, cards] of Object.entries(program.decks)) {
    if (new Set(cards.map((entry) => entry.id)).size !== cards.length)
      fail('card identifiers must be unique within each deck');
    if (cards.some((entry) => entry.type !== type))
      fail('card type must match its deck');
  }
}
