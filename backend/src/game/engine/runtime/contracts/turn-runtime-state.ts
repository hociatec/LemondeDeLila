import type { GameState } from '../../../core/application/models/game-state.model';
import type { PlayerValuesKitState } from '../kits/player-values-contracts';
import type { MatchKitState } from '../kits/match-kit';

/** The scheduler knows neither game definitions, components nor their compilation. */
export type TurnScheduleState = Pick<GameState, 'players' | 'turn'> & {
  engine: { playerValues: PlayerValuesKitState };
};

export type TurnRuntimeState<TState extends object> = TurnScheduleState &
  Pick<GameState, 'pending'> & {
    game: TState;
    engine: { match: Pick<MatchKitState, 'status'> };
  };
