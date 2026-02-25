import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class FrousseSetupService {
    private readonly contentLoader;
    private readonly random;
    private readonly setupFlow;
    constructor(contentLoader: GameContentLoaderService, random: RandomService, setupFlow: SetupFlowService);
    hydrateInitialState(base: GameStateEntity): GameStateEntity;
    private loadBoard;
    private loadCards;
    private loadPawns;
}
