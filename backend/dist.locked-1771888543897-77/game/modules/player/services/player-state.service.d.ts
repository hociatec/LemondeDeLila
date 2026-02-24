import { GameStateEntity, PlayerStateEntity } from '../../../core/entities/game-state.entity';
export declare class PlayerStateService {
    isAlive(state: GameStateEntity, playerId: number | null | undefined): boolean;
    kill(state: GameStateEntity, playerId: number): GameStateEntity;
    livingIds(state: GameStateEntity): number[];
    ensureAliveFlag(players: PlayerStateEntity[]): PlayerStateEntity[];
}
