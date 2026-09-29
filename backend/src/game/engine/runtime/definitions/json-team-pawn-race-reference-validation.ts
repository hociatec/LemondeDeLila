import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertTeamPawnRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'team-pawn-race' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const familyIds = new Set<string>();
  for (const [index, family] of pattern.families.entries()) {
    if (familyIds.has(family.id))
      fail(`${root}.families[${index}].id`, 'duplicate value');
    familyIds.add(family.id);
  }
  const set = components.find(
    (item) => item.component === 'pawn.set' && item.id === pattern.setId,
  );
  const dice = components.find(
    (item) => item.component === 'dice.set' && item.id === pattern.diceId,
  );
  if (
    set?.component !== 'pawn.set' ||
    set.spaces !== pattern.trackLength + pattern.homeLength
  )
    fail(`${root}.setId`, 'invalid pawn set');
  if (dice?.component !== 'dice.set') fail(`${root}.diceId`, 'unknown dice');
  if (pattern.startPositions.length < pattern.families.length)
    fail(`${root}.startPositions`, 'invalid start positions');
  if (pattern.homeRolls.length !== pattern.homeLength - 1)
    fail(`${root}.homeRolls`, 'one roll per home transition required');
  for (const field of ['startPositions', 'safeTiles'] as const) {
    const seen = new Set<number>();
    pattern[field].forEach((position, index) => {
      if (position >= pattern.trackLength)
        fail(`${root}.${field}[${index}]`, 'position outside track');
      if (field === 'startPositions' && seen.has(position))
        fail(`${root}.${field}[${index}]`, 'duplicate value');
      seen.add(position);
    });
  }
  pattern.families.forEach((family, index) => {
    if (set?.component === 'pawn.set' && family.pawns.length !== set.perPlayer)
      fail(`${root}.families[${index}].pawns`, 'family pawn count mismatch');
  });
}
