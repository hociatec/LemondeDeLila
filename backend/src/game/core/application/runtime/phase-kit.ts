import type { GameRuleContext } from './game-rule-context';

export interface PhaseConfiguration<TState extends object> {
  readonly actions?: readonly string[];
  readonly enter?: (input: {
    state: TState;
    ctx: GameRuleContext<TState>;
  }) => void | TState;
  readonly exit?: (input: {
    state: TState;
    ctx: GameRuleContext<TState>;
  }) => void | TState;
  readonly next?: string;
  readonly autoTransition?: (input: {
    state: TState;
    ctx: GameRuleContext<TState>;
  }) => boolean;
}

export function phase<TState extends object>(
  configuration: PhaseConfiguration<TState>,
): PhaseConfiguration<TState> {
  return Object.freeze(configuration);
}
