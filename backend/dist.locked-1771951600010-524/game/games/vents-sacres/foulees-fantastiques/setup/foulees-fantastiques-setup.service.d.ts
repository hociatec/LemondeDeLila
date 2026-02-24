import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class FouleesFantastiquesSetupService {
    private readonly core;
    private readonly contentLoader;
    private readonly setupFlow;
    constructor(core: GameCoreService, contentLoader: GameContentLoaderService, setupFlow: SetupFlowService);
    private loadBoard;
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    recomputeBoardView(state: GameStateEntity): GameStateEntity;
}
