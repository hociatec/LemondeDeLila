import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { LamaMetadata } from '../model/lama.model';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaLogService } from '../logging/lama-log.service';
export declare class LamaInfoService {
    private readonly shared;
    private readonly logger;
    constructor(shared: LamaSharedService, logger: LamaLogService);
    applyInfoAction(state: GameStateEntity, meta: LamaMetadata, actionType: string, actorId: number): GameStateEntity;
}
