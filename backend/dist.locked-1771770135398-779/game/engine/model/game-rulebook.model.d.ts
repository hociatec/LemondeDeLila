import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
export interface GameRulebook<TState extends GameStateEntity = GameStateEntity, TMeta = any, TPhaseId extends string = string> {
    validateAction(state: TState, meta: TMeta, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto;
    getAvailableActions(state: TState, meta: TMeta, playerId: number): GameSingleActionDto[];
    canEnterPhase(state: TState, meta: TMeta, phaseId: TPhaseId): boolean;
    phaseTurnOwner(state: TState, meta: TMeta, phaseId: TPhaseId): number | null;
    actorOverrideAllowed(state: TState, meta: TMeta, actorId: number | null): boolean;
}
