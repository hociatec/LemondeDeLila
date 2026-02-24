import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
export declare class AventureSauvageSetupService {
    private readonly random;
    private readonly contentLoader;
    private readonly setupFlow;
    constructor(_core: GameCoreService, random: RandomService, contentLoader: GameContentLoaderService, setupFlow: SetupFlowService);
    private loadPawns;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    private normalizePawnAssignments;
}
