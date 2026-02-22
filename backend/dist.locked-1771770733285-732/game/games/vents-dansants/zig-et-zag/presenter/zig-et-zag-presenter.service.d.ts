import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameStateWithActions } from '../../../../engine/dto/game-action.dto';
export declare class ZigEtZagPresenterService {
    exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions;
    private actionLabel;
}
