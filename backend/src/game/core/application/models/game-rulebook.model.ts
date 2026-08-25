import type { GameStateEntity } from '../models/game-state.model';
import type { GameSingleActionDto } from '../models/game-action.model';

export interface GameRulebook<
  TState extends GameStateEntity = GameStateEntity,
  TMeta = unknown,
  TPhaseId extends string = string,
> {
  validateAction(
    state: TState,
    meta: TMeta,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto;

  getAvailableActions(
    state: TState,
    meta: TMeta,
    playerId: number,
  ): GameSingleActionDto[];

  canEnterPhase(state: TState, meta: TMeta, phaseId: TPhaseId): boolean;

  phaseTurnOwner(state: TState, meta: TMeta, phaseId: TPhaseId): number | null;

  actorOverrideAllowed(
    state: TState,
    meta: TMeta,
    actorId: number | null,
  ): boolean;
}



