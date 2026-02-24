import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';
export declare class MinuitPresenterService {
    private readonly boardPayload;
    constructor(boardPayload: BoardPayloadService);
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
}
