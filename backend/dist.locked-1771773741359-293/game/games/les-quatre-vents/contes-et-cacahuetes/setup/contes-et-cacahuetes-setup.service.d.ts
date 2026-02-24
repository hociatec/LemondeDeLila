import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
export declare class ContesCacahuetesSetupService {
    private readonly random;
    private readonly setupFlow;
    constructor(_core: GameCoreService, random: RandomService, setupFlow: SetupFlowService);
    hydrateInitialState(baseState: GameStateEntity): GameStateEntity;
    private getRuntimeMeta;
}
