import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameContentLoaderService } from '../../../../engine/services/game-content-loader.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import type { SacVariantId } from '../model/sac-a-malices.types';
export declare class SacAMalicesSetupService {
    private readonly contentLoader;
    private readonly random;
    private readonly setupFlow;
    constructor(contentLoader: GameContentLoaderService, random: RandomService, setupFlow: SetupFlowService);
    hydrateInitialState(base: GameStateEntity): GameStateEntity;
    applyVariantSelection(base: GameStateEntity, variantId: SacVariantId): GameStateEntity;
    private resolveVariantId;
    private buildSetupState;
    private buildVariantChoicePending;
    private buildConfiguredState;
    private resolveSeededStarterId;
    private loadBoard;
    private loadGroups;
    private loadStations;
    private loadUtilities;
    private loadCards;
}
