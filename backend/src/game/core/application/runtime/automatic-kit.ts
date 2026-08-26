import type { AutomaticRule, VictoryRule } from './game-definition';

export function when<TState extends object>(
  id: string,
  predicate: AutomaticRule<TState>['when'],
  apply: AutomaticRule<TState>['apply'],
): AutomaticRule<TState> {
  return Object.freeze({ id, when: predicate, apply });
}

export function victoryWhen<TState extends object>(
  predicate: VictoryRule<TState>['evaluate'],
): VictoryRule<TState> {
  return Object.freeze({ evaluate: predicate });
}
