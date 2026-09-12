import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { TurnPolicy } from '../kits/turn-kit';
import type { VictoryRule } from '../contracts/author-rule-contracts';
import { assertNoImplicitInitializationOverrides } from './game-definition-override-validator';

export function mergeInitialization(
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
    deals: [...(pattern.deals ?? []), ...(game.deals ?? [])],
    gridPlacements: [
      ...(pattern.gridPlacements ?? []),
      ...(game.gridPlacements ?? []),
    ],
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
  if (value.deals && value.deals.length > 0) compact.deals = value.deals;
  if (value.gridPlacements && value.gridPlacements.length > 0)
    compact.gridPlacements = value.gridPlacements;
  return compact;
}

export function mergeInitializationRecords<TValue>(
  inherited: Readonly<Record<string, TValue>> | undefined,
  local: Readonly<Record<string, TValue>> | undefined,
): Record<string, TValue> | undefined {
  if (!inherited) return local ? { ...local } : undefined;
  if (!local) return { ...inherited };
  return { ...inherited, ...local };
}

export function mergeComponents(
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

export function resolveTurnPolicy(
  pattern: TurnPolicy | undefined,
  game: TurnPolicy | undefined,
): TurnPolicy | undefined {
  const selected = game ?? pattern;
  if (!selected) return undefined;
  const { overrides: _overrides, ...policy } = selected;
  return Object.freeze(policy as TurnPolicy);
}

export function mergeLifecycleHooks<TState extends object>(
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

export function mergeVictoryRules<TState extends object>(
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
