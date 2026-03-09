"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BasePresenterService", {
    enumerable: true,
    get: function() {
        return BasePresenterService;
    }
});
const _actionspresenterhelper = require("../../presenters/actions-presenter.helper");
let BasePresenterService = class BasePresenterService {
    /**
   * Expose l'état du jeu avec les actions et le pending state.
   *
   * Cette méthode template orchestre la construction de l'état exposé
   * en appelant les méthodes abstraites et concrètes appropriées.
   *
   * @param state - État actuel du jeu
   * @param actions - Actions disponibles pré-calculées (optionnel)
   * @returns État enrichi pour le client
   */ buildExposedState(state, actions) {
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
            extras
        };
    }
    /**
   * Expose l'état du jeu personnalisé pour un utilisateur spécifique.
   *
   * Permet de masquer certaines informations selon le joueur
   * (main des adversaires, cartes cachées, etc.).
   *
   * @param state - État actuel du jeu
   * @param userId - ID de l'utilisateur
   * @param actions - Actions disponibles pré-calculées (optionnel)
   * @returns État enrichi personnalisé pour cet utilisateur
   */ buildExposedStateForUser(state, userId, actions) {
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
            extras
        };
    }
    /**
   * Formate les actions en objets { type, label, payload }.
   *
   * @param actions - Actions à formater
   * @returns Actions formatées
   */ formatActions(actions) {
        return (0, _actionspresenterhelper.formatPresenterActions)(actions, (a)=>this.getActionLabel(a.type));
    }
    /**
   * Récupère le label d'une action (par défaut = type).
   *
   * Peut être surchargée pour fournir des labels personnalisés.
   *
   * @param actionType - Type de l'action
   * @returns Label de l'action
   */ getActionLabel(actionType) {
        return actionType;
    }
    /**
   * Vérifie si le jeu a démarré.
   *
   * @param state - État actuel du jeu
   * @returns true si le jeu a démarré
   */ isStarted(state) {
        return String(state.status ?? '').toLowerCase() === 'started';
    }
    /**
   * Récupère l'ID du joueur courant.
   *
   * @param state - État actuel du jeu
   * @returns ID du joueur courant ou null
   */ getCurrentPlayerId(state) {
        return state.turn?.currentPlayerId ?? null;
    }
    /**
   * Récupère les métadonnées du jeu.
   *
   * @param state - État actuel du jeu
   * @returns Métadonnées du jeu
   */ getMetadata(state) {
        const metadata = state.metadata;
        if (metadata && typeof metadata === 'object') {
            return metadata;
        }
        return {};
    }
    /**
   * Récupère les extras existants dans l'état.
   *
   * @param state - État actuel du jeu
   * @returns Extras existants
   */ getBaseExtras(state) {
        const extrasFromState = state.extras;
        return extrasFromState && typeof extrasFromState === 'object' ? extrasFromState : {};
    }
    /**
   * Récupère les actions disponibles pour le joueur courant.
   *
   * Par défaut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette méthode si elles ne passent pas les actions
   * en paramètre à buildExposedState.
   *
   * @param state - État actuel du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Actions disponibles
   */ getAvailableActions(_state, _currentPlayerId) {
        void _state;
        void _currentPlayerId;
        return [];
    }
    /**
   * Récupère les actions disponibles pour un utilisateur spécifique.
   *
   * Par défaut, retourne un tableau vide. Les sous-classes doivent
   * surcharger cette méthode si elles ne passent pas les actions
   * en paramètre à buildExposedStateForUser.
   *
   * @param state - État actuel du jeu
   * @param userId - ID de l'utilisateur
   * @returns Actions disponibles
   */ getAvailableActionsForUser(state, userId) {
        return this.getAvailableActions(state, userId);
    }
    /**
   * Construit le pending state pour un utilisateur spécifique.
   *
   * Par défaut, retourne le même pending state que buildPendingState.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param userId - ID de l'utilisateur
   * @param currentPlayerId - ID du joueur courant
   * @returns Pending state ou null
   */ buildPendingStateForUser(state, metadata, userId, currentPlayerId) {
        void metadata;
        void currentPlayerId;
        const pending = this.buildPendingState(state, metadata, currentPlayerId);
        return this.filterPendingForUser(pending, userId);
    }
    shouldExposePendingToUser(pending, userId) {
        if (!pending) return false;
        const ownerId = typeof pending?.playerId === 'number' ? pending.playerId : null;
        if (ownerId == null) return true;
        return ownerId === userId;
    }
    filterPendingForUser(pending, userId, fallback = null) {
        return this.shouldExposePendingToUser(pending, userId) ? pending : fallback;
    }
    /**
   * Construit la vue du joueur actuel pour les extras.
   * Cette méthode générique trouve le joueur dont c'est le tour.
   *
   * @param state - État actuel du jeu
   * @param currentPlayerId - ID du joueur courant
   * @returns Vue du joueur courant ou null
   */ buildCurrentPlayerView(state, currentPlayerId) {
        if (currentPlayerId === null) return null;
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p)=>p?.id === currentPlayerId);
        if (!player) return null;
        return {
            id: player.id,
            username: player.username ?? `Joueur ${player.id}`
        };
    }
    /**
   * Construit les extras pour un utilisateur spécifique.
   *
   * Par défaut, retourne les mêmes extras que buildExtras.
   * Les sous-classes peuvent surcharger pour personnaliser.
   *
   * @param state - État actuel du jeu
   * @param metadata - Métadonnées du jeu
   * @param userId - ID de l'utilisateur
   * @param currentPlayerId - ID du joueur courant
   * @returns Extras personnalisés
   */ buildExtrasForUser(state, metadata, _userId, currentPlayerId) {
        return this.buildExtras(state, metadata, currentPlayerId);
    }
};
