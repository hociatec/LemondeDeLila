import type { BoardGameProgram } from '../effect-packs/board-movement-landings/program';
import type { JsonGameCoreDocument } from '../../engine/runtime/definitions/json-game-core-document';

type Failure = (path: string, reason: string) => never;

export function assertBoardPawnCapacity(
  program: BoardGameProgram,
  document: JsonGameCoreDocument,
  maxPlayers: number,
  fail: Failure,
): void {
  const selection = program.pawnSelection;
  if (!selection) return;
  const pawns = document.components.find(
    (component) =>
      component.component === 'pawn.set' && component.id === selection.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.pawns.length < maxPlayers * pawns.perPlayer
  )
    fail(
      'board.pawnSelection',
      'not enough pawns for the maximum player count',
    );
}
