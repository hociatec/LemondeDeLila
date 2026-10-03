import { compileJsonPattern } from '../definitions/json-game-patterns';
import { compileWithPatternDiagnostic } from '../definitions/json-pattern-diagnostics';
import type { JsonGameDocument } from '../definitions/json-game-schema';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { GameEventDefinition } from '../events/game-event-definition';
import type { JsonEngineExtensionCatalog } from '../contracts/json-engine-extension-catalog';
import type { JsonEngineExtensionContribution } from '../contracts/json-engine-extension';
import type { GameActionShape } from '../contracts/author-rule-contracts';
import type { ChoiceResolverShape } from '../contracts/author-rule-contracts';
import { AuthoringError } from '../contracts/authoring-error';

type CompiledPattern = ReturnType<typeof compileJsonPattern>;

export type CompiledJsonPrograms = {
  readonly contributions: ReadonlyMap<string, JsonEngineExtensionContribution>;
  readonly actions: Readonly<
    Record<string, GameActionShape<Record<string, never>>>
  >;
  readonly choices: Readonly<
    Record<string, ChoiceResolverShape<Record<string, never>>>
  >;
  readonly events: GameEventDefinition<string, object>[];
  readonly components: GameComponentDefinition[];
  readonly patterns: CompiledPattern[];
};

export function compileJsonPrograms(
  document: JsonGameDocument,
  jsonEngineExtensions: JsonEngineExtensionCatalog = [],
): CompiledJsonPrograms {
  const sources = new Map<string, unknown>(Object.entries(document));
  const contributions = new Map<string, JsonEngineExtensionContribution>();
  const actions: Record<string, GameActionShape<Record<string, never>>> = {};
  const choices: Record<
    string,
    ChoiceResolverShape<Record<string, never>>
  > = {};
  const events: GameEventDefinition<string, object>[] = [];
  const components: GameComponentDefinition[] = [];
  const compiledPatterns =
    document.patterns?.map((pattern, index) =>
      compileWithPatternDiagnostic(pattern, index, () =>
        compileJsonPattern(pattern),
      ),
    ) ?? [];
  for (const pattern of compiledPatterns) {
    Object.assign(actions, pattern.actions ?? {});
    Object.assign(choices, pattern.choices ?? {});
    events.push(...(pattern.events ?? []));
  }
  const patterns: CompiledPattern[] = compiledPatterns.map((pattern) => ({
    ...pattern,
    actions: {},
    choices: {},
    events: [],
  }));
  for (const extension of jsonEngineExtensions) {
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
    choices,
    events,
    components,
    patterns,
  };
}
