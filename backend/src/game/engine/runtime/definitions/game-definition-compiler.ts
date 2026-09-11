import {
  mergeInitialization,
  mergeComponents,
  resolveTurnPolicy,
  mergeLifecycleHooks,
  mergeVictoryRules,
} from './game-definition-composition';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import { assertGameDefinition } from './game-definition-validator';
import { composeGameConfigurations } from '../configuration/configuration-kit';
import { defineGameContent } from '../content/game-content';
import { contentDigest } from '../content/content-digest';
import { deepFreeze as freezeStaticGraph } from '../content/content-immutability';
import { composePatterns } from '../patterns/gameplay-patterns';
import { type GamePattern } from '../contracts/pattern-definition';
import {
  assertNoImplicitActionOverrides,
  assertNoImplicitComponentOverrides,
  assertNoImplicitTurnOverride,
} from './game-definition-override-validator';
import { GAME_DEFINITION_KIND } from './game-definition-contracts';
import type {
  CompiledGameDefinition,
  GameDefinitionInput,
} from './game-definition-contracts';
import type {
  GameActionMap,
  NoGameState,
} from '../contracts/author-rule-contracts';
import type { GameEventDefinition } from '../events/game-event-definition';
import {
  describeCompiledGameDefinition,
  type CompiledDescriptorInput,
} from './compiled-game-diagnostics';
import type { DefinitionToValidate } from '../contracts/definition-validation';
import { markCompiledGameDefinition } from './compiled-game-definition-brand';
import type {
  componentCapabilities,
  mechanicCapabilities,
} from '../contracts/compiled-game-plan';
import { compileGamePlan } from './game-plan-compiler';
import type { OptionalGameCapability } from '../contracts/compiled-game-plan';

const compiledDefinitions = new WeakMap<object, unknown>();

type GameDefinitionBuilder<TState extends object> = <
  const TActions extends GameActionMap<TState>,
  const TViewExtension extends object = object,
  const TInitialization extends GameInitialization = Record<never, never>,
  const TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly [],
  const TPatterns extends readonly GamePattern<TState>[] = readonly [],
  const TComponents extends readonly GameComponentDefinition[] = readonly [],
  const TResourceIds extends readonly string[] = readonly [],
  const TCapabilities extends readonly OptionalGameCapability[] = readonly [],
>(
  definition: Omit<
    GameDefinitionInput<
      TState,
      TActions,
      TViewExtension,
      TInitialization,
      TEvents,
      TPatterns
    >,
    'components' | 'resourceIds' | 'capabilities'
  > & {
    readonly components?: TComponents;
    readonly resourceIds?: TResourceIds;
    readonly capabilities?: TCapabilities;
  },
) => Omit<
  CompiledGameDefinition<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
  'components' | 'resourceIds' | 'capabilities' | 'initialization'
> & {
  readonly resourceIds: readonly (
    TResourceIds[number] | PatternResourceId<TPatterns[number]>
  )[];
  readonly initialization?: TInitialization &
    PatternInitialization<TPatterns[number]>;
  readonly capabilities: readonly (
    | TCapabilities[number]
    | CapabilityForComponent<
        TComponents[number] | PatternComponent<TPatterns[number]>
      >
    | CapabilityForPattern<TPatterns[number]>
  )[];
  readonly components: readonly (
    TComponents[number] | PatternComponent<TPatterns[number]>
  )[];
};

type PatternResourceId<T> = T extends {
  readonly resourceIds?: readonly (infer Id extends string)[];
}
  ? Id
  : never;
type PatternInitialization<T> = [T] extends [never]
  ? Record<never, never>
  : T extends { readonly initialization?: infer I }
    ? NonNullable<I>
    : Record<never, never>;
type CapabilityForComponent<T> = T extends { readonly component: infer K }
  ? K extends keyof typeof componentCapabilities
    ? (typeof componentCapabilities)[K]
    : never
  : never;
type CapabilityForPattern<T> = T extends {
  readonly mechanics: readonly (infer K)[];
}
  ? K extends keyof typeof mechanicCapabilities
    ? (typeof mechanicCapabilities)[K][number]
    : never
  : never;

type PatternComponent<TPattern> = TPattern extends {
  readonly components?: readonly (infer TComponent)[];
}
  ? TComponent
  : never;

/**
 * Curried form (`defineGame<State>()({...})`) keeps definition-owned literals
 * inferable after the state type has been selected. The direct form is the
 * official concise syntax for games whose state is entirely owned by kits.
 */
export function defineGame<
  TState extends object = NoGameState,
>(): GameDefinitionBuilder<TState>;
export function defineGame<
  TState extends object = NoGameState,
  const TActions extends GameActionMap<TState> = GameActionMap<TState>,
  const TViewExtension extends object = object,
  const TInitialization extends GameInitialization = Record<never, never>,
  const TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly [],
  const TPatterns extends readonly GamePattern<TState>[] = readonly [],
  const TComponents extends readonly GameComponentDefinition[] = readonly [],
  const TResourceIds extends readonly string[] = readonly [],
  const TCapabilities extends readonly OptionalGameCapability[] = readonly [],
