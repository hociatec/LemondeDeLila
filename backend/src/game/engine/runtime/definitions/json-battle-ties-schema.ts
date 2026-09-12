import type { BattleTiesProgram } from '../effect-packs/cards-battle-ties/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

export const jsonBattleTiesSchema: AuthorSchema = object(
  {
    deckId: id,
    handId: id,
    totalCards: { type: 'integer', minimum: 1, maximum: 10000 },
    cards: array(
      object(
        {
          id,
          name: { type: 'string', minLength: 1, maxLength: 1000 },
          type: id,
          color: id,
          family: id,
          value: { type: 'number' },
          allowedFamilies: array(id),
        },
        ['id', 'name', 'type', 'color', 'value'],
      ),
      1,
    ),
  },
  ['deckId', 'handId', 'totalCards', 'cards'],
);

export function assertBattleTiesReferences(program: BattleTiesProgram): void {
  const ids = program.cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('battle-ties cards card identifiers must be unique');
  if (program.totalCards !== program.cards.length)
    throw new Error(
      'battle-ties cards totalCards must match the card catalogue',
    );
}
