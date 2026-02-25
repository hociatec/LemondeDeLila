import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
export declare class PrimalisSetupService {
    private readonly contentLoader;
    constructor(contentLoader: GameContentLoaderService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    private initialResources;
    private loadBoard;
}
