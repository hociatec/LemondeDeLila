import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertGridPlacementReferences(
  pattern: Extract<JsonGamePattern, { kind: 'grid-placement' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  gameId: string,
  maximumPlayers: number,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  if (!pattern.markEvent.startsWith(`${gameId}.`))
    fail(`${root}.markEvent`, 'grid event must belong to the game namespace');
  if (pattern.winLength > Math.max(pattern.width, pattern.height))
    fail(`${root}.winLength`, 'winning line cannot fit on the board');
  const cells = new Set<string>();
  for (const [index, { x, y }] of pattern.preferredCells.entries()) {
    const key = `${x},${y}`;
    if (x >= pattern.width)
      fail(`${root}.preferredCells[${index}].x`, 'cell outside board width');
    if (y >= pattern.height)
      fail(`${root}.preferredCells[${index}].y`, 'cell outside board height');
    if (cells.has(key))
      fail(`${root}.preferredCells[${index}]`, 'duplicate preferred cell');
    cells.add(key);
  }
  if (!pattern.pawnSelection) return;
  const pawns = components.find(
    (component) =>
      component.component === 'pawn.set' &&
      component.id === pattern.pawnSelection?.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.perPlayer !== 1 ||
    pawns.pawns.length < maximumPlayers
  )
    fail(
      `${root}.pawnSelection.setId`,
      'one available pawn per player required',
    );
}
