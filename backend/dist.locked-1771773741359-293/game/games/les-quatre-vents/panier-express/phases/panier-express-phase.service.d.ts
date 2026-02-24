import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { VictoryService } from '../../../../modules/victory/services/victory.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { ActionLogService } from '../../../../modules/actionlog/services/action-log.service';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
export declare class PanierExpressPhaseService {
    private readonly core;
    private readonly turns;
    private readonly victory;
    private readonly actionLogSvc;
    private readonly utils;
    private readonly phaseOrder;
    constructor(core: GameCoreService, turns: TurnFlowService, victory: VictoryService, actionLogSvc: ActionLogService, utils: PanierExpressUtils);
    advancePhases(state: GameStateEntity): GameStateEntity;
    advanceTurn(state: GameStateEntity): GameStateEntity;
    private applyVictory;
    private appendActionLog;
    private getMetadata;
}
