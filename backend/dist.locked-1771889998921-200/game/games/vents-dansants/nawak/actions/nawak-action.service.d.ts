import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { NawakChallengeService } from '../data/nawak-challenge.service';
export declare class NawakActionService {
    private readonly core;
    private readonly turns;
    private readonly challengeService;
    constructor(core: GameCoreService, turns: TurnFlowService, challengeService: NawakChallengeService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handleChooseAnswer;
    private handleVoteAnswer;
    private finishVoting;
    private getMeta;
    private setMeta;
    private getPlayerIds;
}
