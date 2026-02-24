import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
import { TurnStatusService } from '../../../../modules/turn/services/turn-status.service';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
export declare class PanierExpressBotService {
    private readonly botRunner;
    private readonly turnStatus;
    constructor(botRunner: BotRunnerService, turnStatus: TurnStatusService);
    getBotActions(state: GameStateEntity, meta: PanierExpressMetadata, botPlayerId: number): GameSingleActionDto[];
    private injectQuizAnswer;
}
