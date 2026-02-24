import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
export declare function getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[];
export declare function validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto;
