import { GameStateEntity } from '../../../core/entities/game-state.entity';
export type TurnStatusKey = string;
export declare class TurnStatusService {
    setStatus(state: GameStateEntity, playerId: number, key: TurnStatusKey, value: number): GameStateEntity;
    getStatus(state: GameStateEntity, playerId: number, key: TurnStatusKey): number;
    decrement(state: GameStateEntity, key: TurnStatusKey): GameStateEntity;
}
