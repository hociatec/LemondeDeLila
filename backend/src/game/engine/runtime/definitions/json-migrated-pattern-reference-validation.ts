import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { assertProtectedHauntedRaceReferences } from './json-protected-haunted-race-reference-validation';
import { assertSharedPrestigeCardsReferences } from './json-shared-prestige-cards-pattern-schema';

type Failure = (path: string, reason: string) => never;

export function assertMigratedPatternReferences(
  pattern: JsonGamePattern,
  index: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  if (pattern.kind === 'protected-haunted-race')
    assertProtectedHauntedRaceReferences(pattern, index, components, fail);
  if (pattern.kind === 'shared-prestige-cards')
    assertSharedPrestigeCardsReferences(pattern, components);
}
