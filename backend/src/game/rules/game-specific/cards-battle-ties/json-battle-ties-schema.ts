import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { BattleTiesProgram } from './program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

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
  const fail = authoringFailure('game.json.battleTies', program);
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  if (program.totalCards !== program.cards.length)
    fail('totalCards', 'totalCards must match the card catalogue');
}
