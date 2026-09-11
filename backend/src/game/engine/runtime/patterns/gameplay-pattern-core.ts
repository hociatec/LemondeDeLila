import type { GamePattern } from '../contracts/pattern-definition';
import type { GameComponentDefinition } from '../definitions/component-kit';
import type { TurnPolicy } from './pattern-capabilities';

import type { GameActionMap } from '../contracts/author-rule-contracts';
import {
  composeGameConfigurations,
  type GameConfigurationShape,
} from './pattern-capabilities';
import {
  assertComposablePatterns,
  composeInitialization,
  composeLifecycle,
  composeVictory,
} from './gameplay-pattern-composition';

export function definePattern<
  TState extends object,
  TKind extends GameComponentDefinition['component'] =
    GameComponentDefinition['component'],
  const TMechanic extends string = string,
>(
  pattern: GamePattern<TState, TKind, TMechanic>,
): GamePattern<TState, TKind, TMechanic> {
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
    resourceIds: [
      ...new Set(patterns.flatMap((pattern) => pattern.resourceIds ?? [])),
    ],
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

export type { GamePattern } from '../contracts/pattern-definition';
