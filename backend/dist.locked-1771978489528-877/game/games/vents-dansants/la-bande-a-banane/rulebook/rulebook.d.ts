import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { BandeABananeMonkeySpecies } from '../model/la-bande-a-banane-cards';
export type BandeABananeActionPayload = {
    cardId?: string | null;
    targetPlayerId?: number | null;
    cardToGiveId?: string | null;
    species?: BandeABananeMonkeySpecies | null;
};
export declare function getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[];
export declare function validateAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): GameSingleActionDto;
