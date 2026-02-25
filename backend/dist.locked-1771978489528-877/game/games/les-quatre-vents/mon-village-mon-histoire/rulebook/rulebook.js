"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const mon_village_definition_1 = require("../definitions/mon-village.definition");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.isStartedState)(state))
        return [];
    if (state.pending)
        return [];
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== playerId) {
        return [];
    }
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const rawType = (0, action_service_helper_1.normalizeActionType)(action);
    const type = (0, action_service_helper_1.normalizeRollActionType)(rawType);
    if (!mon_village_definition_1.MON_VILLAGE_GAME.actions.includes(type)) {
        throw new game_errors_1.GameValidationError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'mon-village-mon-histoire',
            action: rawType,
            allowedActions: mon_village_definition_1.MON_VILLAGE_GAME.actions,
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'mon-village-mon-histoire',
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'mon-village-mon-histoire',
        });
    }
    if (state.pending) {
        throw new game_errors_1.PlayerActionError('Action indisponible (choix en attente).', {
            gameType: 'mon-village-mon-histoire',
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== actorId) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'mon-village-mon-histoire',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    return { type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map