import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BotRunnerService } from '../../../../modules/bot/services/bot-runner.service';
export declare class OlympiaBotService {
    private readonly botRunner;
    constructor(botRunner: BotRunnerService);
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
}
