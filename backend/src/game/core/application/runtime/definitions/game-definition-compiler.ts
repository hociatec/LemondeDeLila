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
import { GameConfigurationError } from '../../../domain/errors/game-domain.errors';
import { GAME_DEFINITION_KIND } from './game-definition-contracts';
import type {
  CompiledGameDefinition,
  CompiledGameDiagnostics,
  GameActionMap,
  GameDefinitionInput,
  NoGameState,
  VictoryRule,
} from './game-definition-contracts';

type CompiledDescriptorInput = Pick<
  CompiledGameDefinition<object, GameActionMap<object>, object>,
  | 'id'
  | 'patterns'
  | 'components'
  | 'actions'
  | 'phases'
  | 'choices'
  | 'effects'
  | 'automatic'
  | 'lifecycle'
  | 'turn'
  | 'victory'
  | 'content'
  | 'stateVersion'
  | 'contentVersion'
  | 'rulesVersion'
>;

export function defineGame<
  TState extends object = NoGameState,
  TActions extends GameActionMap<TState> = GameActionMap<TState>,
  TViewExtension extends object = object,
>(
  definition: GameDefinitionInput<TState, TActions, TViewExtension>,
): CompiledGameDefinition<TState, TActions, TViewExtension> {
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
    definition.content ??
    defineGameContent(definition.id, {
      components,
    });
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
  const normalized = {
    ...normalizedBase,
    compiled: describeCompiledGameDefinition(
      normalizedBase as unknown as CompiledGameDefinition<
        object,
        GameActionMap<object>,
        object
      >,
    ),
  };
  assertGameDefinition(normalized);
  return deepFreeze({ ...normalized, kind: GAME_DEFINITION_KIND });
}

export function describeCompiledGameDefinition(
  definition: CompiledDescriptorInput,
): CompiledGameDiagnostics {
  return {
    compiledAt: 'defineGame',
    gameId: definition.id,
    patternIds: Object.freeze(
      (definition.patterns ?? []).map((pattern) => pattern.id),
    ),
    mechanics: Object.freeze([
      ...new Set(
        (definition.patterns ?? []).flatMap((pattern) => pattern.mechanics),
      ),
    ]),
    componentIds: Object.freeze(
      (definition.components ?? []).map(
        (component) => `${component.component}:${component.id}`,
      ),
    ),
    actionIds: Object.freeze(Object.keys(definition.actions)),
    phaseIds: Object.freeze(Object.keys(definition.phases ?? {})),
    choiceIds: Object.freeze(Object.keys(definition.choices ?? {})),
    effectIds: Object.freeze(Object.keys(definition.effects ?? {})),
    automaticRuleIds: Object.freeze(
      (definition.automatic ?? []).map((rule) => rule.id),
    ),
    hookOrder: Object.freeze(
      [
        definition.lifecycle?.beforeTurn ? 'beforeTurn' : null,
        definition.lifecycle?.afterTurn ? 'afterTurn' : null,
        definition.lifecycle?.onRoundStart ? 'onRoundStart' : null,
        definition.lifecycle?.onRoundEnd ? 'onRoundEnd' : null,
      ].filter((hook): hook is string => hook != null),
    ),
    lifecycleHookSources: Object.freeze(
      lifecycleHookSources(definition.patterns ?? [], definition.lifecycle),
    ),
    turnPolicy: definition.turn
      ? {
          kind: definition.turn.kind,
          ...(definition.turn.actionPoints == null
            ? {}
            : { actionPoints: definition.turn.actionPoints }),
        }
      : null,
    turnPolicySource: definition.turn
      ? 'game'
      : ((definition.patterns ?? []).find((pattern) => pattern.turn)?.id ??
        null),
    victoryPriority: Object.freeze(
      [
        definition.victory ? 'game' : null,
        (definition.patterns ?? []).some((pattern) => pattern.victory)
          ? 'pattern'
          : null,
      ].filter((source): source is 'game' | 'pattern' => source != null),
    ),
    actionSources: Object.freeze(actionSources(definition)),
    componentSources: Object.freeze(componentSources(definition)),
    phaseSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.phases ?? {}).map((id) => [id, 'game']),
      ),
    ),
    choiceSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.choices ?? {}).map((id) => [id, 'game']),
      ),
    ),
    effectSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.effects ?? {}).map((id) => [id, 'game']),
      ),
    ),
    contentVersion: definition.contentVersion,
    stateVersion: definition.stateVersion,
    rulesVersion: definition.rulesVersion,
  };
}

function actionSources(
  definition: Pick<
    CompiledGameDefinition<object, GameActionMap<object>, object>,
    'patterns' | 'actions'
  >,
): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const pattern of definition.patterns ?? []) {
    for (const actionId of Object.keys(pattern.actions ?? {})) {
      sources[actionId] = pattern.id;
    }
  }
  for (const [actionId, action] of Object.entries(definition.actions)) {
    sources[actionId] = action.overrides
      ? `game overrides ${action.overrides}`
      : 'game';
  }
  return sources;
}

function componentSources(
  definition: Pick<
    CompiledGameDefinition<object, GameActionMap<object>, object>,
    'patterns' | 'components'
  >,
): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const pattern of definition.patterns ?? []) {
    for (const component of pattern.components ?? []) {
      sources[`${component.component}:${component.id}`] = pattern.id;
    }
  }
  for (const component of definition.components ?? []) {
    sources[`${component.component}:${component.id}`] ??= 'game';
  }
  return sources;
}

function lifecycleHookSources<TState extends object>(
  patterns: readonly GamePattern<TState>[],
  gameHooks?: GameLifecycleHooks<TState>,
): Record<string, string[]> {
  const sources: Record<string, string[]> = {};
  for (const pattern of patterns) {
    for (const hook of lifecycleHookNames(pattern.lifecycle)) {
      (sources[hook] ??= []).push(pattern.id);
    }
  }
  for (const hook of lifecycleHookNames(gameHooks)) {
    (sources[hook] ??= []).push('game');
  }
  return sources;
}

function lifecycleHookNames<TState extends object>(
  hooks?: GameLifecycleHooks<TState>,
): string[] {
  return [
    hooks?.beforeTurn ? 'beforeTurn' : null,
    hooks?.afterTurn ? 'afterTurn' : null,
    hooks?.onRoundStart ? 'onRoundStart' : null,
    hooks?.onRoundEnd ? 'onRoundEnd' : null,
  ].filter((hook): hook is string => hook != null);
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
