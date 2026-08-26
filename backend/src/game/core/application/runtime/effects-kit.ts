import type { GameRuleContext } from './game-rule-context';

export type GameEffect<TState extends object, TInput = void> = (input: {
  state: TState;
  value: TInput;
  ctx: GameRuleContext<TState>;
}) => void | TState;

export function effect<TState extends object, TInput = void>(
  apply: GameEffect<TState, TInput>,
): GameEffect<TState, TInput> {
  return apply;
}

export function sequenceEffects<TState extends object, TInput = void>(
  ...effects: readonly GameEffect<TState, TInput>[]
): GameEffect<TState, TInput> {
  return (input) => {
    for (const apply of effects) {
      const next = apply(input);
      if (next) input.ctx.replaceState(next);
    }
  };
}
