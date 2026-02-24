import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
export declare class AbsurdissimesActionService {
    private readonly core;
    private readonly deckPolicies;
    constructor(core: GameCoreService, deckPolicies: DeckPoliciesService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handlePlayCard;
    private handleJudgePick;
    private prepareNextRound;
    private drawBlackCard;
    private drawWhiteCard;
    private getJudgeId;
    private setMeta;
    private getMeta;
    private getPlayerIds;
}