>(
  definition: Omit<
    GameDefinitionInput<
      TState,
      TActions,
      TViewExtension,
      TInitialization,
      TEvents,
      TPatterns
    >,
    'components' | 'resourceIds' | 'capabilities'
  > & {
    readonly components?: TComponents;
    readonly resourceIds?: TResourceIds;
    readonly capabilities?: TCapabilities;
  },
): Omit<
  CompiledGameDefinition<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
  'components' | 'resourceIds' | 'capabilities' | 'initialization'
> & {
  readonly resourceIds: readonly (
    TResourceIds[number] | PatternResourceId<TPatterns[number]>
  )[];
  readonly initialization?: TInitialization &
    PatternInitialization<TPatterns[number]>;
  readonly capabilities: readonly (
    | TCapabilities[number]
    | CapabilityForComponent<
        TComponents[number] | PatternComponent<TPatterns[number]>
      >
    | CapabilityForPattern<TPatterns[number]>
  )[];
  readonly components: readonly (
    TComponents[number] | PatternComponent<TPatterns[number]>
  )[];
};
export function defineGame(definition?: unknown): unknown {
  if (definition == null) {
    return (
      input: GameDefinitionInput<object, GameActionMap<object>, object>,
    ) => compileOnce(input);
  }
  return compileOnce(
    definition as GameDefinitionInput<object, GameActionMap<object>, object>,
  );
}

function compileOnce(
  definition: GameDefinitionInput<object, GameActionMap<object>, object>,
): unknown {
  const cached = compiledDefinitions.get(definition);
  if (cached) return cached;
  const compiled = compileGameDefinition(definition);
  Object.freeze(definition);
  compiledDefinitions.set(definition, compiled);
  compiledDefinitions.set(compiled, compiled);
  markCompiledGameDefinition(compiled);
  return compiled;
}

function compileGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object,
  TInitialization extends GameInitialization = Record<never, never>,
  TEvents extends readonly GameEventDefinition<string, object>[] = readonly [],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
>(
  definition: GameDefinitionInput<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
): CompiledGameDefinition<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents,
  TPatterns
> {
  const { patterns, components, content } =
    prepareDefinitionComposition(definition);
  const normalizedBase = {
    stateVersion: 1,
    rulesVersion: '1',
    ...definition,
    automatic: orderAutomaticRules(definition.automatic ?? []),
    content,
    contentVersion: definition.contentVersion ?? content.version,
    patterns: [...(definition.patterns ?? [])],
    components,
    resourceIds: [
      ...new Set([
        ...(patterns.resourceIds ?? []),
        ...(definition.resourceIds ?? []),
      ]),
    ],
    actions: {
      ...(patterns.actions ?? {}),
      ...definition.actions,
    },
    initialization: mergeInitialization(
      patterns.initialization,
      definition.initialization,
    ),
    turn: resolveTurnPolicy(patterns.turn, definition.turn),
    lifecycle: mergeLifecycleHooks(patterns.lifecycle, definition.lifecycle),
    victory: mergeVictoryRules(definition.victory, patterns.victory),
    config: composeGameConfigurations(patterns.config, definition.config),
    initialPhase:
      definition.initialPhase ??
      Object.keys(definition.phases ?? {})[0] ??
      'playing',
    phases: definition.phases ?? {
      [definition.initialPhase ?? 'playing']: { terminal: true },
    },
  };
  const compiled = finalizeCompiledDefinition(
    normalizedBase,
  ) as CompiledGameDefinition<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >;
  return compiled;
}

function prepareDefinitionComposition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object,
  TInitialization extends GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[],
>(
  definition: GameDefinitionInput<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
) {
  const patterns = composePatterns(...(definition.patterns ?? []));
  assertNoImplicitComponentOverrides(
    patterns.components ?? [],
    definition.components ?? [],
    definition.id,
  );
  assertNoImplicitTurnOverride(patterns.turn, definition.turn, definition.id);
  const components = mergeComponents(
    patterns.components ?? [],
    definition.components ?? [],
  );
  assertNoImplicitActionOverrides(
    patterns.actions ?? {},
    definition.actions,
    definition.id,
  );
  const content =
    definition.content ?? defineGameContent(definition.id, { components });
  return { patterns, components, content };
}

function finalizeCompiledDefinition<TState extends object>(
  normalizedBase: DefinitionToValidate &
    CompiledDescriptorInput<TState> & {
      capabilities?: readonly OptionalGameCapability[];
    },
): unknown {
  const normalized = {
    ...normalizedBase,
    compiled: describeCompiledGameDefinition(normalizedBase),
  };
  assertGameDefinition(normalized);
  const plan = compileGamePlan(normalized);
  return deepFreeze(
    freezeStaticGraph({
      ...normalized,
      contentDigest: contentDigest(normalized.content),
      patterns: plan.patterns,
      capabilities: plan.capabilities,
      plan,
      kind: GAME_DEFINITION_KIND,
    }),
  );
}

function deepFreeze<TValue>(
  value: TValue,
  visited = new WeakSet<object>(),
): TValue {
  if (
    value == null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    visited.has(value)
  ) {
    return value;
  }
  visited.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, visited);
  return Object.freeze(value);
}

function orderAutomaticRules<T extends { priority?: number }>(
  rules: readonly T[],
): T[] {
  return rules
    .map((rule, declarationIndex) => ({ rule, declarationIndex }))
    .sort(
      (left, right) =>
        (right.rule.priority ?? 0) - (left.rule.priority ?? 0) ||
        left.declarationIndex - right.declarationIndex,
    )
    .map(({ rule }) => rule);
}
