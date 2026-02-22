import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
export interface ActionHandler {
    readonly actionType: string;
    handle(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity;
}
export declare class ActionDispatcherService {
    private readonly handlers;
    register(handler: ActionHandler): void;
    registerMany(handlers: ActionHandler[]): void;
    dispatch(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameStateEntity;
    hasHandler(actionType: string): boolean;
    getRegisteredActions(): string[];
    clear(): void;
}
