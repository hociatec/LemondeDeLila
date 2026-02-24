import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
export type BotDecisionOptions = {
    preferTypes?: string[];
    fallbackTypes?: string[];
    score?: (action: GameSingleActionDto, ctx: {
        state: GameStateEntity;
        playerId: number;
    }) => number;
};
export type BotProfile = 'random' | 'greedy' | 'cautious' | 'aggressive';
export declare class BotStrategyService {
    choose(actions: GameSingleActionDto[], ctx: {
        state: GameStateEntity;
        playerId: number;
    }, opts?: BotDecisionOptions): GameSingleActionDto[];
    chooseProfile(actions: GameSingleActionDto[], ctx: {
        state: GameStateEntity;
        playerId: number;
    }, profile?: BotProfile, opts?: BotDecisionOptions): GameSingleActionDto[];
}
