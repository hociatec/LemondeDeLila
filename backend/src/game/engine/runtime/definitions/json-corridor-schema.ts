import type { CorridorProgram } from '../extensions/corridor/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const position = object(
  {
    x: { type: 'integer', minimum: 0, maximum: 18 },
    y: { type: 'integer', minimum: 0, maximum: 18 },
  },
  ['x', 'y'],
);
export const jsonCorridorSchema: AuthorSchema = object(
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

export function assertCorridorReferences(program: CorridorProgram): void {
  if (
    new Set(program.pawns.map((pawn) => pawn.id)).size !== program.pawns.length
  )
    throw new Error('Corridor pawn identifiers must be unique');
  if (
    program.startPositions.some(
      (position) => position.x >= program.size || position.y >= program.size,
    )
  )
    throw new Error('Corridor start position is outside the board');
}
