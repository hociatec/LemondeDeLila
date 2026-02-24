import { GameSingleActionDto } from '../../../engine/dto/game-action.dto';
export type PendingRequirement = {
    playerId: number;
    type: string;
};
export declare class TurnActionsService {
    buildAvailableActions(params: {
        state: {
            status?: string;
            turn?: {
                currentPlayerId: number | null;
            };
            turnIndex: number;
        };
        playerId: number;
        pending?: PendingRequirement | null;
        base?: GameSingleActionDto[];
    }): GameSingleActionDto[];
}
