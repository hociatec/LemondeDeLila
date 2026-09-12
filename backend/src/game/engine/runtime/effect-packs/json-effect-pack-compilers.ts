import { compileJsonPattern } from '../definitions/json-game-patterns';
import type { JsonGameDocument } from '../definitions/json-game-schema';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { GameEventDefinition } from '../events/game-event-definition';
import {
  jsonEffectPacks,
  type RegisteredJsonEffectPack,
} from './json-effect-pack-registry';

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type CompiledEffectPackEntry<Pack> = Pack extends RegisteredJsonEffectPack
  ? {
      readonly [Key in Pack['outputKey']]: ReturnType<Pack['compile']> | null;
    }
  : never;

type CompiledPattern = ReturnType<typeof compileJsonPattern>;

export type CompiledJsonPrograms = UnionToIntersection<
  CompiledEffectPackEntry<RegisteredJsonEffectPack>
> & {
  readonly actions: Readonly<Record<string, unknown>>;
  readonly events: GameEventDefinition<string, object>[];
  readonly components: GameComponentDefinition[];
  readonly patterns: CompiledPattern[];
};

export function compileJsonPrograms(
  document: JsonGameDocument,
): CompiledJsonPrograms {
  const sources = new Map<string, unknown>(Object.entries(document));
  const compiledPrograms: Record<string, unknown> = {};
  const actions: Record<string, unknown> = {};
  const events: GameEventDefinition<string, object>[] = [];
  const components: GameComponentDefinition[] = [];
  const patterns = document.patterns?.map(compileJsonPattern) ?? [];
  for (const extension of jsonEffectPacks) {
    const source = sources.get(extension.documentKey);
    if (source === undefined) {
      compiledPrograms[extension.outputKey] = null;
      continue;
    }
    const compiled = extension.compileUnknown(source);
    compiledPrograms[extension.outputKey] = compiled;
    Object.assign(actions, extension.collectActions(compiled));
    events.push(
      ...(extension.collectEvents(compiled) as GameEventDefinition<
        string,
        object
      >[]),
    );
    components.push(
      ...(extension.collectComponents(compiled) as GameComponentDefinition[]),
    );
    patterns.push(
      ...(extension.collectPatterns(compiled) as CompiledPattern[]),
    );
  }
  return {
    ...compiledPrograms,
    actions,
    events,
    components,
    patterns,
  } as CompiledJsonPrograms;
}
