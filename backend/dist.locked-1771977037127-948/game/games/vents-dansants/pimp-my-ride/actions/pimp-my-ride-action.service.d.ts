import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
export declare class PimpMyRideActionPayload {
    cardId?: string | null;
}
export declare class PimpMyRideActionService {
    private readonly core;
    private readonly turns;
    private readonly deckPolicies;
    constructor(core: GameCoreService, turns: TurnFlowService, deckPolicies: DeckPoliciesService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handlePass;
    private handlePlayCard;
    private handleDiscardCard;
    private completeCar;
    private ensurePlayerDrawn;
    private drawOneCard;
    private addCardToHand;
    private removeCardFromHand;
    private addCardToDiscard;
    private setProgress;
    private getProgress;
    private setMeta;
    private getMeta;
    private playerHasCard;
    private getCardName;
    private clearDrawn;
}
