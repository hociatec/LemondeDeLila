import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { TurnPolicy } from '../kits/turn-kit';
import { assertGameDefinition } from './game-definition-validator';
import { composeGameConfigurations } from '../configuration/configuration-kit';
import { defineGameContent } from '../content/game-content';
import {
  composePatterns,
  type GamePattern,
} from '../patterns/gameplay-patterns';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import { GAME_DEFINITION_KIND } from './game-definition-contracts';
import type {
  CompiledGameDefinition,
  GameActionMap,
  GameDefinitionInput,
  NoGameState,
  VictoryRule,
} from './game-definition-contracts';
import type { GameEventDefinition } from '../events/game-event-definition';
import { describeCompiledGameDefinition } from './compiled-game-diagnostics';

type GameDefinitionBuilder<TState extends object> = <
  const TActions extends GameActionMap<TState>,
  const TViewExtension extends object = object,
  const TInitialization extends GameInitialization = Record<never, never>,
  const TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly [],
  const TPatterns extends readonly GamePattern<TState>[] = readonly [],
>(
  definition: GameDefinitionInput<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
) => CompiledGameDefinition<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents,
  TPatterns
>;

/**
 * Curried form (`defineGame<State>()({...})`) keeps definition-owned literals
 * inferable after the state type has been selected. The direct form remains
 * available for state-less fixtures and compatibility.
 */
export function defineGame<
  TState extends object = NoGameState,
>(): GameDefinitionBuilder<TState>;
export function defineGame<
  TState extends object = NoGameState,
  TActions extends GameActionMap<TState> = GameActionMap<TState>,
  TViewExtension extends object = object,
>(
  definition: GameDefinitionInput<TState, TActions, TViewExtension>,
): CompiledGameDefinition<TState, TActions, TViewExtension>;
export function defineGame(definition?: unknown): unknown {
  if (definition == null) {
    return (
      input: GameDefinitionInput<object, GameActionMap<object>, object>,
    ) => compileGameDefinition(input);
  }
  return compileGameDefinition(
    definition as GameDefinitionInput<object, GameActionMap<object>, object>,
  );
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
  const { patterns, components, content } = prepareDefinitionComposition(
    definition as unknown as GameDefinitionInput<
      TState,
      GameActionMap<TState>,
      object
    >,
  );
  const normalizedBase = {
    stateVersion: 1,
    rulesVersion: '1',
    migrations: [],
    contentMigrations: [],
    ...definition,
    content,
    contentVersion: definition.contentVersion ?? content.version,
    patterns: [...(definition.patterns ?? [])],
    components,
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
      [definition.initialPhase ?? 'playing']: {},
    },
  };
  return finalizeCompiledDefinition(normalizedBase) as CompiledGameDefinition<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >;
}

