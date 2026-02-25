import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { LamaSharedService } from '../shared/lama-shared.service';
export declare class LamaBotService {
    private readonly shared;
    constructor(shared: LamaSharedService);
    getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[];
}
