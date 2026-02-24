import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
export declare class JeuOieActionService {
    private readonly random;
    private readonly turns;
    private readonly core;
    private readonly setupFlow;
    private readonly turnPolicies?;
    constructor(random: RandomService, turns: TurnFlowService, core: GameCoreService, setupFlow: SetupFlowService, turnPolicies?: TurnPoliciesService | undefined);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handleChoosePawn;
    private handleRoll;
    private applyLanding;
    private move;
    private getMeta;
    private pawnLabel;
    private pawnPossessiveLabel;
    private lowercaseFirst;
    private compactTileLabel;
    private ensurePawnSelectionPrompt;
    private getTurnPolicies;
}
