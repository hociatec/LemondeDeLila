import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import type { PendingPawnPayload } from './pawn-selection.helper';
import type { MovePayload } from './pawn-move-selection.helper';
type PendingPawnMoveFailureReason = 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_move';
export type PendingPawnMoveValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    move: {
        pawnIndex: number;
        targetProgress: number;
    };
} | {
    ok: false;
    reason: PendingPawnMoveFailureReason;
};
export declare function getPendingPawnMoveActionsForPlayer(pending: PendingPawnPayload | null | undefined, playerId: number, pendingType?: string, actionType?: string): GameSingleActionDto[];
export declare function validatePendingPawnMoveActionForActor(params: {
    pending: PendingPawnPayload | null | undefined;
    actorId: number | null;
    actionType: string;
    payload?: MovePayload;
    pendingType?: string;
    expectedActionType?: string;
}): PendingPawnMoveValidationResult;
export {};
