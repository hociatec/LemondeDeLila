import type {
  AutomaticRule,
  VictoryRule,
} from '../definitions/game-definition';

export function when<TState extends object>(
  id: string,
  predicate: AutomaticRule<TState>['when'],
  apply: AutomaticRule<TState>['apply'],
  options: { priority?: number } = {},
): AutomaticRule<TState> {
  return Object.freeze({ id, when: predicate, apply, ...options });
}

export function victoryWhen<TState extends object>(
  predicate: VictoryRule<TState>['evaluate'],
): VictoryRule<TState> {
  return Object.freeze({ evaluate: predicate });
}
