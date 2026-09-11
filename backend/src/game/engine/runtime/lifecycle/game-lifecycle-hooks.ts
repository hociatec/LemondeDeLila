import type { PlayerState } from '../../../core/application/models/game-state.model';
import type { GameContext } from '../definitions/game-author-context';

export type TurnLifecycleInput<TState extends object> = {
  state: TState;
  player: PlayerState | null;
  ctx: GameContext<TState>;
};

export type RoundLifecycleInput<TState extends object> = {
  state: TState;
  roundNumber: number;
  ctx: GameContext<TState>;
};

export interface GameLifecycleHooks<TState extends object> {
  readonly beforeTurn?: (input: TurnLifecycleInput<TState>) => void;
  readonly afterTurn?: (input: TurnLifecycleInput<TState>) => void;
  readonly onRoundStart?: (input: RoundLifecycleInput<TState>) => void;
  readonly onRoundEnd?: (input: RoundLifecycleInput<TState>) => void;
}
