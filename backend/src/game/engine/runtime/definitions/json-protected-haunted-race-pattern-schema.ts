import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';

const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
const statuses = object({
  ignoreNextTrap: id,
  ignoreTrapUntilNextDraw: id,
  ignoreNextPrank: id,
  ignoreNextGhost: id,
  nextMoveCap: id,
  nextRollMalus: id,
  nextRollKeepLowest: id,
  nextRollDouble: id,
  nextRollIfThreeBackTwo: id,
  blocked: id,
});

export const protectedHauntedRacePatternSchema = object({
  kind: { const: 'protected-haunted-race' },
  rollRecipe: id,
  conditionalMove: object({
    equals: { type: 'integer' },
    delta: { type: 'integer' },
  }),
  protections: array(
    object({
      category: id,
      status: id,
      consume: { enum: ['draw', 'matching-card'] },
    }),
  ),
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  swapChoiceId: id,
  maxChainDepth: positive,
  finishReason: id,
  eventNamespace: id,
  statuses,
  tiles: array(
    object({
      n: positive,
      title: text,
      label: text,
      description: text,
      type: { enum: ['neutral', 'card', 'finish'] },
    }),
    2,
  ),
  cards: array(
    object({
      id: positive,
      localNumber: positive,
      category: id,
      text,
      effects: array(ref('effect')),
    }),
    1,
  ),
});
