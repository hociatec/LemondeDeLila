import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRecord as record,
} from '../contracts/json-author-schema';

const keyedIds = record(id);

export const treasureTrackRacePatternSchema = object({
  kind: { const: 'treasure-track-race' },
  rollRecipe: id,
  trackId: id,
  diceId: id,
  tiles: array(
    object({
      n: { type: 'integer', minimum: 0, maximum: 10000 },
      title: { type: 'string', minLength: 1, maxLength: 2000 },
      description: { type: 'string', maxLength: 10000 },
      type: id,
    }),
    2,
  ),
  tileRules: record({
    oneOf: [
      object({ kind: { enum: ['none', 'finish'] } }),
      object({ kind: { const: 'draw' }, deck: id }),
      object({ kind: { const: 'gain' }, amount: positive }),
    ],
  }),
  deckRules: record(
    object({
      resolveEffects: { type: 'boolean' },
      protected: { type: 'boolean' },
    }),
  ),
  victoryCollection: id,
  decks: keyedIds,
  inventories: keyedIds,
  goldResource: id,
  obstacleImmunityStatus: id,
  collectionLimit: positive,
  requiredTreasures: positive,
  requiredGold: positive,
  retreatSpaces: positive,
  finishReason: id,
  stealEffectId: id,
  eventNamespace: id,
});
