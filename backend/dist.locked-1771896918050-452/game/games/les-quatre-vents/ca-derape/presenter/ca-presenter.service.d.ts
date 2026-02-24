import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
export declare class CaPresenterService {
    private readonly boardPayload;
    constructor(boardPayload: BoardPayloadService);
    private buildPositionMessage;
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private getMeta;
}
