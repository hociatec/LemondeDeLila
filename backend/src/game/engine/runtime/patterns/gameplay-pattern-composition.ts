import { GameConfigurationError } from '../contracts/game-domain.errors';
import type { GameInitialization } from '../definitions/component-kit';
import type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from './pattern-capabilities';
import type { VictoryRule } from '../contracts/author-rule-contracts';
import type { TurnPolicy } from './pattern-capabilities';
import type { GamePattern } from '../contracts/pattern-definition';
import { withAuthoringPath } from '../contracts/authoring-origin';
import { authoringProperty } from '../contracts/authoring-diagnostics';

export function assertComposablePatterns<TState extends object>(
  patterns: readonly GamePattern<TState>[],
): void {
  const seenPatternIds = new Set<string>();
  const seenComponentKeys = new Set<string>();
  const seenActionKeys = new Set<string>();
  const initializedResources = new Map<string, string>();
  const initializedCounters = new Map<string, string>();
  const initializedTracks = new Map<string, string>();
  const initializedPawns = new Map<string, string>();
  let selectedTurn: { id: string; policy: TurnPolicy } | null = null;
  for (const [patternIndex, pattern] of patterns.entries()) {
    const path = `patterns[${patternIndex}]`;
    if (seenPatternIds.has(pattern.id)) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composition de patterns invalide: pattern dupliqué « ${pattern.id} »`,
        ),
        `${path}.id`,
      );
    }
    seenPatternIds.add(pattern.id);

    assertPatternMembers(pattern, path, seenComponentKeys, seenActionKeys);

    assertInitializationKeys(
      pattern.initialization?.resources,
      initializedResources,
      pattern.id,
      'resource',
      `${path}.initialization.resources`,
    );
    assertInitializationKeys(
      pattern.initialization?.counters,
      initializedCounters,
      pattern.id,
      'counter',
      `${path}.initialization.counters`,
    );
    assertInitializationKeys(
      pattern.initialization?.tracks,
      initializedTracks,
      pattern.id,
      'track',
      `${path}.initialization.tracks`,
    );
    assertPawnInitialization(pattern, initializedPawns, path);

    if (!pattern.turn) continue;
    if (!selectedTurn) {
      selectedTurn = { id: pattern.id, policy: pattern.turn };
      continue;
    }
    if (sameTurnPolicy(selectedTurn.policy, pattern.turn)) continue;
    throw withAuthoringPath(
      new GameConfigurationError(
        `Composition de patterns invalide: politiques de tour incompatibles « ${selectedTurn.id} » et « ${pattern.id} »`,
      ),
      `${path}.turn`,
    );
  }
}

function assertPatternMembers<TState extends object>(
  pattern: GamePattern<TState>,
  path: string,
  seenComponentKeys: Set<string>,
  seenActionKeys: Set<string>,
): void {
  for (const [index, component] of (pattern.components ?? []).entries()) {
    const id = 'id' in component ? component.id : undefined;
    const key = `${component.component}:${String(id)}`;
    if (seenComponentKeys.has(key)) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composition de patterns invalide: composant dupliqué « ${key} »`,
        ),
        `${path}.components[${index}].id`,
      );
    }
    seenComponentKeys.add(key);
  }

  for (const actionId of Object.keys(pattern.actions ?? {})) {
    if (seenActionKeys.has(actionId)) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composition de patterns invalide: action dupliquée « ${actionId} »`,
        ),
        authoringProperty(`${path}.actions`, actionId),
      );
    }
    seenActionKeys.add(actionId);
  }
}

function assertPawnInitialization<TState extends object>(
  pattern: GamePattern<TState>,
  initializedPawns: Map<string, string>,
  path: string,
): void {
  for (const [index, pawn] of (pattern.initialization?.pawns ?? []).entries()) {
    const key = `${pawn.setId}:${index}`;
    const previous = initializedPawns.get(key);
    if (previous) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composition de patterns invalide: initialisation de pion dupliquée « ${key} » par « ${previous} » et « ${pattern.id} »`,
        ),
        `${path}.initialization.pawns[${index}].setId`,
      );
    }
    initializedPawns.set(key, pattern.id);
  }
}

function assertInitializationKeys<TValue>(
  values: Readonly<Record<string, TValue>> | undefined,
  seen: Map<string, string>,
  patternId: string,
  kind: string,
  path: string,
): void {
  for (const key of Object.keys(values ?? {})) {
    const previous = seen.get(key);
    if (previous) {
      throw withAuthoringPath(
        new GameConfigurationError(
          `Composition de patterns invalide: initialisation ${kind} dupliquée « ${key} » par « ${previous} » et « ${patternId} »`,
        ),
        authoringProperty(path, key),
      );
    }
    seen.set(key, patternId);
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return (
    left.kind === right.kind &&
    (left.actionPoints ?? null) === (right.actionPoints ?? null)
  );
}

export function composeInitialization(
  initializations: ReadonlyArray<GameInitialization | undefined>,
): GameInitialization | undefined {
  const active = initializations.filter(Boolean) as GameInitialization[];
  if (active.length === 0) return undefined;
  return active.reduce<GameInitialization>(
    (result, value) => ({
      ...result,
      ...value,
      scores: value.scores ?? result.scores,
      resources: { ...result.resources, ...value.resources },
      counters: { ...result.counters, ...value.counters },
      tracks: { ...result.tracks, ...value.tracks },
      pawns: [...(result.pawns ?? []), ...(value.pawns ?? [])],
    }),
    {},
  );
}

export function composeLifecycle<TState extends object>(
  hooks: readonly GameLifecycleHooks<TState>[],
): GameLifecycleHooks<TState> | undefined {
  if (hooks.length === 0) return undefined;
  return {
    beforeTurn: composeTurnHooks(hooks.map((hook) => hook.beforeTurn)),
    afterTurn: composeTurnHooks(hooks.map((hook) => hook.afterTurn)),
    onRoundStart: composeRoundHooks(hooks.map((hook) => hook.onRoundStart)),
    onRoundEnd: composeRoundHooks(hooks.map((hook) => hook.onRoundEnd)),
  };
}

function composeTurnHooks<TState extends object>(
  hooks: ReadonlyArray<GameLifecycleHooks<TState>['beforeTurn'] | undefined>,
): GameLifecycleHooks<TState>['beforeTurn'] {
  const active = hooks.filter(Boolean) as Array<
    NonNullable<GameLifecycleHooks<TState>['beforeTurn']>
  >;
  if (active.length === 0) return undefined;
  return (input: TurnLifecycleInput<TState>) => {
    for (const hook of active) hook(input);
  };
}

function composeRoundHooks<TState extends object>(
  hooks: ReadonlyArray<GameLifecycleHooks<TState>['onRoundStart'] | undefined>,
): GameLifecycleHooks<TState>['onRoundStart'] {
  const active = hooks.filter(Boolean) as Array<
    NonNullable<GameLifecycleHooks<TState>['onRoundStart']>
  >;
  if (active.length === 0) return undefined;
  return (input: RoundLifecycleInput<TState>) => {
    for (const hook of active) hook(input);
  };
}

export function composeVictory<TState extends object>(
  rules: readonly VictoryRule<TState>[],
): VictoryRule<TState> | undefined {
  if (rules.length === 0) return undefined;
  return {
    evaluate: (input) => {
      for (const rule of rules) {
        const result = rule.evaluate(input);
        if (result) return result;
      }
      return null;
    },
  };
}
