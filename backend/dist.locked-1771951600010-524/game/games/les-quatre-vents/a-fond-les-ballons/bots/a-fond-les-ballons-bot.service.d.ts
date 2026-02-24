import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
export declare class AFondLesBallonsBotService {
    private readonly botRunner;
    constructor(botRunner: BotRunnerService);
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
}
