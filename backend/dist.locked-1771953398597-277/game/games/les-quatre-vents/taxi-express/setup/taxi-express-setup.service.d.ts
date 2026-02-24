import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
export declare class TaxiExpressSetupService {
    private readonly contentLoader;
    private readonly random;
    constructor(contentLoader: GameContentLoaderService, random: RandomService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    private loadBoard;
    private loadClients;
    private loadEvents;
    private getRuntimeMeta;
}
