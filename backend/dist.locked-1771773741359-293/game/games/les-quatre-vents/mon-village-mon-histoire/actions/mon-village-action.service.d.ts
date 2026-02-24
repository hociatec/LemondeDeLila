import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
export declare class MonVillageActionService {
    private readonly random;
    private readonly turns;
    private readonly core;
    private readonly deckPolicies;
    constructor(random: RandomService, turns: TurnFlowService, core: GameCoreService, deckPolicies: DeckPoliciesService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handleRoll;
    private applyLanding;
    private collectCard;
    private updateCollections;
    private finishGame;
    private move;
    private setPos;
    private drawCard;
    private getMeta;
    private pawnLabel;
}
