import type { JsonGameDocument } from './json-game-schema';

type Failure = (path: string, reason: string) => never;

export function assertBoardPawnCapacity(
  document: JsonGameDocument,
  maxPlayers: number,
  fail: Failure,
): void {
  const selection = document.board?.pawnSelection;
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
