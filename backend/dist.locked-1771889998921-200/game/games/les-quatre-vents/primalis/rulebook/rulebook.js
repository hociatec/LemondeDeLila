"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailableActions = getAvailableActions;
exports.validateAction = validateAction;
const game_errors_1 = require("../../../../../common/errors/game-errors");
const primalis_definition_1 = require("../definitions/primalis.definition");
const action_service_helper_1 = require("../../../../actions/action-service.helper");
const rulebook_guard_helper_1 = require("../../../../rulebook/rulebook-guard.helper");
function isPrimalisActionType(value) {
    return primalis_definition_1.PRIMALIS_GAME.actions.includes(value);
}
function getAvailableActions(state, playerId) {
    if (!(0, rulebook_guard_helper_1.canPlayerActOnTurn)(state, playerId))
        return [];
    return [{ type: 'roll', payload: {} }];
}
function validateAction(state, action, actorId) {
    const normalizedType = (0, action_service_helper_1.normalizeActionType)(action);
    const rawType = typeof normalizedType === 'string' ? normalizedType : '';
    const maybeType = (0, action_service_helper_1.isRollAlias)(rawType) ? 'roll' : rawType;
    if (!isPrimalisActionType(maybeType)) {
        throw new game_errors_1.PlayerActionError(`Action inconnue: ${rawType || '(vide)'}`, {
            gameType: 'primalis',
        });
    }
    if (actorId == null) {
        throw new game_errors_1.PlayerActionError('Acteur requis.', {
            gameType: 'primalis',
        });
    }
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') {
        throw new game_errors_1.PlayerActionError("La partie n'est pas démarrée.", {
            gameType: 'primalis',
        });
    }
    const current = state.turn?.currentPlayerId ?? null;
    if (current != null && actorId !== current) {
        throw new game_errors_1.PlayerActionError("Ce n'est pas votre tour.", {
            gameType: 'primalis',
            playerId: actorId,
            currentPlayerId: current,
        });
    }
    return { type: 'roll', payload: {} };
}
//# sourceMappingURL=rulebook.js.map