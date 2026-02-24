import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { CatPattesCardDefinition, CatPattesObstacleType, CatPattesParadeType } from '../model/cat-pattes-cards';
import type { CatPattesMetadata } from '../model/cat-pattes-state.entity';
export declare const CAT_PATTES_OBSTACLE_TO_PARADE: Record<CatPattesObstacleType, CatPattesParadeType>;
export declare function canPlayPattes(meta: CatPattesMetadata, playerId: number, card: CatPattesCardDefinition): boolean;
export declare function playerCanReceiveObstacle(meta: CatPattesMetadata, playerId: number, obstacle: CatPattesObstacleType): boolean;
export declare function getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[];
export declare function validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto;
