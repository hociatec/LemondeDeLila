import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
export declare class CaActionService {
    private readonly random;
    private readonly turns;
    private readonly core;
    private readonly deckPolicies;
    constructor(random: RandomService, turns: TurnFlowService, core: GameCoreService, deckPolicies: DeckPoliciesService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handleRoll;
    private handleDraw;
    private handleChooseTarget;
    private handleChooseNextPlayer;
    private handleChooseNextDelta;
    private applyCardEffects;
    private applyGlobal;
    private applyConditional;
    private applySpecialAfterMove;
    private advanceTurnWithNextDelta;
    private drawCard;
    private getMeta;
    private otherPlayers;
    private pawnLabel;
}
