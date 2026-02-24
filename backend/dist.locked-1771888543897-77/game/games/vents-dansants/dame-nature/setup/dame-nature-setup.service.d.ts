import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { RandomService } from '../../../../modules/random/services/random.service';
export declare class DameNatureSetupService {
    private readonly random;
    constructor(random: RandomService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
}
