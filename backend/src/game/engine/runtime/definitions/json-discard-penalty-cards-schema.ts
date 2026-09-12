import type { DiscardPenaltyCardsProgram } from '../effect-packs/cards-discard-penalty/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const card: AuthorSchema = {
  oneOf: [
    { type: 'integer', minimum: -1_000_000, maximum: 1_000_000 },
    { type: 'string', minLength: 1, maxLength: 128 },
  ],
};
export const jsonDiscardPenaltyCardsSchema: AuthorSchema = object({
  deckId: id,
  handId: id,
  returnChoiceId: id,
  pauseChoiceId: id,
  drawnTurnFlag: id,
  orderedValues: { ...array(card, 64), minItems: 2 },
  specialValue: card,
  specialScore: { type: 'integer', minimum: 0, maximum: 1_000_000 },
  cards: { ...array(card, 140), maxItems: 140 },
  defaults: object({
    loseAtScore: { type: 'integer', minimum: 5, maximum: 200 },
    roundPauseSeconds: { type: 'integer', minimum: 0, maximum: 120 },
    allowPlayAfterDraw: boolean,
    startingHandSize: { type: 'integer', minimum: 1, maximum: 20 },
    copiesPerCardValue: { type: 'integer', minimum: 1, maximum: 20 },
    returnTokenFromRound: { type: 'integer', minimum: 1, maximum: 50 },
  }),
});

export function assertDiscardPenaltyCardsReferences(
  program: DiscardPenaltyCardsProgram,
): void {
  if (!program.orderedValues.includes(program.specialValue))
    throw new Error('specialValue must belong to orderedValues');
  if (new Set(program.orderedValues).size !== program.orderedValues.length)
    throw new Error('orderedValues must contain unique values');
  if (program.cards.some((card) => !program.orderedValues.includes(card)))
    throw new Error('Every card must belong to orderedValues');
  const counts = program.orderedValues.map(
    (value) => program.cards.filter((card) => card === value).length,
  );
  if (counts.some((count) => count === 0 || count !== counts[0]))
    throw new Error(
      'Every ordered value must have the same non-zero copy count',
    );
}
