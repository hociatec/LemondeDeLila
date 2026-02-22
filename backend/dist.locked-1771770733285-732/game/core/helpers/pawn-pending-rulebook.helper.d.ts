import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import type { PendingPawnChoicePayload, PendingPawnPayload } from './pawn-selection.helper';
type PendingPawnFailureReason = 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_pawn';
export type PendingPawnValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    pawnId: string;
} | {
    ok: false;
    reason: PendingPawnFailureReason;
};
export declare function getPendingPawnActionsForPlayer(pending: PendingPawnPayload | null | undefined, playerId: number, pendingType?: string): GameSingleActionDto[];
export declare function validatePendingPawnActionForActor(params: {
    pending: PendingPawnPayload | null | undefined;
    actorId: number;
    actionType: string;
    payload?: PendingPawnChoicePayload;
    pendingType?: string;
    idResolver?: (value: unknown) => string;
}): PendingPawnValidationResult;
export {};
