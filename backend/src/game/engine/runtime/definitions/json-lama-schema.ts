import type { LamaProgram } from '../extensions/lama/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const card: AuthorSchema = { enum: [1, 2, 3, 4, 5, 6, 'LAMA'] };
export const jsonLamaSchema: AuthorSchema = object({
  deckId: id,
  handId: id,
  returnChoiceId: id,
  pauseChoiceId: id,
  drawnTurnFlag: id,
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

export function assertLamaReferences(program: LamaProgram): void {
  const expected = [1, 2, 3, 4, 5, 6, 'LAMA'] as const;
  for (const value of expected)
    if (program.cards.filter((card) => card === value).length !== 20)
      throw new Error('LAMA requires twenty cards of every value');
}
