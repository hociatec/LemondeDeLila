import type { GridPlacementProgram } from '../effect-packs/spatial-grid-placement/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorObject as object,
  authorId as id,
  authorBoolean as boolean,
  type AuthorSchema,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

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
    pawnSelection: object({
      setId: id,
      choiceId: id,
      order: { enum: ['players', 'shuffled'] },
    }),
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
  if (!program.markEvent.startsWith(`${gameId}.`))
    throw new GameConfigurationError(
      'Grid event must belong to its game namespace',
    );
  if (program.winLength > Math.max(program.width, program.height))
    throw new GameConfigurationError(
      'Grid winning line cannot fit on the board',
    );
  const cells = new Set<string>();
  for (const { x, y } of program.preferredCells) {
    const key = `${x},${y}`;
    if (x >= program.width || y >= program.height || cells.has(key))
      throw new GameConfigurationError(
        'Invalid or duplicated preferred grid cell',
      );
    cells.add(key);
  }
  if (
    components.some(
      (c) => c.component === 'grid.board' && c.id === program.boardId,
    )
  )
    throw new GameConfigurationError('Grid program owns its board component');
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
      throw new GameConfigurationError(
        'Grid selection requires one available pawn per player',
      );
  }
}