function prepareDefinitionComposition<TState extends object>(
  definition: GameDefinitionInput<TState, GameActionMap<TState>, object>,
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

function finalizeCompiledDefinition(normalizedBase: object): unknown {
  const descriptor = normalizedBase as CompiledGameDefinition<
    object,
    GameActionMap<object>,
    object
  >;
  const normalized = {
    ...normalizedBase,
    compiled: describeCompiledGameDefinition(descriptor),
  };
  assertGameDefinition(
    normalized as unknown as Parameters<typeof assertGameDefinition>[0],
  );
  return deepFreeze({ ...normalized, kind: GAME_DEFINITION_KIND });
}

function assertNoImplicitActionOverrides<TState extends object>(
  patternActions: GameActionMap<TState>,
  gameActions: GameActionMap<TState>,
  gameId: string,
): void {
  for (const [actionId, action] of Object.entries(gameActions)) {
    if (!(actionId in patternActions)) continue;
    if (action.overrides === actionId) continue;
    throw new GameConfigurationError(
      `Action "${actionId}" fournie par un pattern et redéfinie par "${gameId}" sans overrideAction() explicite`,
    );
  }
}

function mergeInitialization(
  pattern?: GameInitialization,
  game?: GameInitialization,
): GameInitialization | undefined {
  if (!pattern) return game;
  if (!game) return pattern;
  assertNoImplicitInitializationOverrides(pattern, game);
  const overriddenPawnSets = new Set(
    (game.overrides ?? [])
      .filter((key) => key.startsWith('pawns.'))
      .map((key) => key.slice('pawns.'.length)),
  );
  const pawns = [
    ...(pattern.pawns ?? []).filter(
      (pawn) => !overriddenPawnSets.has(pawn.setId),
    ),
    ...(game.pawns ?? []),
  ];
  return compactInitialization({
    firstPlayer: game.firstPlayer ?? pattern.firstPlayer,
    startRound: game.startRound ?? pattern.startRound,
    scores: game.scores ?? pattern.scores,
    resources: mergeInitializationRecords(pattern.resources, game.resources),
    counters: mergeInitializationRecords(pattern.counters, game.counters),
    tracks: mergeInitializationRecords(pattern.tracks, game.tracks),
    pawns,
  });
}

function compactInitialization(value: GameInitialization): GameInitialization {
  const compact: GameInitialization = {};
  if (value.firstPlayer != null) compact.firstPlayer = value.firstPlayer;
  if (value.startRound != null) compact.startRound = value.startRound;
  if (value.scores != null) compact.scores = value.scores;
  if (value.resources && Object.keys(value.resources).length > 0)
    compact.resources = value.resources;
  if (value.counters && Object.keys(value.counters).length > 0)
    compact.counters = value.counters;
  if (value.tracks && Object.keys(value.tracks).length > 0)
    compact.tracks = value.tracks;
  if (value.pawns && value.pawns.length > 0) compact.pawns = value.pawns;
  return compact;
}

function mergeInitializationRecords<TValue>(
  inherited: Readonly<Record<string, TValue>> | undefined,
  local: Readonly<Record<string, TValue>> | undefined,
): Record<string, TValue> | undefined {
  if (!inherited) return local ? { ...local } : undefined;
  if (!local) return { ...inherited };
  return { ...inherited, ...local };
}

function mergeComponents(
  patternComponents: readonly GameComponentDefinition[],
  gameComponents: readonly GameComponentDefinition[],
): GameComponentDefinition[] {
  const replaced = new Set(
    gameComponents
      .map((component) => component.overrides)
      .filter((key): key is string => Boolean(key)),
  );
  return [
    ...patternComponents.filter(
      (component) => !replaced.has(`${component.component}:${component.id}`),
    ),
    ...gameComponents.map(({ overrides: _overrides, ...component }) =>
      Object.freeze(component as GameComponentDefinition),
    ),
  ];
}

function resolveTurnPolicy(
  pattern: TurnPolicy | undefined,
  game: TurnPolicy | undefined,
): TurnPolicy | undefined {
  const selected = game ?? pattern;
  if (!selected) return undefined;
  const { overrides: _overrides, ...policy } = selected;
  return Object.freeze(policy as TurnPolicy);
}

function assertNoImplicitComponentOverrides(
  patternComponents: readonly GameComponentDefinition[],
  gameComponents: readonly GameComponentDefinition[],
  gameId: string,
): void {
  const patternKeys = new Set(
    patternComponents.map(
      (component) => `${component.component}:${component.id}`,
    ),
  );
  for (const component of gameComponents) {
    const key = `${component.component}:${component.id}`;
    if (patternKeys.has(key) && component.overrides !== key) {
      throw new GameConfigurationError(
        `Composant "${key}" fourni par un pattern et redéfini par "${gameId}" sans overrideComponent() explicite`,
      );
    }
  }
}

function assertNoImplicitTurnOverride(
  pattern: TurnPolicy | undefined,
  game: TurnPolicy | undefined,
  gameId: string,
): void {
  if (!pattern || !game || sameTurnPolicy(pattern, game)) return;
  if (game.overrides) return;
  throw new GameConfigurationError(
    `Politique de tour fournie par un pattern et redéfinie par "${gameId}" sans overrideTurn() explicite`,
  );
}

function assertNoImplicitInitializationOverrides(
  pattern: GameInitialization,
  game: GameInitialization,
): void {
  const overrides = new Set(game.overrides ?? []);
  const assertKeys = (
    kind: 'resources' | 'counters' | 'tracks',
    labels: Readonly<Record<string, unknown>> | undefined,
    inherited: Readonly<Record<string, unknown>> | undefined,
  ) => {
    for (const key of Object.keys(labels ?? {})) {
      if (!(key in (inherited ?? {}))) continue;
      const overrideKey = `${kind}.${key}`;
      if (!overrides.has(overrideKey)) {
        throw new GameConfigurationError(
          `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
        );
      }
    }
  };
  assertKeys('resources', game.resources, pattern.resources);
  assertKeys('counters', game.counters, pattern.counters);
  assertKeys('tracks', game.tracks, pattern.tracks);
  if (
    game.scores != null &&
    pattern.scores != null &&
    !overrides.has('scores')
  ) {
    throw new GameConfigurationError(
      'Initialisation scores fournie par un pattern et redéfinie sans overrideInitialization(["scores"], ...) explicite',
    );
  }
  const patternPawns = new Set((pattern.pawns ?? []).map((pawn) => pawn.setId));
  for (const pawn of game.pawns ?? []) {
    const overrideKey = `pawns.${pawn.setId}`;
    if (patternPawns.has(pawn.setId) && !overrides.has(overrideKey)) {
      throw new GameConfigurationError(
        `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
      );
    }
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return left.kind === right.kind && left.actionPoints === right.actionPoints;
}

function mergeLifecycleHooks<TState extends object>(
  patternHooks?: GameLifecycleHooks<TState>,
  gameHooks?: GameLifecycleHooks<TState>,
): GameLifecycleHooks<TState> | undefined {
  if (!patternHooks) return gameHooks;
  if (!gameHooks) return patternHooks;
  return {
    beforeTurn: mergeHook(patternHooks.beforeTurn, gameHooks.beforeTurn),
    afterTurn: mergeHook(patternHooks.afterTurn, gameHooks.afterTurn),
    onRoundStart: mergeHook(patternHooks.onRoundStart, gameHooks.onRoundStart),
    onRoundEnd: mergeHook(patternHooks.onRoundEnd, gameHooks.onRoundEnd),
  };
}

function mergeHook<TInput>(
  first?: (input: TInput) => void,
  second?: (input: TInput) => void,
): ((input: TInput) => void) | undefined {
  if (!first) return second;
  if (!second) return first;
  return (input) => {
    first(input);
    second(input);
  };
}

function mergeVictoryRules<TState extends object>(
  gameRule?: VictoryRule<TState>,
  patternRule?: VictoryRule<TState>,
): VictoryRule<TState> | undefined {
  if (!gameRule) return patternRule;
  if (!patternRule) return gameRule;
  return {
    evaluate: (input) =>
      gameRule.evaluate(input) ?? patternRule.evaluate(input),
  };
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (
    value == null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
