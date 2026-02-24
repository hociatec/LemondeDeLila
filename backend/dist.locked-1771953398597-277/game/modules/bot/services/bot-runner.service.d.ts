import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameRulesAdapter } from '../../../engine/interfaces/game-rules-adapter.interface';
import { BotStrategyService, BotDecisionOptions, BotProfile } from './bot-strategy.service';
export declare class BotRunnerService {
    private readonly strategy;
    constructor(strategy: BotStrategyService);
    choose(actions: GameSingleActionDto[], ctx: {
        state: GameStateEntity;
        playerId: number;
    }, profile?: BotProfile, opts?: BotDecisionOptions): GameSingleActionDto[];
    suggestForHandler(handler: GameRulesAdapter | undefined, state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] | null;
}
