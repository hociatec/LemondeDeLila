import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
type ActionDispatcher = (state: GameStateEntity, action: GameSingleActionDto) => GameStateEntity;
export declare class ActionResolverService {
    apply(state: GameStateEntity, actions: GameSingleActionDto[], dispatch: ActionDispatcher): GameStateEntity;
}
export {};
