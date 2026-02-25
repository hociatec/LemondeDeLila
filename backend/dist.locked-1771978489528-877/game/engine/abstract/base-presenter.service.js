"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasePresenterService = void 0;
const actions_presenter_helper_1 = require("../../presenters/actions-presenter.helper");
class BasePresenterService {
    buildExposedState(state, actions) {
        const currentId = this.getCurrentPlayerId(state);
        const metadata = this.getMetadata(state);
        const availableActions = actions ?? this.getAvailableActions(state, currentId);
        const pending = this.buildPendingState(state, metadata, currentId);
        const extras = this.buildExtras(state, metadata, currentId);
        const catalog = this.buildCatalog();
        return {
            ...state,
            catalog,
            actions: this.formatActions(availableActions),
            pending,
            extras,
        };
    }
    buildExposedStateForUser(state, userId, actions) {
        const currentId = this.getCurrentPlayerId(state);
        const metadata = this.getMetadata(state);
        const availableActions = actions ?? this.getAvailableActionsForUser(state, userId);
        const pending = this.buildPendingStateForUser(state, metadata, userId, currentId);
        const extras = this.buildExtrasForUser(state, metadata, userId, currentId);
        const catalog = this.buildCatalog();
        return {
            ...state,
            catalog,
            actions: this.formatActions(availableActions),
            pending,
            extras,
        };
    }
    formatActions(actions) {
        return (0, actions_presenter_helper_1.formatPresenterActions)(actions, (a) => this.getActionLabel(a.type));
    }
    getActionLabel(actionType) {
        return actionType;
    }
    isStarted(state) {
        return String(state.status ?? '').toLowerCase() === 'started';
    }
    getCurrentPlayerId(state) {
        return state.turn?.currentPlayerId ?? null;
    }
    getMetadata(state) {
        const metadata = state.metadata;
        if (metadata && typeof metadata === 'object') {
            return metadata;
        }
        return {};
    }
    getBaseExtras(state) {
        const extrasFromState = state
            .extras;
        return extrasFromState && typeof extrasFromState === 'object'
            ? extrasFromState
            : {};
    }
    getAvailableActions(_state, _currentPlayerId) {
        void _state;
        void _currentPlayerId;
        return [];
    }
    getAvailableActionsForUser(state, userId) {
        return this.getAvailableActions(state, userId);
    }
    buildPendingStateForUser(state, metadata, userId, currentPlayerId) {
        void metadata;
        void currentPlayerId;
        const pending = this.buildPendingState(state, metadata, currentPlayerId);
        return this.filterPendingForUser(pending, userId);
    }
    shouldExposePendingToUser(pending, userId) {
        if (!pending)
            return false;
        const ownerId = typeof pending?.playerId === 'number' ? pending.playerId : null;
        if (ownerId == null)
            return true;
        return ownerId === userId;
    }
    filterPendingForUser(pending, userId, fallback = null) {
        return this.shouldExposePendingToUser(pending, userId) ? pending : fallback;
    }
    buildCurrentPlayerView(state, currentPlayerId) {
        if (currentPlayerId === null)
            return null;
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p) => p?.id === currentPlayerId);
        if (!player)
            return null;
        return {
            id: player.id,
            username: player.username ?? `Joueur ${player.id}`,
        };
    }
    buildExtrasForUser(state, metadata, _userId, currentPlayerId) {
        return this.buildExtras(state, metadata, currentPlayerId);
    }
}
exports.BasePresenterService = BasePresenterService;
//# sourceMappingURL=base-presenter.service.js.map