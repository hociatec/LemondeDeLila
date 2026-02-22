import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../core/services/game-core.service';
export declare class PromptPoliciesService {
    private readonly core;
    constructor(core: GameCoreService);
    appendLogOnce(state: GameStateEntity, message: string): GameStateEntity;
    ensurePendingPlayerPrompt(state: GameStateEntity, pendingType: string, buildMessage: (playerId: number) => string): GameStateEntity;
}
