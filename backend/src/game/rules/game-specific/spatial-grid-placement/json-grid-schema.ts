import { authoringFailure } from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { GridPlacementProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorObject as object,
  authorId as id,
  authorBoolean as boolean,
  type AuthorSchema,
} from '../../../engine/runtime/contracts/json-author-schema';

const size: AuthorSchema = { type: 'integer', minimum: 1, maximum: 32 };
const coordinate: AuthorSchema = { type: 'integer', minimum: 0, maximum: 31 };
export const jsonGridSchema = object(
  {
    boardId: id,
    width: size,
    height: size,
    winLength: size,
    drawWhenFull: boolean,
    winnerReason: id,
    drawReason: id,
    markEvent: id,
    preferredCells: array(object({ x: coordinate, y: coordinate })),
    pawnSelection: object(
      {
        setId: id,
        choiceId: id,
        order: { enum: ['players', 'shuffled'] },
        automatic: boolean,
      },
      ['setId', 'choiceId', 'order'],
    ),
  },
  [
    'boardId',
    'width',
    'height',
    'winLength',
    'drawWhenFull',
    'winnerReason',
    'drawReason',
    'markEvent',
    'preferredCells',
  ],
);

export function assertGridReferences(
  program: GridPlacementProgram,
  components: readonly GameComponentDefinition[],
  maxPlayers: number,
  gameId: string,
): void {
  const fail = authoringFailure('game.json.grid', program);
  if (!program.markEvent.startsWith(`${gameId}.`))
    fail('markEvent', 'Grid event must belong to its game namespace');
  if (program.winLength > Math.max(program.width, program.height))
    fail('winLength', 'Grid winning line cannot fit on the board');
  const cells = new Set<string>();
  for (const [i, { x, y }] of program.preferredCells.entries()) {
    const key = `${x},${y}`;
    if (x >= program.width)
      fail(`preferredCells[${i}].x`, 'Cell outside board width');
    if (y >= program.height)
      fail(`preferredCells[${i}].y`, 'Cell outside board height');
    if (cells.has(key))
      fail(`preferredCells[${i}]`, 'Duplicated preferred grid cell');
    cells.add(key);
  }
  if (
    components.some(
      (c) => c.component === 'grid.board' && c.id === program.boardId,
    )
  )
    fail('boardId', 'Grid program owns its board component');
  if (program.pawnSelection) {
    const selection = program.pawnSelection;
    const pawns = components.find(
      (c) => c.component === 'pawn.set' && c.id === selection.setId,
    );
    if (
      pawns?.component !== 'pawn.set' ||
      pawns.perPlayer !== 1 ||
      pawns.pawns.length < maxPlayers
    )
      fail(
        'pawnSelection.setId',
        'Grid selection requires one available pawn per player',
      );
  }
}
