import { GameStateEntity } from '../../core/entities/game-state.entity';
import { GameSingleActionDto, GameStateWithActions } from '../dto/game-action.dto';
import type { BotStrategy } from '../../modules/bot/bot-strategy.interface';
import type { GameShortcutHint, GameShortcutsContext } from '../shortcuts/game-shortcuts';
export interface GameRulesAdapter {
    readonly gameType: string;
    readonly category: string;
    readonly subcategory?: string;
    readonly displayName: string;
    readonly description?: string;
    readonly minPlayers?: number;
    readonly maxPlayers?: number;
    shouldAnnounceBoardArrivals?(): boolean;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    getBotActions?(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] | null;
    getBotStrategy?(): BotStrategy | null;
    getAvailableActions?(state: GameStateEntity, playerId: number): GameSingleActionDto[];
    validateAction?(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto;
    validateActor?(state: GameStateEntity, actions: GameSingleActionDto[], actorId: number | null): boolean;
    exposeState?(state: GameStateEntity): GameStateWithActions;
    exposeStateForUser?(state: GameStateEntity, userId: number): GameStateWithActions;
    getShortcuts?(ctx: GameShortcutsContext<any>): GameShortcutHint[];
}
export type GameDefinition = {
    id: string;
    name: string;
    category: string;
    subcategory?: string;
    description?: string;
    minPlayers?: number;
    maxPlayers?: number;
    chatEnabled?: boolean;
    chatSoundsEnabled?: boolean;
    manifestPath?: string;
    rulesPath?: string;
};
