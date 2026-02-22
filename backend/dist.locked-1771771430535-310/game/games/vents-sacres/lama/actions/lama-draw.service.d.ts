import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata } from '../model/lama.model';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';
export declare class LamaDrawService {
    private readonly shared;
    private readonly round;
    private readonly logger;
    constructor(shared: LamaSharedService, round: LamaRoundService, logger: LamaLogService);
    applyDraw(state: GameStateEntity, meta: LamaMetadata, actorId: number): GameStateEntity;
}
