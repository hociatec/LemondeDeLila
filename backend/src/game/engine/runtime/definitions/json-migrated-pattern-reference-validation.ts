import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { assertProtectedHauntedRaceReferences } from './json-protected-haunted-race-reference-validation';
import { assertSharedPrestigeCardsReferences } from './json-shared-prestige-cards-pattern-schema';
import { assertResourceTrackRaceReferences } from './json-resource-track-race-pattern-schema';

type Failure = (path: string, reason: string) => never;
type Context = {
  components: readonly GameComponentDefinition[];
  resources: ReadonlySet<string>;
  counters: ReadonlySet<string>;
  fail: Failure;
};

export function assertMigratedPatternReferences(
  pattern: JsonGamePattern,
  index: number,
  context: Context,
): void {
  const { components, resources, counters, fail } = context;
  if (pattern.kind === 'protected-haunted-race')
    assertProtectedHauntedRaceReferences(pattern, index, components, fail);
  if (pattern.kind === 'shared-prestige-cards')
    assertSharedPrestigeCardsReferences(pattern, components);
  if (pattern.kind === 'resource-track-race')
    assertResourceTrackRaceReferences(
      pattern.config,
      components,
      resources,
      counters,
    );
}
