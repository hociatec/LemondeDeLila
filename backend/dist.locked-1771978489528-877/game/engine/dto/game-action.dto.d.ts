import { GameStateEntity, PendingState } from '../../core/entities/game-state.entity';
export declare class GameSingleActionDto {
    type: string;
    payload?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}
export declare class GameActionListDto {
    actions: GameSingleActionDto[];
}
export type GameStateResponse = GameStateWithActions;
export interface GameStateWithActions extends GameStateEntity {
    actions?: Array<{
        type: string;
        label?: string;
        payload?: any;
    }>;
    pending?: PendingState | null;
    extras?: Record<string, unknown>;
    catalog?: Record<string, unknown>;
    [key: string]: unknown;
}
