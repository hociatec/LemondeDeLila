import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
export declare class OdysseeActionService {
    private readonly random;
    private readonly turns;
    private readonly core;
    constructor(random: RandomService, turns: TurnFlowService, core: GameCoreService);
    applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity;
    private handleRoll;
    private handleMovePawn;
    private computeMoves;
    private applyMove;
    private applyCapture;
    private isWinner;
    private endTurn;
    private getMeta;
    private playerName;
    private pawnLabel;
    private choicePawnLabel;
    private resolvePawnName;
}
