import { compileJsonPattern } from '../definitions/json-game-patterns';
import { compileWithPatternDiagnostic } from '../definitions/json-pattern-diagnostics';
import type { JsonGameDocument } from '../definitions/json-game-schema';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { GameEventDefinition } from '../events/game-event-definition';
import type { JsonEffectPackCatalog } from '../contracts/json-effect-pack-catalog';
import type { JsonEffectPackContribution } from '../contracts/json-effect-pack';
import type { GameActionShape } from '../contracts/author-rule-contracts';
import { AuthoringError } from '../contracts/authoring-error';

type CompiledPattern = ReturnType<typeof compileJsonPattern>;

export type CompiledJsonPrograms = {
  readonly contributions: ReadonlyMap<string, JsonEffectPackContribution>;
  readonly actions: Readonly<
    Record<string, GameActionShape<Record<string, never>>>
  >;
  readonly events: GameEventDefinition<string, object>[];
  readonly components: GameComponentDefinition[];
  readonly patterns: CompiledPattern[];
};

export function compileJsonPrograms(
  document: JsonGameDocument,
  jsonEffectPacks: JsonEffectPackCatalog = [],
): CompiledJsonPrograms {
  const sources = new Map<string, unknown>(Object.entries(document));
  const contributions = new Map<string, JsonEffectPackContribution>();
  const actions: Record<string, GameActionShape<Record<string, never>>> = {};
  const events: GameEventDefinition<string, object>[] = [];
  const components: GameComponentDefinition[] = [];
  const patterns =
    document.patterns?.map((pattern, index) =>
      compileWithPatternDiagnostic(pattern, index, () =>
        compileJsonPattern(pattern),
      ),
    ) ?? [];
  for (const extension of jsonEffectPacks) {
    const source = sources.get(extension.documentKey);
    if (source === undefined) {
      continue;
    }
    const contribution = extension.compileContribution(source);
    contributions.set(extension.outputKey, contribution);
    for (const key of Object.keys(contribution.actions))
      if (Object.hasOwn(actions, key))
        throw new AuthoringError(
          `game.json.${extension.documentKey}`,
          'unique extension action recipe',
          key,
        );
    Object.assign(actions, contribution.actions);
    events.push(...contribution.events);
    components.push(...contribution.components);
    patterns.push(...contribution.patterns);
  }
  return {
    contributions,
    actions,
    events,
    components,
    patterns,
  };
}
