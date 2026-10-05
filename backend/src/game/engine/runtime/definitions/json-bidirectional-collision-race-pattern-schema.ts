import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';

export const bidirectionalCollisionRacePatternSchema = object({
  kind: { const: 'bidirectional-collision-race' },
  rollRecipe: id,
  drawRecipe: id,
  pendingDrawFlag: id,
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  appleResource: id,
  iouPrefix: id,
  returningStatus: id,
  applesToWin: positive,
  maxDepth: positive,
  finishReason: id,
  tiles: array(
    object(
      {
        n: positive,
        type: { enum: ['start', 'neutral', 'card', 'bonus', 'skip', 'finish'] },
        region: id,
        title: { type: 'string', maxLength: 10000 },
        label: { type: 'string', maxLength: 10000 },
        description: { type: 'string', maxLength: 10000 },
        apples: { type: 'integer', minimum: 0, maximum: 1000000 },
        skipTurns: { type: 'integer', minimum: 0, maximum: 1000000 },
      },
      ['n', 'type', 'region'],
    ),
    2,
  ),
  cards: array(
    object({
      id: positive,
      text: { type: 'string', minLength: 1, maxLength: 10000 },
      effects: array(ref('effect')),
    }),
    1,
  ),
});
