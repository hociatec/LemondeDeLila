import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';

const label = { type: 'string', minLength: 1, maxLength: 200 } as const;
export const teamPawnRacePatternSchema = object({
  kind: { const: 'team-pawn-race' },
  rollRecipe: id,
  setId: id,
  diceId: id,
  familyChoiceId: id,
  moveChoiceId: id,
  families: array(
    object({ id, family: label, habitat: label, pawns: array(label, 1) }),
    2,
  ),
  trackLength: positive,
  homeLength: positive,
  safeTiles: array({ type: 'integer', minimum: 0, maximum: 10000 }),
  finishReason: id,
  entryRolls: array(positive, 1),
  extraTurnRolls: array(positive),
  startPositions: array({ type: 'integer', minimum: 0 }, 2),
  homeRolls: array(positive),
});
