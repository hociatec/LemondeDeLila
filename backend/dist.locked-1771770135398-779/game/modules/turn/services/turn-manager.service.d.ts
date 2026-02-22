import { GameStateEntity } from '../../../core/entities/game-state.entity';
export declare class TurnManagerService {
    setCurrent(state: GameStateEntity, playerId: number | null): GameStateEntity;
    next(state: GameStateEntity, livingIds: number[], offset?: number): GameStateEntity;
}
