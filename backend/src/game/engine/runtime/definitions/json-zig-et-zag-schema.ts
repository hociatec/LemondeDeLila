import type { ZigEtZagProgram } from '../contracts/zig-et-zag-program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

export const jsonZigEtZagSchema: AuthorSchema = object(
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

export function assertZigEtZagReferences(program: ZigEtZagProgram): void {
  const ids = program.cards.map((card) => card.id);
  if (new Set(ids).size !== ids.length)
    throw new Error('Zig et Zag card identifiers must be unique');
  if (program.totalCards !== program.cards.length)
    throw new Error('Zig et Zag totalCards must match the card catalogue');
}
