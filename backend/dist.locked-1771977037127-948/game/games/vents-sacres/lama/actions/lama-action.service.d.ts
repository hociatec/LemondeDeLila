import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaDrawService } from './lama-draw.service';
import { LamaPassService } from './lama-pass.service';
import { LamaPlayService } from './lama-play.service';
import { LamaQuitService } from './lama-quit.service';
import { LamaReturnService } from './lama-return.service';
import { LamaInfoService } from './lama-info.service';
import { LamaSetupService } from '../setup/lama-setup.service';
import { LamaLogService } from '../logging/lama-log.service';
export declare class LamaActionService {
    private readonly shared;
    private readonly drawService;
    private readonly playService;
    private readonly quitService;
    private readonly returnService;
    private readonly infoService;
    private readonly setupService;
    private readonly logger;
    constructor(shared: LamaSharedService, drawService: LamaDrawService, _passService: LamaPassService, playService: LamaPlayService, quitService: LamaQuitService, returnService: LamaReturnService, infoService: LamaInfoService, setupService: LamaSetupService, logger: LamaLogService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private appendTurnAnnouncementIfNeeded;
    private applyOne;
}
