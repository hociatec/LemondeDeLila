import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
export declare class AbsurdissimesBotService {
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
}
