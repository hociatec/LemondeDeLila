import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class JeuOieSetupService {
    private readonly contentLoader;
    private readonly setupFlow;
    constructor(_core: GameCoreService, contentLoader: GameContentLoaderService, setupFlow: SetupFlowService);
    private loadTexts;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
}
