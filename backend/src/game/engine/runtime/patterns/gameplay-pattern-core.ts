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
    choices: Object.freeze({ ...(pattern.choices ?? {}) }),
    effects: Object.freeze({ ...(pattern.effects ?? {}) }),
    events: Object.freeze([...(pattern.events ?? [])]),
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
    triggers: patterns.flatMap((pattern) => pattern.triggers ?? []),
    actions: patterns.reduce<GameActionMap<TState>>(
      (merged, pattern) => ({
        ...merged,
        ...(pattern.actions ?? {}),
      }),
      {},
    ),
    choices: Object.assign({}, ...patterns.map((pattern) => pattern.choices)),
    effects: Object.assign({}, ...patterns.map((pattern) => pattern.effects)),
    viewExtension: patterns.find((pattern) => pattern.viewExtension)
      ?.viewExtension,
    bot: patterns.find((pattern) => pattern.bot)?.bot,
    setup: patterns.find((pattern) => pattern.setup)?.setup,
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
