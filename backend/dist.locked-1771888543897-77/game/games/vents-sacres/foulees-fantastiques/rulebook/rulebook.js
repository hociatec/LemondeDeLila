"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_definition_1 = require("../definitions/game.definition");
const game_errors_1 = require("../../../../../common/errors/game-errors");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const pending_pawn_move_rulebook_helper_1 = require("../../../../core/helpers/pending-pawn-move-rulebook.helper");
function getAvailableActions(state, playerId) {
    if ((state.status || '').toLowerCase() !== 'started')
        return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId)
        return [];
    const pending = state.pending ?? null;
    if (pending) {
        if (pending.type === 'choose_family' && pending.playerId === playerId) {
            const familyIds = Array.isArray(pending?.data?.familyIds)
                ? pending.data.familyIds
                : [];
            return familyIds
                .filter((id) => typeof id === 'string' && id.trim().length > 0)
                .map((id) => ({
                type: 'choose_family',
                payload: { familyId: String(id).trim() },
            }));
        }
        const pendingMoveActions = (0, pending_pawn_move_rulebook_helper_1.getPendingPawnMoveActionsForPlayer)(pending, playerId, 'choose_pawn', 'move_pawn');
        if (pendingMoveActions.length > 0) {
            return pendingMoveActions;
        }
        return [];
    }
    return [{ type: 'roll' }, { type: 'ROLL_DICE' }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const normalizedType = rawType.toLowerCase();
    const type = rawType;
    if (!game_definition_1.FOULEES_FANTASTIQUES_GAME.actions.includes(type) &&
        !game_definition_1.FOULEES_FANTASTIQUES_GAME.actions.includes(normalizedType)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType}`, {
            gameType: 'foulees-fantastiques',
            action: rawType,
            allowedActions: game_definition_1.FOULEES_FANTASTIQUES_GAME.actions,
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'foulees-fantastiques',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    if ((0, action_service_helper_1.isRollAlias)(type, normalizedType)) {
        return { ...action, type: 'roll', payload: {} };
    }
    if (type === 'roll') {
        return { ...action, type: 'roll', payload: {} };
    }
    if (type === 'choose_family') {
        const pending = state.pending ?? null;
        if (!pending ||
            pending.type !== 'choose_family' ||
            pending.playerId !== actorId) {
            throw new game_errors_1.PlayerActionError('Aucun choix de famille en attente.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
            });
        }
        const payload = action.payload ?? {};
        const familyId = String(payload.familyId ?? '').trim();
        if (!familyId) {
            throw new game_errors_1.GameValidationError('Payload invalide: familyId', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        const allowed = Array.isArray(pending?.data?.familyIds)
            ? pending.data.familyIds
            : [];
        const ok = allowed.some((id) => typeof id === 'string' && id.trim() === familyId);
        if (!ok) {
            throw new game_errors_1.GameValidationError('Famille invalide.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        const meta = (state.metadata ?? {});
        const taken = Object.entries(meta.familyIdByPlayer ?? {}).some(([pid, fid]) => Number(pid) !== (actorId ?? NaN) &&
            String(fid ?? '').trim() === familyId);
        if (taken) {
            throw new game_errors_1.GameValidationError('Famille déjà choisie.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload,
            });
        }
        return { ...action, type: 'choose_family', payload: { familyId } };
    }
    if (type === 'move_pawn') {
        const pending = state.pending ?? null;
        const moveValidation = (0, pending_pawn_move_rulebook_helper_1.validatePendingPawnMoveActionForActor)({
            pending,
            actorId,
            actionType: type,
            payload: action.payload ?? {},
            pendingType: 'choose_pawn',
            expectedActionType: 'move_pawn',
        });
        if (!moveValidation.ok &&
            moveValidation.reason === 'not_pending_for_actor') {
            throw new game_errors_1.PlayerActionError('Aucun choix de pion en attente.', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
            });
        }
        if (!moveValidation.ok) {
            throw new game_errors_1.GameValidationError('Payload invalide: pawnIndex/targetProgress', {
                gameType: 'foulees-fantastiques',
                playerId: actorId ?? undefined,
                payload: action.payload,
            });
        }
        return {
            ...action,
            type: 'move_pawn',
            payload: moveValidation.move,
        };
    }
    return { ...action, type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map