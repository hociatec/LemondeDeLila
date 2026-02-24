import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
export declare class CerclesSacresBotService {
    private readonly botRunner;
    constructor(botRunner: BotRunnerService);
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
    private buildCircle;
}
