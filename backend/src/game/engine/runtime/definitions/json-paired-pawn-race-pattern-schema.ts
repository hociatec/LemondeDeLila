import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRecord as record,
  authorRef as ref,
} from '../contracts/json-author-schema';

export const pairedPawnRacePatternSchema = object({
  kind: { const: 'paired-pawn-race' },
  rollRecipe: id,
  tileRules: record(
    object({
      kind: {
        enum: ['none', 'gain', 'draw', 'move', 'skip', 'meeting', 'finish'],
      },
      amount: { type: 'integer' },
    }),
  ),
  transferAmount: positive,
  sharedAdvance: { type: 'integer' },
  meetingAdvance: { type: 'integer' },
  rollMinimum: positive,
  rollAdvance: { type: 'integer' },
  trackId: id,
  diceId: id,
  deckId: id,
  tokenResource: id,
  bonusRerollStatus: id,
  tokensToWin: positive,
  maxDepth: positive,
  finishReason: id,
  eventNamespace: id,
  tiles: array(
    object({
      id: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: id,
    }),
    2,
  ),
  cards: array(
    object({
      id: { type: 'integer', minimum: 0, maximum: 1000000 },
      text: { type: 'string', minLength: 1, maxLength: 10000 },
      effects: array(ref('effect')),
    }),
    1,
  ),
});
