import type { BoardGameProgram } from './program';
import type { GameComponentDefinition } from '../../definitions/component-kit';

type Failure = (path: string, reason: string) => never;

export function assertBoardPawnCapacity(
  program: BoardGameProgram,
  document: { components: readonly GameComponentDefinition[] },
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
      'board.pawnSelection.setId',
      'not enough pawns for the maximum player count',
    );
}
