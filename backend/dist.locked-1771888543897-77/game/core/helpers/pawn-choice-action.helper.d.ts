import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../entities/game-state.entity';
export type PawnChoiceOption = {
    id: string;
    label?: string;
    description?: string;
    [key: string]: unknown;
};
type PendingChoice = {
    type?: unknown;
    playerId?: unknown;
    data?: {
        pawns?: unknown;
    };
};
export type PendingPawnChoiceAction = {
    playerId: number;
    options: PawnChoiceOption[];
    chosen: PawnChoiceOption;
    pending: PendingChoice;
};
export declare function resolvePendingPawnChoiceAction(params: {
    state: GameStateEntity;
    action: GameSingleActionDto;
    pendingType?: string;
    resolveChoice: (rawValue: unknown, options: PawnChoiceOption[]) => PawnChoiceOption | null;
}): PendingPawnChoiceAction | null;
export {};
