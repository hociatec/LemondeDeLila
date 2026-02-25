import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class AFondLesBallonsSetupService {
    private readonly core;
    private readonly random;
    private readonly contentLoader;
    private readonly setupFlow;
    constructor(core: GameCoreService, random: RandomService, contentLoader: GameContentLoaderService, setupFlow: SetupFlowService);
    private loadPawns;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
}
