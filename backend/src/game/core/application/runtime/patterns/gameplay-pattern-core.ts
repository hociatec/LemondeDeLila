import type {
  GameComponentDefinition,
  GameInitialization,
} from '../definitions/component-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { TurnPolicy } from '../kits/turn-kit';
import type { VictoryRule } from '../definitions/game-definition';
import type { GameActionMap } from '../definitions/game-definition';
import {
  composeGameConfigurations,
  type GameConfigurationShape,
} from '../configuration/configuration-kit';
import {
  assertComposablePatterns,
  composeInitialization,
  composeLifecycle,
  composeVictory,
} from './gameplay-pattern-composition';

export type GamePattern<TState extends object> = {
  readonly id: string;
  readonly mechanics: readonly string[];
  readonly components?: readonly GameComponentDefinition[];
  readonly lifecycle?: GameLifecycleHooks<TState>;
  readonly initialization?: GameInitialization;
  readonly turn?: TurnPolicy;
  readonly victory?: VictoryRule<TState>;
  readonly actions?: GameActionMap<TState>;
  readonly config?: GameConfigurationShape<TState>;
};

export function definePattern<TState extends object>(
  pattern: GamePattern<TState>,
): GamePattern<TState> {
  return Object.freeze({
    ...pattern,
    mechanics: Object.freeze([...pattern.mechanics]),
    components: Object.freeze([...(pattern.components ?? [])]),
    actions: Object.freeze({ ...(pattern.actions ?? {}) }),
  });
}

export function composePatterns<TState extends object>(
  ...patterns: readonly GamePattern<TState>[]
): Omit<GamePattern<TState>, 'id'> & { ids: string[] } {
  assertComposablePatterns(patterns);
  return {
    ids: patterns.map((pattern) => pattern.id),
    mechanics: [...new Set(patterns.flatMap((pattern) => pattern.mechanics))],
    components: patterns.flatMap((pattern) => pattern.components ?? []),
    actions: patterns.reduce<GameActionMap<TState>>(
      (merged, pattern) => ({
        ...merged,
        ...(pattern.actions ?? {}),
      }),
      {},
    ),
    lifecycle: composeLifecycle(
      patterns.flatMap((pattern) =>
        pattern.lifecycle ? [pattern.lifecycle] : [],
      ),
    ),
    initialization: composeInitialization(
      patterns.map((pattern) => pattern.initialization),
    ),
    turn: patterns.reduce<TurnPolicy | undefined>(
      (selected, pattern) => pattern.turn ?? selected,
      undefined,
    ),
    victory: composeVictory(
      patterns.flatMap((pattern) => (pattern.victory ? [pattern.victory] : [])),
    ),
    config: patterns.reduce<GameConfigurationShape<TState> | undefined>(
      (configuration, pattern) =>
        composeGameConfigurations(configuration, pattern.config),
      undefined,
    ),
  };
}
