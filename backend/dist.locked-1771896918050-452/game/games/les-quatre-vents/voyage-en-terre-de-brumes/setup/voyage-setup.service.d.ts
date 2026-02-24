import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
export declare class VoyageSetupService {
    private readonly contentLoader;
    private readonly random;
    constructor(contentLoader: GameContentLoaderService, random: RandomService);
    hydrateInitialState(base: GameStateEntity): GameStateEntity;
    private loadBoard;
    private loadCards;
    private getRuntimeMeta;
}
