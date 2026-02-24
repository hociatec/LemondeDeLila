import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class MinuitSetupService {
    private readonly contentLoader;
    private readonly random;
    private readonly setupFlow;
    constructor(_core: GameCoreService, contentLoader: GameContentLoaderService, random: RandomService, setupFlow: SetupFlowService);
    private isBotLike;
    private hasPawnAssigned;
    hydrateInitialState(base: GameStateEntity): GameStateEntity;
    private listPawnChoiceEntries;
    private loadBoard;
    private loadCards;
    private loadPawns;
}
