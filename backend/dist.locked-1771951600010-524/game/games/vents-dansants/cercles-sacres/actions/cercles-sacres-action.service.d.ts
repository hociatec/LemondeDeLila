import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
export declare class CerclesSacresActionService {
    private readonly core;
    private readonly turns;
    private readonly deckPolicies;
    constructor(core: GameCoreService, turns: TurnFlowService, deckPolicies: DeckPoliciesService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handlePass;
    private handleDiscardCard;
    private handleFormCircle;
    private fillHandToMinimum;
    private ensurePlayerDrawn;
    private drawForPlayer;
    private drawOneCard;
    private removeCardsFromHand;
    private removeCardFromHand;
    private addCardToDiscard;
    private clearDrawn;
    private getMeta;
    private setMeta;
}
