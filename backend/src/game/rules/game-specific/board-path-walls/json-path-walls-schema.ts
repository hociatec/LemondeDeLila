import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { PathWallsProgram } from './program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

const position = object(
  {
    x: { type: 'integer', minimum: 0, maximum: 18 },
    y: { type: 'integer', minimum: 0, maximum: 18 },
  },
  ['x', 'y'],
);
export const jsonPathWallsSchema: AuthorSchema = object(
  {
    boardId: id,
    pawnSetId: id,
    pawnChoiceId: id,
    wallsResourceId: id,
    wallsOverlayId: id,
    size: { type: 'integer', minimum: 3, maximum: 19 },
    defaultWallsPerPlayer: { type: 'integer', minimum: 0, maximum: 20 },
    startPositions: { ...array(position, 2), maxItems: 2 },
    pawns: array(
      object(
        {
          id,
          label: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 10000 },
        },
        ['id', 'label', 'description'],
      ),
      2,
    ),
  },
  [
    'boardId',
    'pawnSetId',
    'pawnChoiceId',
    'wallsResourceId',
    'wallsOverlayId',
    'size',
    'defaultWallsPerPlayer',
    'startPositions',
    'pawns',
  ],
);

export function assertPathWallsReferences(program: PathWallsProgram): void {
  const fail = authoringFailure('game.json.pathWalls', program);
  assertUniqueAuthorIds(program.pawns, 'pawns', fail);
  for (const [i, position] of program.startPositions.entries())
    for (const coordinate of ['x', 'y'] as const)
      if (position[coordinate] >= program.size)
        fail(
          `startPositions[${i}].${coordinate}`,
          'start position is outside the board',
        );
}
