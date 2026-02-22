import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
export declare class LaParadeSucreeActionService {
    private readonly core;
    private readonly turns;
    constructor(core: GameCoreService, turns: TurnFlowService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handlePlayCard;
    private handlePass;
    private applySpecialReward;
    private computeCandyValue;
    private addPlayed;
    private removeCardFromHand;
    private isGameFinished;
    private finishGame;
    private determineWinner;
    private scoreCandies;
    private getMeta;
    private setMeta;
}
